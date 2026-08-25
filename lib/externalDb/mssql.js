const fs = require('fs');
const zlib = require('zlib');
const { splitSqlStatements, splitMssqlBatches } = require('./splitter');
const { dumpMssql } = require('./jsdump');

const MAX_ROWS = 1000;
const SYSTEM_DBS = new Set(['master', 'tempdb', 'model', 'msdb']);

class MssqlAdapter {
  constructor(cfg) {
    this.cfg = cfg;
    this.pool = null;
  }

  async connect(db) {
    const mssql = require('mssql');
    const pool = new mssql.ConnectionPool({
      server: this.cfg.host,
      port: Number(this.cfg.port) || 1433,
      user: this.cfg.username,
      password: this.cfg.password,
      database: db || 'master',
      connectionTimeout: 8000,
      requestTimeout: 120000,
      options: { encrypt: false, trustServerCertificate: true },
    });
    await pool.connect();
    return pool;
  }

  async test() {
    const pool = await this.connect('master');
    try {
      const r = await pool.request().query('SELECT @@VERSION AS v');
      const m = String(r.recordset[0].v).match(/Microsoft SQL Server[^\n]*/i);
      return { ok: true, message: (m ? m[0] : 'SQL Server').slice(0, 80) };
    } finally {
      await pool.close().catch(() => {});
    }
  }

  async listDatabases() {
    const pool = await this.connect('master');
    try {
      const r = await pool.request().query(`
        SELECT d.name AS name,
               ROUND(CAST(SUM(CAST(mf.size AS BIGINT)) * 8 / 1024.0 AS FLOAT), 2) AS size_mb
        FROM sys.databases d
        JOIN sys.master_files mf ON d.database_id = mf.database_id AND mf.type = 0
        GROUP BY d.name ORDER BY d.name`);
      return r.recordset
        .filter((x) => !SYSTEM_DBS.has(x.name))
        .map((x) => ({ name: x.name, size_mb: Number(x.size_mb) || 0, table_count: null }));
    } finally {
      await pool.close().catch(() => {});
    }
  }

  async listTables(db) {
    const pool = await this.connect(db);
    try {
      const r = await pool.request().query(`
        SELECT t.name AS name,
               SUM(p.rows) AS row_count,
               NULL AS data_mb, NULL AS index_mb,
               ROUND(CAST(SUM(a.total_pages) * 8 / 1024.0 AS FLOAT), 2) AS total_mb,
               NULL AS last_updated
        FROM sys.tables t
        JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
        JOIN sys.allocation_units a ON p.partition_id = a.partition_id
        GROUP BY t.name ORDER BY total_mb DESC`);
      return r.recordset;
    } finally {
      await pool.close().catch(() => {});
    }
  }

  async runQuery(db, sqlText) {
    const pool = await this.connect(db);
    const started = Date.now();
    try {
      const r = await pool.request().batch(sqlText);
      if (r.recordset) {
        return {
          columns: r.recordset.columns ? Object.keys(r.recordset.columns) : [],
          rows: r.recordset.slice(0, MAX_ROWS),
          total_rows: r.recordset.length,
          truncated: r.recordset.length > MAX_ROWS,
          duration_ms: Date.now() - started,
        };
      }
      return {
        columns: [], rows: [], total_rows: 0, truncated: false,
        affected: r.rowsAffected ? r.rowsAffected.reduce((a, b) => a + b, 0) : null,
        info: 'Batch executed',
        duration_ms: Date.now() - started,
      };
    } finally {
      await pool.close().catch(() => {});
    }
  }

  // T-SQL backup writes the .bak to the SQL Server's own filesystem.
  async backupTsql(db, remotePath) {
    if (!remotePath) throw new Error('remotePath is required for T-SQL backup (path on the SQL Server host)');
    const pool = await this.connect('master');
    try {
      const safeDb = db.replace(/]/g, ']]');
      const safePath = String(remotePath).replace(/'/g, "''");
      await pool.request().query(`BACKUP DATABASE [${safeDb}] TO DISK = N'${safePath}' WITH INIT`);
      return { file: remotePath, mode: 'tsql', note: 'Backup file is stored on the SQL Server host, not on the DevTrack server.' };
    } finally {
      await pool.close().catch(() => {});
    }
  }

  async restoreTsql(db, remotePath) {
    if (!remotePath) throw new Error('remotePath is required for T-SQL restore (path on the SQL Server host)');
    const pool = await this.connect('master');
    try {
      const safeDb = db.replace(/]/g, ']]');
      const safePath = String(remotePath).replace(/'/g, "''");
      await pool.request().query(`RESTORE DATABASE [${safeDb}] FROM DISK = N'${safePath}' WITH REPLACE`);
      return { statements: null, errorCount: 0, errors: [], via: 'tsql' };
    } finally {
      await pool.close().catch(() => {});
    }
  }

  async backup(db, outPath, opts = {}) {
    const mode = opts.mode || 'js';
    if (mode === 'tsql') return this.backupTsql(db, opts.remotePath);
    const pool = await this.connect(db);
    try {
      await dumpMssql(pool, db, outPath);
    } finally {
      await pool.close().catch(() => {});
    }
    return { file: outPath, mode: 'js' };
  }

  async restore(db, filePath, opts = {}) {
    if (opts.via === 'tsql') return this.restoreTsql(db, opts.remotePath);
    const raw = fs.readFileSync(filePath);
    let text;
    try {
      text = zlib.gunzipSync(raw).toString('utf8');
    } catch {
      text = raw.toString('utf8');
    }
    const batches = splitMssqlBatches(text);
    const pool = await this.connect('master');
    const errors = [];
    let executed = 0;
    try {
      for (const batch of batches) {
        for (const s of splitSqlStatements(batch)) {
          try {
            await pool.request().batch(s);
            executed++;
          } catch (e) {
            errors.push((e.message || String(e)).slice(0, 200));
          }
        }
      }
    } finally {
      await pool.close().catch(() => {});
    }
    return { statements: executed, errorCount: errors.length, errors: errors.slice(0, 10), via: 'js' };
  }

  async close() {}
}

module.exports = MssqlAdapter;
