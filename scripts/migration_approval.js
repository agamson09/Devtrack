const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  });
}
const mysql = require('mysql2/promise');
const { Client } = require('ssh2');

async function migrateLocal() {
  console.log('Migrating local database...');
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    
    console.log('Connected to local DB. Adding is_approved column...');
    try {
      await connection.query('ALTER TABLE users ADD COLUMN is_approved TINYINT(1) DEFAULT 0');
      console.log('Column added locally.');
      await connection.query('UPDATE users SET is_approved = 1');
      console.log('Existing users approved locally.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('Column is_approved already exists locally.');
      } else {
        throw e;
      }
    }
    
    await connection.end();
  } catch (err) {
    console.error('Local migration failed:', err);
  }
}

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code) => {
        resolve(out);
      }).on('data', (data) => {
        out += data;
      }).stderr.on('data', (data) => {
        out += data;
      });
    });
  });
}

async function migrateRemote() {
  console.log('Migrating remote database...');
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', async () => {
      console.log('SSH connected.');
      try {
        const sql = `ALTER TABLE users ADD COLUMN is_approved TINYINT(1) DEFAULT 0; UPDATE users SET is_approved = 1;`;
        await execCommand(conn, `echo "${sql}" | mysql devtrack`);
        console.log('Remote migration applied.');
      } catch (e) {
        console.error('Remote migration failed or already applied:', e.message);
      }
      conn.end();
      resolve();
    }).on('error', (err) => {
      console.error('SSH Error:', err);
      resolve();
    }).connect({
      host: '103.247.11.248',
      port: 22,
      username: 'root',
      password: 'AB%L6Kz215Rqn#'
    });
  });
}

async function run() {
  await migrateLocal();
  await migrateRemote();
  console.log('Migration complete.');
}

run();
