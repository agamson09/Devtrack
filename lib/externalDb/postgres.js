const fs = require('fs');
const zlib = require('zlib');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const { splitSqlStatements } = require('./splitter');
const { dumpPg } = require('./jsdump');

const MAX_ROWS = 1000;

class PostgresAdapter {
  constructor(cfg) {
    this.cfg = cfg;
  }

  baseConfig(db) {
    return {
      host: this.cfg.host,
      port: Number(this.cfg.port) || 5432,
      user: this.cfg.username,
      password: this.cfg.password,
      database: db || 'postgres',
      connectionTimeoutMillis: 8000,
    };
  }

  async connect(db) {
    const { Client } = require('pg');
    const client = new Client(this.baseConfig(db));
    await client.connect();
    return client;
  }

  async test() {
    const c = await this.connect('postgres');
    try {
      const r = await c.query('SELECT version() AS v');
      const m = String(r.rows[0].v).match(/\(PostgreSQL ([\d.]+)\)/);
      return { ok: true, message: 'PostgreSQL ' + (m ? m[1] : '') };
    } finally {
      await c.end().catch(() => {});
    }
  }

  async listDatabases() {
    const c = await this.connect('postgres');
    try {
      const { rows } = await c.query(`
        SELECT datname AS name,
               ROUND(pg_database_size(datname) / 1048576.0, 2) AS size_mb
        FROM pg_database
        WHERE datistemplate = false AND datallowconn
        ORDER BY datname`);
      return rows.map((r) => ({ name: r.name, size_mb: Number(r.size_mb) || 0, table_count: null }));
    } finally {
      await c.end().catch(() => {});
    }
  }

  async listTables(db) {
    const c = await this.connect(db);
    try {
      const { rows } = await c.query(`
        SELECT relname AS name,
               n_live_tup AS row_count,
               ROUND(pg_relation_size(relid) / 1048576.0, 2) AS data_mb,
               ROUND((pg_total_relation_size(relid) - pg_relation_size(relid)) / 1048576.0, 2) AS index_mb,
               ROUND(pg_total_relation_size(relid) / 1048576.0, 2) AS total_mb,
               NULL AS last_updated
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC`);
      return rows;
    } finally {
      await c.end().catch(() => {});
    }
  }

  async runQuery(db, sqlText) {
    const c = await this.connect(db);
    const started = Date.now();
    try {
      const res = await c.query(sqlText);
      const results = Array.isArray(res) ? res : [res];
      const withRows = [...results].reverse().find((r) => Array.isArray(r.rows));
      const last = results[results.length - 1];
      if (withRows) {
        return {
          columns: withRows.fields.map((f) => f.name),
          rows: withRows.rows.slice(0, MAX_ROWS),
          total_rows: withRows.rows.length,
          truncated: withRows.rows.length > MAX_ROWS,
          duration_ms: Date.now() - started,
        };
      }
      return {
        columns: [], rows: [], total_rows: 0, truncated: false,
        affected: last.rowCount ?? null,
        info: `${last.rowCount ?? 0} row(s) affected`,
        duration_ms: Date.now() - started,
      };
    } finally {
      await c.end().catch(() => {});
    }
  }

  async hasBinary(bin) {
    try {
      await execFileP(bin, ['--version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async backup(db, outPath, opts = {}) {
    const mode = opts.mode || 'auto';
    if (mode === 'binary' || mode === 'auto') {
      if (await this.hasBinary('pg_dump')) {
        await new Promise((resolve, reject) => {
          const proc = spawn('pg_dump', [
            '--host=' + this.cfg.host,
            '--port=' + (Number(this.cfg.port) || 5432),
            '--username=' + this.cfg.username,
            '--no-owner', '--no-privileges',
            '--dbname=' + db,
          ], {
            env: { ...process.env, PGPASSWORD: this.cfg.password },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let errBuf = '';
          proc.stderr.on('data', (d) => { errBuf += d.toString(); });
          proc.on('error', reject);
          proc.on('close', (code) => {
            if (code !== 0) reject(new Error('pg_dump failed: ' + (errBuf.trim() || 'exit ' + code)));
            else resolve();
          });
          proc.stdout.pipe(zlib.createGzip()).pipe(fs.createWriteStream(outPath))
            .on('error', reject);
        });
        return { file: outPath, mode: 'binary' };
      }
      if (mode === 'binary') throw new Error('pg_dump binary not found on this server');
    }
    const c = await this.connect(db);
    try {
      await dumpPg(c, db, outPath);
    } finally {
      await c.end().catch(() => {});
    }
    return { file: outPath, mode: 'js' };
  }

  async restore(db, filePath) {
    if (await this.hasBinary('psql')) {
      const raw = fs.readFileSync(filePath);
      let text;
      try {
        text = zlib.gunzipSync(raw).toString('utf8');
      } catch {
        text = raw.toString('utf8');
      }
      await new Promise((resolve, reject) => {
        const proc = spawn('psql', [
          '--host=' + this.cfg.host,
          '--port=' + (Number(this.cfg.port) || 5432),
          '--username=' + this.cfg.username,
          '--dbname=' + db,
          '--no-psqlrc',
          '--file=-',
        ], {
          env: { ...process.env, PGPASSWORD: this.cfg.password },
          stdio: ['pipe', 'ignore', 'pipe'],
        });
        let errBuf = '';
        proc.stderr.on('data', (d) => { errBuf += d.toString(); });
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code !== 0) reject(new Error('psql failed: ' + (errBuf.trim() || 'exit ' + code)));
          else resolve();
        });
        proc.stdin.write(text);
        proc.stdin.end();
      });
      return { statements: null, errorCount: 0, errors: [], via: 'psql' };
    }

    const raw = fs.readFileSync(filePath);
    let text;
    try {
      text = zlib.gunzipSync(raw).toString('utf8');
    } catch {
      text = raw.toString('utf8');
    }
    const stmts = splitSqlStatements(text);
    const c = await this.connect(db);
    const errors = [];
    try {
      for (const s of stmts) {
        try {
          await c.query(s);
        } catch (e) {
          errors.push((e.message || String(e)).slice(0, 200));
        }
      }
    } finally {
      await c.end().catch(() => {});
    }
    return { statements: stmts.length, errorCount: errors.length, errors: errors.slice(0, 10), via: 'js' };
  }

  async close() {}
}

module.exports = PostgresAdapter;
