// Pure-JS backup engine — generates .sql.gz dumps without external binaries.
// mysql: full dump (DDL + data). postgres/mssql: data-only (INSERT statements),
// since scripting DDL portably without native tools is unreliable.

const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

function openGzip(outPath) {
  const gz = zlib.createGzip();
  const out = fs.createWriteStream(outPath);
  gz.pipe(out);
  const write = (s) => new Promise((resolve, reject) => gz.write(s, (err) => (err ? reject(err) : resolve())));
  const finish = () => new Promise((resolve, reject) => {
    gz.end();
    out.on('finish', resolve);
    out.on('error', reject);
  });
  return { write, finish, out };
}

function sqlLiteralMysql(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return "'" + v.toISOString().slice(0, 19).replace('T', ' ') + "'";
  if (Buffer.isBuffer(v)) return "X'" + v.toString('hex') + "'";
  if (typeof v === 'object') v = JSON.stringify(v);
  return "'" + String(v)
    .replace(/\\/g, '\\\\')
    .replace(/\x00/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z')
    .replace(/'/g, "\\'") + "'";
}

function sqlLiteralPg(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlLiteralMssql(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) return `'${v.toISOString().slice(0, 23)}'`;
  if (Buffer.isBuffer(v)) return `CONVERT(VARBINARY(MAX), '${v.toString('hex')}', 2)`;
  if (typeof v === 'object') return `N'${JSON.stringify(v).replace(/'/g, "''")}'`;
  if (typeof v === 'number') return String(v);
  return `N'${String(v).replace(/'/g, "''")}'`;
}

const BATCH = 100;

async function dumpMysql(conn, dbName, outPath) {
  const { write, finish } = openGzip(outPath);
  await write(`-- DevTrack JS backup (full DDL+data)\n-- Database: ${dbName}\n-- Generated: ${new Date().toISOString()}\n\nSET FOREIGN_KEY_CHECKS=0;\n\n`);
  const [tables] = await conn.query('SHOW FULL TABLES WHERE Table_type = \'BASE TABLE\'');
  const tableKey = `Tables_in_${dbName}`;
  for (const t of tables) {
    const name = t[tableKey];
    const ident = `\`${String(name).replace(/`/g, '``')}\``;
    const [createRows] = await conn.query(`SHOW CREATE TABLE ${ident}`);
    await write(`DROP TABLE IF EXISTS ${ident};\n${createRows[0]['Create Table']};\n\n`);
    let batch = [];
    const rawConn = conn.connection || conn;
    const q = rawConn.query(`SELECT * FROM ${ident}`);
    await new Promise((resolve, reject) => {
      q.on('result', (row) => {
        batch.push('(' + Object.values(row).map((v) => sqlLiteralMysql(v)).join(', ') + ')');
        if (batch.length >= BATCH) {
          const sql = `INSERT INTO ${ident} VALUES\n` + batch.join(',\n') + ';\n';
          batch = [];
          write(sql).catch(reject);
        }
      });
      q.on('end', resolve);
      q.on('error', reject);
    });
    if (batch.length) await write(`INSERT INTO ${ident} VALUES\n` + batch.join(',\n') + ';\n');
    await write('\n');
  }
  const [views] = await conn.query('SHOW FULL TABLES WHERE Table_type = \'VIEW\'');
  for (const v of views) {
    const name = v[tableKey];
    const ident = `\`${String(name).replace(/`/g, '``')}\``;
    const [vr] = await conn.query(`SHOW CREATE VIEW ${ident}`);
    await write(`DROP VIEW IF EXISTS ${ident};\nSET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='';\n${vr[0]['Create View']};\nSET SQL_MODE=@OLD_SQL_MODE;\n\n`);
  }
  await write('SET FOREIGN_KEY_CHECKS=1;\n');
  await finish();
}

async function dumpPg(client, dbName, outPath) {
  const { write, finish } = openGzip(outPath);
  await write(`-- DevTrack JS backup (data-only)\n-- Database: ${dbName}\n-- Generated: ${new Date().toISOString()}\n-- NOTE: schema/DDL not included — use pg_dump for a full dump.\n\nSET session_replication_role = replica;\n\n`);
  const { rows: tables } = await client.query(
    `SELECT relname AS name FROM pg_stat_user_tables ORDER BY relname`
  );
  for (const t of tables) {
    const ident = '"' + String(t.name).replace(/"/g, '""') + '"';
    const { rows: cols } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [t.name]
    );
    const colList = cols.map((c) => '"' + c.column_name.replace(/"/g, '""') + '"').join(', ');
    const { rows } = await client.query(`SELECT * FROM ${ident}`);
    if (!rows.length) continue;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const values = chunk
        .map((row) => '(' + cols.map((c) => sqlLiteralPg(row[c.column_name])).join(', ') + ')')
        .join(',\n');
      await write(`INSERT INTO ${ident} (${colList}) VALUES\n${values};\n`);
    }
    await write('\n');
  }
  await write('SET session_replication_role = DEFAULT;\n');
  await finish();
}

async function dumpMssql(pool, dbName, outPath) {
  const { write, finish } = openGzip(outPath);
  await write(`-- DevTrack JS backup (data-only)\n-- Database: ${dbName}\n-- Generated: ${new Date().toISOString()}\n-- NOTE: schema/DDL not included — use BACKUP DATABASE for a full backup.\n\n`);
  const { recordset: tables } = await pool.request().query(`
    SELECT t.name FROM sys.tables t
    JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
    GROUP BY t.name ORDER BY t.name`);
  for (const t of tables) {
    const ident = '[' + String(t.name).replace(/]/g, ']]') + ']';
    const { recordset: cols } = await pool.request().query(`
      SELECT c.name, ty.name AS type_name FROM sys.columns c
      JOIN sys.types ty ON c.user_type_id = ty.user_type_id
      WHERE c.object_id = OBJECT_ID('${String(dbName).replace(/'/g, "''")}.dbo.${String(t.name).replace(/'/g, "''")}')
      ORDER BY c.column_id`);
    const colList = cols.map((c) => '[' + c.name.replace(/]/g, ']]') + ']').join(', ');
    const { recordset: rows } = await pool.request().query(`SELECT * FROM ${ident}`);
    if (!rows.length) continue;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const values = chunk
        .map((row) => '(' + cols.map((c) => sqlLiteralMssql(row[c.name])).join(', ') + ')')
        .join(',\n');
      await write(`INSERT INTO ${ident} (${colList}) VALUES\n${values};\n`);
    }
    await write('\n');
  }
  await finish();
}

module.exports = { dumpMysql, dumpPg, dumpMssql, pipeline };
