import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import MysqlAdapter from '@/lib/externalDb/mysql';
import { createAdapterFromConnection, getBackupDir, backupFileName } from '@/lib/externalDb';

const SYSTEM_DBS = ['information_schema', 'performance_schema', 'mysql', 'sys'];

// "local" is treated as a virtual MySQL connection built from the app env,
// so every flow (browse/backup/restore) goes through the same adapter code.
function localAdapter() {
  return new MysqlAdapter({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
}

function readDumpText(filePath) {
  const raw = fs.readFileSync(filePath);
  try {
    return zlib.gunzipSync(raw).toString('utf8');
  } catch {
    return raw.toString('utf8');
  }
}

function listBackupFiles(filterFn) {
  const BACKUP_DIR = getBackupDir();
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => (f.endsWith('.sql.gz') || f.endsWith('.sql')) && filterFn(f))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        filename: f,
        size_mb: Math.round(stat.size / 1024 / 1024 * 100) / 100,
        created_at: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 50);
}

async function ensureDatabase(adapter, type, dbName) {
  const safe = String(dbName).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) throw new Error('Invalid database name');
  const conn = await adapter.connect(type === 'postgres' ? 'postgres' : type === 'mssql' ? 'master' : undefined);
  try {
    if (type === 'postgres') {
      try {
        await conn.query(`CREATE DATABASE "${safe}"`);
      } catch (e) {
        if (!/42P04|already exists/i.test(e.message)) throw e;
      }
    } else if (type === 'mssql') {
      await conn.request().query(`IF DB_ID(N'${safe.replace(/'/g, "''")}') IS NULL CREATE DATABASE [${safe.replace(/]/g, ']]')}]`);
    } else {
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${safe}\``);
    }
  } finally {
    await conn.end ? conn.end().catch(() => {}) : conn.close().catch(() => {});
  }
}

function summarizeRestore(result, dbName) {
  if (result.via === 'tsql') return `Restored ${dbName} from server-side .bak`;
  const parts = [`${dbName}: ${result.statements ?? '?'} statement(s) executed`];
  if (result.errorCount > 0) parts.push(`${result.errorCount} skipped (details in response)`);
  return parts.join(' — ');
}

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user || user.id !== 1) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const BACKUP_DIR = getBackupDir();
  const connId = req.query.connection_id || (req.body && req.body.connection_id) || 'local';

  // ============================== GET ==============================
  if (req.method === 'GET') {
    try {
      // ---- Remote / saved connection ----
      if (connId && connId !== 'local') {
        const adapter = await createAdapterFromConnection(connId);
        if (!adapter) return res.status(404).json({ error: 'Connection not found' });
        const type = adapter.cfg.type || 'mysql';
        const databases = await adapter.listDatabases();
        const onlyDb = req.query.database;
        let tables = null;
        if (onlyDb) tables = await adapter.listTables(onlyDb);
        const backups = listBackupFiles(f => f.startsWith(`${type}-conn${connId}-`));
        return res.status(200).json({
          connection: { id: Number(connId), name: adapter.cfg.name, type },
          databases: databases.map(d => ({ ...d, name: d.name, total_size_mb: d.size_mb, tables: null })),
          tables,
          backups,
        });
      }

      // ---- Local server ----
      const adapter = localAdapter();
      const dbList = await adapter.listDatabases();
      const databases = [];
      for (const d of dbList) {
        if (SYSTEM_DBS.includes(d.name)) continue;
        const tables = await adapter.listTables(d.name);
        databases.push({
          name: d.name,
          total_size_mb: d.size_mb,
          table_count: d.table_count,
          total_rows: tables.reduce((s, t) => s + (Number(t.row_count) || 0), 0),
          tables,
        });
      }
      const backups = listBackupFiles(f => !/-conn\d+-/.test(f));
      return res.status(200).json({ databases, backups });
    } catch (error) {
      console.error('Database stats error:', error);
      return res.status(400).json({ error: 'Failed to fetch database stats: ' + error.message });
    }
  }

  // ============================== POST ==============================
  if (req.method === 'POST') {
    const { action } = req.body;
    const bodyConnId = req.body.connection_id;

    // ---- backup ----
    if (action === 'backup') {
      const { databases: targetDbs, database: singleDb, mode, remotePath } = req.body;
      const dbs = targetDbs || (singleDb ? [singleDb] : ['devtrack']);
      const results = [];

      try {
        let adapter;
        let type = 'mysql';
        let isRemote = false;
        if (bodyConnId && bodyConnId !== 'local') {
          adapter = await createAdapterFromConnection(bodyConnId);
          if (!adapter) return res.status(404).json({ error: 'Connection not found' });
          type = adapter.cfg.type || 'mysql';
          isRemote = true;
        } else {
          adapter = localAdapter();
        }

        for (const dbName of dbs) {
          if (!isRemote && SYSTEM_DBS.includes(dbName)) continue;
          const filename = isRemote
            ? backupFileName(type, bodyConnId, dbName)
            : `${dbName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.sql.gz`;
          const filepath = path.join(BACKUP_DIR, filename);

          const r = await adapter.backup(dbName, filepath, { mode, remotePath });
          let size_mb = null;
          if (r.mode !== 'tsql' && fs.existsSync(r.file)) {
            size_mb = Math.round(fs.statSync(r.file).size / 1024 / 1024 * 100) / 100;
            if (size_mb === 0) {
              fs.unlinkSync(r.file);
              throw new Error(`Backup produced empty file for ${dbName}`);
            }
          }
          results.push({
            database: dbName,
            filename: path.basename(r.file),
            size_mb,
            mode: r.mode,
            note: r.note || null,
            created_at: new Date().toISOString(),
          });
        }
        return res.status(200).json({ success: true, results });
      } catch (error) {
        console.error('Backup error:', error);
        return res.status(400).json({ error: 'Backup failed: ' + error.message });
      }
    }

    // ---- verify ----
    if (action === 'verify') {
      const { filename } = req.body;
      if (!filename) return res.status(400).json({ error: 'Filename required' });
      if (filename.includes('..') || filename.includes('/') || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      const filepath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup not found' });

      try {
        const dumpContent = readDumpText(filepath);
        const tableMatches = dumpContent.match(/CREATE TABLE[^(]*?[`["]([\w-]+)[`\]]/g) || [];
        const tableNames = tableMatches.map(m => (m.match(/[`["]([\w-]+)[`\]]$/) || [])[1]).filter(Boolean);
        const insertMatches = dumpContent.match(/INSERT INTO/g) || [];
        return res.status(200).json({
          filename,
          table_count: tableNames.length,
          tables: [...new Set(tableNames)].slice(0, 100),
          total_inserts: insertMatches.length,
          size_on_disk: Math.round(fs.statSync(filepath).size / 1024 / 1024 * 100) / 100,
          size_uncompressed: Math.round(dumpContent.length / 1024 / 1024 * 100) / 100
        });
      } catch (error) {
        return res.status(500).json({ error: 'Verification failed: ' + error.message });
      }
    }

    // ---- restore ----
    if (action === 'restore') {
      const { filename, target_db, via, remotePath } = req.body;
      const targetName = target_db && String(target_db).trim();

      try {
        let adapter;
        let type = 'mysql';
        if (bodyConnId && bodyConnId !== 'local') {
          adapter = await createAdapterFromConnection(bodyConnId);
          if (!adapter) return res.status(404).json({ error: 'Connection not found' });
          type = adapter.cfg.type || 'mysql';
        } else {
          adapter = localAdapter();
        }

        if (!targetName) return res.status(400).json({ error: 'Target database name is required' });
        if (!/^[a-zA-Z0-9_-]+$/.test(targetName)) return res.status(400).json({ error: 'Invalid target database name' });

        let result;
        if (via === 'tsql') {
          result = await adapter.restore(targetName, null, { via: 'tsql', remotePath });
        } else {
          if (!filename) return res.status(400).json({ error: 'Filename required' });
          if (filename.includes('..') || filename.includes('/') || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
            return res.status(400).json({ error: 'Invalid filename' });
          }
          const filepath = path.join(BACKUP_DIR, filename);
          if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup not found' });
          if (type !== 'mysql' || bodyConnId) await ensureDatabase(adapter, type, targetName);
          result = await adapter.restore(targetName, filepath);
        }

        return res.status(200).json({
          success: result.errorCount === 0,
          message: summarizeRestore(result, targetName),
          statements: result.statements,
          errorCount: result.errorCount,
          errors: result.errors,
        });
      } catch (error) {
        console.error('Restore error:', error);
        return res.status(400).json({ error: 'Restore failed: ' + error.message });
      }
    }

    // ---- delete ----
    if (action === 'delete') {
      const { filename } = req.body;
      if (!filename) return res.status(400).json({ error: 'Filename required' });
      if (filename.includes('..') || filename.includes('/') || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      const filepath = path.join(BACKUP_DIR, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        return res.status(200).json({ success: true, message: `Deleted ${filename}` });
      }
      return res.status(404).json({ error: 'Backup not found' });
    }

    // ---- cleanup ----
    if (action === 'cleanup') {
      try {
        if (!fs.existsSync(BACKUP_DIR)) return res.status(200).json({ deleted: 0 });
        const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql.gz') || f.endsWith('.sql'));
        let deleted = 0;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        for (const f of files) {
          const fp = path.join(BACKUP_DIR, f);
          const stat = fs.statSync(fp);
          if (stat.mtime < cutoff) {
            fs.unlinkSync(fp);
            deleted++;
          }
        }
        return res.status(200).json({ deleted });
      } catch (error) {
        return res.status(500).json({ error: 'Cleanup failed' });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
