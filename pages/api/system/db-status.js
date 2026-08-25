import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const dbName = process.env.DB_NAME || 'devtrack';
  const result = { mysql: false, dbExists: false, tablesReady: false, tableCount: 0, userCount: 0, dbName };

  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      connectTimeout: 4000,
    });
    result.mysql = true;

    const [ver] = await conn.query('SELECT VERSION() AS v');
    result.mysqlVersion = ver[0]?.v || null;

    const [dbs] = await conn.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbName]
    );
    result.dbExists = dbs.length > 0;

    if (result.dbExists) {
      const [t] = await conn.query(
        'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ?',
        [dbName]
      );
      result.tableCount = t[0].c;
      result.tablesReady = result.tableCount > 0;
      try {
        const [u] = await conn.query(`SELECT COUNT(*) AS c FROM \`${dbName}\`.users`);
        result.userCount = u[0].c;
      } catch {}
    }
    await conn.end();
  } catch (e) {
    result.error = e.code || 'DB_ERROR';
  }

  result.ready = result.tablesReady && result.userCount > 0;
  return res.status(200).json(result);
}
