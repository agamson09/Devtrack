import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

// In-memory throttle: max 5 setup runs per 10 minutes
let attempts = [];

// Performance-tuning file uses DELIMITER/PROCEDURE syntax — not safe for
// statement-splitting, so it is skipped (run it manually if desired).
const SKIPPED_MIGRATIONS = ['add_performance_indexes.sql'];

// Migrations with FK/table dependencies — must run in this order:
// workspace_schema creates `messages` (needed by group_chat & chat_features),
// tenants precedes workspace_databases (FK), sftp_management creates
// `remote_deploy_configs` (needed by multihost).
const ORDERED_MIGRATIONS = [
  'scripts/workspace_schema_migration.sql',
  'scripts/messages_upgrade_migration.sql',
  'scripts/group_chat_migration.sql',
  'scripts/tenant_migration.sql',
  'scripts/tenant_users_migration.sql',
  'scripts/workspace_db_migration.sql',
  'scripts/sftp_management_migration.sql',
  'scripts/multihost_migration.sql',
];

// Must run LAST: approval_migration adds columns positioned AFTER `progress`,
// which is itself added by gantt_migration (alphabetically later).
const TAIL_MIGRATIONS = ['scripts/approval_migration.sql'];

// MySQL 8 does not support `IF NOT EXISTS` on ADD COLUMN / ADD INDEX /
// CREATE INDEX (MariaDB-only syntax) — strip it and rely on tolerant
// duplicate-error handling instead. Also drops standalone USE statements
// since the connection already selected the target database.
function normalizeStatement(stmt) {
  if (/^USE\s/i.test(stmt)) return null;
  stmt = stmt.replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi, 'ADD COLUMN');
  stmt = stmt.replace(/ADD\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/gi, (m, u) => `ADD ${u || ''}INDEX`);
  stmt = stmt.replace(/CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/gi, (m, u) => `CREATE ${u || ''}INDEX`);
  return stmt;
}

// Tables the app critically depends on beyond schema.sql
const CRITICAL_TABLES = [
  'users', 'projects', 'tasks', 'task_comments', 'messages', 'notifications',
  'login_attempts', 'security_logs', 'tenants', 'workspace_databases', 'wiki_notes', 'chat_groups',
];

function splitSqlStatements(sql) {
  const lines = sql.split('\n').filter((l) => {
    const t = l.trim();
    return !(t.startsWith('--') || t.startsWith('#'));
  });
  const src = lines.join('\n');
  const stmts = [];
  let cur = '';
  let inS = false, inD = false, inB = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'" && !inD && !inB) {
      if (inS && src[i + 1] === "'") { cur += "''"; i++; continue; }
      inS = !inS;
    } else if (ch === '"' && !inS && !inB) {
      inD = !inD;
    } else if (ch === '`' && !inS && !inD) {
      inB = !inB;
    } else if (ch === '\\' && (inS || inD)) {
      cur += ch + (src[i + 1] || '');
      i++;
      continue;
    }
    if (ch === ';' && !inS && !inD && !inB) {
      if (cur.trim()) stmts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) stmts.push(cur.trim());
  return stmts;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = Date.now();
  attempts = attempts.filter((t) => now - t < 10 * 60 * 1000);
  if (attempts.length >= 5) {
    return res.status(429).json({ error: 'Too many setup attempts. Try again in a few minutes.' });
  }
  attempts.push(now);

  const { adminName, adminEmail, adminPassword } = req.body || {};
  const wantsCustomAdmin = Boolean(adminEmail || adminPassword || adminName);
  if (wantsCustomAdmin) {
    if (!adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'Name, email, and password are all required to create a custom admin.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return res.status(400).json({ error: 'Invalid admin email address.' });
    }
    if (String(adminPassword).length < 8) {
      return res.status(400).json({ error: 'Admin password must be at least 8 characters.' });
    }
  }

  const dbName = process.env.DB_NAME || 'devtrack';
  const safeDb = dbName.replace(/[^a-zA-Z0-9_]/g, '');

  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: false,
      connectTimeout: 8000,
    });

    // Refuse when setup was already completed (safety for public deployments)
    const [dbs] = await conn.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbName]
    );
    if (dbs.length > 0) {
      try {
        const [u] = await conn.query(`SELECT COUNT(*) AS c FROM \`${safeDb}\`.users`);
        if (u[0].c > 0) {
          return res.status(409).json({ error: 'Setup already completed — the database already has users.' });
        }
      } catch {}
    }

    // 1) Base schema (strip its hardcoded CREATE DATABASE / USE header)
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      return res.status(500).json({ error: 'schema.sql not found in project root.' });
    }
    let schemaSql = fs.readFileSync(schemaPath, 'utf8')
      .replace(/^\s*CREATE DATABASE[^;]*;\s*/i, '')
      .replace(/^\s*USE\s+[^;]*;\s*/i, '');

    // 2) Collect migration files (ordered deps first, then the rest alphabetically)
    const scriptsDir = path.join(process.cwd(), 'scripts');
    const migrationFiles = [...ORDERED_MIGRATIONS];
    if (fs.existsSync(scriptsDir)) {
      const orderedBasenames = new Set(ORDERED_MIGRATIONS.map((f) => path.basename(f)));
      migrationFiles.push(
        ...fs.readdirSync(scriptsDir)
          .filter((f) => f.endsWith('.sql') && !SKIPPED_MIGRATIONS.includes(f) && !orderedBasenames.has(f))
          .sort()
          .map((f) => path.join('scripts', f))
      );
    }
    if (fs.existsSync(path.join(process.cwd(), 'wiki_migration.sql'))) {
      migrationFiles.push('wiki_migration.sql');
    }
    if (fs.existsSync(path.join(process.cwd(), 'wiki_seed.sql'))) {
      migrationFiles.push('wiki_seed.sql');
    }
    // Tail migrations run after everything else (column-position dependencies)
    for (const f of TAIL_MIGRATIONS) {
      const base = path.basename(f);
      const idx = migrationFiles.findIndex((m) => path.basename(m) === base);
      if (idx !== -1) migrationFiles.splice(idx, 1);
      migrationFiles.push(f);
    }

    // 3) Read ALL SQL into memory FIRST — if any file is missing we fail
    //    here, before touching the database (no half-created empty DB).
    const warnings = [];
    let statementsRun = 0;
    const allSql = [{ name: 'schema.sql', sql: schemaSql }, ...migrationFiles.map((f) => ({
      name: f,
      sql: fs.readFileSync(path.join(process.cwd(), f), 'utf8'),
    }))];

    // 4) Create DB and run everything statement-by-statement, tolerating
    //    "already exists" style errors so the flow is idempotent.
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${safeDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${safeDb}\``);

    for (const file of allSql) {
      for (const rawStmt of splitSqlStatements(file.sql)) {
        const stmt = normalizeStatement(rawStmt);
        if (!stmt) continue;
        try {
          await conn.query(stmt);
          statementsRun++;
        } catch (e) {
          const benign = [1050, 1054, 1060, 1061, 1062, 1091, 1146].includes(e.errno);
          if (!benign) {
            warnings.push(`${file.name}: [${e.errno}] ${e.sqlMessage || e.message}`.slice(0, 200));
          }
        }
      }
    }

    // 4) Optional custom admin (replaces the well-known seeded default)
    let adminCreated = false;
    if (wantsCustomAdmin) {
      const hash = await bcrypt.hash(adminPassword, 10);
      const email = String(adminEmail).toLowerCase().trim();
      await conn.query(
        `INSERT INTO \`${safeDb}\`.users (name, email, password, role) VALUES (?, ?, ?, 'admin')`,
        [adminName.trim(), email, hash]
      );
      await conn.query(`DELETE FROM \`${safeDb}\`.users WHERE email = 'admin@devtrack.local' AND email != ?`, [email]);
      adminCreated = true;
    }

    // 5) Verify critical tables exist
    const [tbls] = await conn.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
      [dbName]
    );
    const existing = new Set(tbls.map((r) => r.table_name || r.TABLE_NAME));
    const missing = CRITICAL_TABLES.filter((t) => !existing.has(t));

    return res.status(200).json({
      ok: missing.length === 0,
      dbName,
      statementsRun,
      tableCount: existing.size,
      missingTables: missing,
      warnings: warnings.slice(0, 10),
      adminCreated,
      defaultAdmin: !adminCreated,
      message: adminCreated
        ? 'Database initialized and custom admin created.'
        : 'Database initialized with default admin (admin@devtrack.local / password).',
    });
  } catch (e) {
    return res.status(500).json({ error: e.code ? `${e.code}: ${e.message}` : e.message });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}
