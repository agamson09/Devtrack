const fs = require('fs');
const path = require('path');
const os = require('os');
const { decryptSecret } = require('../vaultCrypto');
const MysqlAdapter = require('./mysql');
const PostgresAdapter = require('./postgres');
const MssqlAdapter = require('./mssql');

// Backup storage directory — portable across OS (env-overridable).
function getBackupDir() {
  const dir = process.env.BACKUP_DIR
    || (process.platform === 'win32'
      ? path.join(os.tmpdir(), 'devtrack-backups')
      : '/var/backups/mysql');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Build a ready-to-use adapter from a db_connections row (password decrypted
// server-side only — never sent to clients).
async function createAdapterFromConnection(connectionId) {
  const db = require('../db');
  const row = await db.queryOne('SELECT * FROM db_connections WHERE id = ?', [connectionId]);
  if (!row) return null;
  const cfg = {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    username: row.username,
    password: decryptSecret(row.password_enc),
    type: row.type || 'mysql',
  };
  return createAdapter(cfg);
}

function createAdapter(cfg) {
  switch (String(cfg.type || 'mysql').toLowerCase()) {
    case 'postgres':
      return new PostgresAdapter(cfg);
    case 'mssql':
      return new MssqlAdapter(cfg);
    default:
      return new MysqlAdapter(cfg);
  }
}

function backupFileName(type, connectionId, dbName, ext = '.sql.gz') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${type}-conn${connectionId}-${String(dbName).replace(/[^\w.-]/g, '_')}-${stamp}${ext}`;
}

module.exports = { createAdapter, createAdapterFromConnection, getBackupDir, backupFileName };
