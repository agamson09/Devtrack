const fs = require('fs');
const zlib = require('zlib');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { splitSqlStatements, stripMysqlDelimiterBlocks } = require('./splitter');
const { dumpMysql } = require('./jsdump');

const MAX_ROWS = 1000;
const SYSTEM_DBS = new Set(['information_schema', 'performance_schema', 'mysql', 'sys']);

class MysqlAdapter {
  constructor(cfg) {
    this.cfg = cfg; // { id, name, host, port, username, password }
  }

  async connect(db) {
    return require('mysql2/promise').createConnection({
      host: this.cfg.host,
      port: Number(this.cfg.port) || 3306,
      user: this.cfg.username,
      password: this.cfg.password,
      database: db || undefined,
      connectTimeout: 8000,
    });
  }

  async test() {
    const c = await this.connect();
    try {
      const [r] = await c.query('SELECT VERSION() AS v');
      return { ok: true, message: 'MySQL ' + r[0].v };
    } finally {
      await c.end().catch(() => {});
    }
  }

  async listDatabases() {
    const c = await this.connect();
    try {
      const [rows] = await c.query(`
        SELECT table_schema AS name,
               ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb,
               COUNT(*) AS table_count
        FROM information_schema.tables
        GROUP BY table_schema ORDER BY table_schema`);
      return rows
        .filter((r) => !SYSTEM_DBS.has(r.name))
        .map((r) => ({ name: r.name, size_mb: Number(r.size_mb) || 0, table_count: Number(r.table_count) || 0 }));
    } finally {
      await c.end().catch(() => {});
    }
  }

  async listTables(db) {
    const c = await this.connect();
    try {
      const [rows] = await c.query(
        `SELECT table_name AS name, table_rows AS row_count,
                ROUND(data_length / 1024 / 1024, 2) AS data_mb,
                ROUND(index_length / 1024 / 1024, 2) AS index_mb,
                ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_mb,
                update_time AS last_updated
         FROM information_schema.tables
         WHERE table_schema = ? ORDER BY (data_length + index_length) DESC`,
        [db]
      );
      return rows;
    } finally {
      await c.end().catch(() => {});
    }
  }

  async runQuery(db, sqlText) {
    const c = await this.connect(db);
    const started = Date.now();
    try {
      const [result] = await c.query(sqlText);
      if (!Array.isArray(result)) {
        return {
          columns: [], rows: [], total_rows: 0, truncated: false,
          affected: result.affectedRows ?? null,
          info: result.info || `${result.affectedRows ?? 0} row(s) affected`,
          duration_ms: Date.now() - started,
        };
      }
      return {
        columns: result.length ? Object.keys(result[0]) : [],
        rows: result.slice(0, MAX_ROWS),
        total_rows: result.length,
        truncated: result.length > MAX_ROWS,
        duration_ms: Date.now() - started,
      };
    } finally {
      await c.end().catch(() => {});
    }
  }

  async hasBinary() {
    try {
      await execFileP('mysqldump', ['--version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async binaryDump(db, outPath) {
    const args = [
      '--host=' + this.cfg.host,
      '--port=' + (Number(this.cfg.port) || 3306),
      '--user=' + this.cfg.username,
      '--single-transaction', '--quick',
      db,
    ];
    await new Promise((resolve, reject) => {
      const proc = spawn('mysqldump', args, {
        env: { ...process.env, MYSQL_PWD: this.cfg.password },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let errBuf = '';
      proc.stderr.on('data', (d) => { errBuf += d.toString(); });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0) reject(new Error('mysqldump failed: ' + (errBuf.trim() || 'exit ' + code)));
        else resolve();
      });
      proc.stdout.pipe(zlib.createGzip()).pipe(fs.createWriteStream(outPath))
        .on('finish', () => {})
        .on('error', reject);
    });
    return { file: outPath, mode: 'binary' };
  }

  async backup(db, outPath, opts = {}) {
    const mode = opts.mode || 'auto';
    if (mode === 'binary' || mode === 'auto') {
      if (await this.hasBinary()) return this.binaryDump(db, outPath);
      if (mode === 'binary') throw new Error('mysqldump binary not found on this server');
    }
    const c = await this.connect(db);
    try {
      await c.query('USE `' + String(db).replace(/`/g, '``') + '`');
      await dumpMysql(c, db, outPath);
    } finally {
      await c.end().catch(() => {});
    }
    return { file: outPath, mode: 'js' };
  }

  async restore(db, filePath) {
    const raw = fs.readFileSync(filePath);
    let text;
    try {
      text = zlib.gunzipSync(raw).toString('utf8');
    } catch {
      text = raw.toString('utf8');
    }
    const stmts = splitSqlStatements(stripMysqlDelimiterBlocks(text));
    const c = await this.connect(db);
    const errors = [];
    try {
      await c.query('SET FOREIGN_KEY_CHECKS=0');
      for (const s of stmts) {
        try {
          await c.query(s);
        } catch (e) {
          errors.push((e.sqlMessage || e.message).slice(0, 200));
        }
      }
      await c.query('SET FOREIGN_KEY_CHECKS=1');
    } finally {
      await c.end().catch(() => {});
    }
    return { statements: stmts.length, errorCount: errors.length, errors: errors.slice(0, 10) };
  }

  async close() {}
}

module.exports = MysqlAdapter;
