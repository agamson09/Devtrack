import { getAuthUser } from '@/lib/auth';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { IncomingForm } from 'formidable';

const BACKUP_DIR = '/var/backups/mysql';
const UPLOAD_DIR = '/var/backups/mysql/uploads';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const form = new IncomingForm({
      uploadDir: UPLOAD_DIR,
      keepExtensions: true,
      maxFileSize: 500 * 1024 * 1024,
    });

    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ files });
      });
    });

    const file = files.file?.[0] || files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const originalName = file.originalFilename || file.newFilename;
    const ext = path.extname(originalName);
    if (ext !== '.sql' && ext !== '.gz') {
      fs.unlinkSync(file.filepath);
      return res.status(400).json({ error: 'Only .sql and .sql.gz files allowed' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetName = `uploaded-${timestamp}-${safeName}`;
    const targetPath = path.join(UPLOAD_DIR, targetName);

    fs.renameSync(file.filepath, targetPath);

    const stat = fs.statSync(targetPath);

    const isGz = targetName.endsWith('.gz');
    const catCmd = isGz ? `gunzip -c "${targetPath}"` : `cat "${targetPath}"`;
    const dumpContent = execSync(catCmd, { timeout: 120000, maxBuffer: 1024 * 1024 * 100 }).toString();

    const tableMatches = dumpContent.match(/CREATE TABLE.*?`(\w+)`/g) || [];
    const tableNames = tableMatches.map(m => {
      const match = m.match(/`(\w+)`/);
      return match ? match[1] : null;
    }).filter(Boolean);

    const viewMatches = dumpContent.match(/CREATE.*VIEW.*?`(\w+)`/g) || [];
    const viewNames = viewMatches.map(m => {
      const match = m.match(/`(\w+)`/);
      return match ? match[1] : null;
    }).filter(Boolean);

    const dbMatch = dumpContent.match(/Current Database.*?`(\w+)`/);
    const dbName = dbMatch ? dbMatch[1] : null;

    let totalRows = 0;
    const rowsPerTable = {};
    const rowPattern = /INSERT INTO.*?`(\w+)`.*?VALUES\s*\(([\s\S]*?)\);\s*$/gm;
    let rowMatch;
    while ((rowMatch = rowPattern.exec(dumpContent)) !== null) {
      const tbl = rowMatch[1];
      const valStr = rowMatch[2];
      const rowCount = (valStr.match(/\),\s*\(/g) || []).length + 1;
      rowsPerTable[tbl] = (rowsPerTable[tbl] || 0) + rowCount;
      totalRows += rowCount;
    }

    let liveTables = [];
    if (dbName) {
      try {
        liveTables = await require('@/lib/db').query(
          `SELECT table_name AS name, table_rows AS row_count FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
          [dbName]
        );
      } catch {}
    }

    const comparison = {};
    if (dbName && liveTables.length > 0) {
      const liveMap = {};
      liveTables.forEach(t => { liveMap[t.name] = t.row_count || 0; });

      const allTableNames = [...new Set([...tableNames, ...Object.keys(liveMap)])];
      for (const t of allTableNames) {
        comparison[t] = {
          in_backup: tableNames.includes(t),
          in_live: !!liveMap[t],
          backup_rows: rowsPerTable[t] || 0,
          live_rows: liveMap[t] || 0,
          match: (rowsPerTable[t] || 0) === (liveMap[t] || 0),
        };
      }
    }

    return res.status(200).json({
      success: true,
      filename: targetName,
      original_name: originalName,
      database: dbName,
      table_count: tableNames.length,
      view_count: viewNames.length,
      total_rows: totalRows,
      rows_per_table: rowsPerTable,
      size_mb: Math.round(stat.size / 1024 / 1024 * 100) / 100,
      size_uncompressed_mb: Math.round(dumpContent.length / 1024 / 1024 * 100) / 100,
      tables: tableNames,
      views: viewNames,
      comparison,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
}
