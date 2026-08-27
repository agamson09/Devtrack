const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('ssh2');

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

async function createDemoLocal(hashedPassword) {
  console.log('Creating demo account locally...');
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    
    // Create Demo User
    const [result] = await connection.query(
      'INSERT IGNORE INTO users (name, email, password, role, is_approved) VALUES (?, ?, ?, ?, ?)',
      ['Demo User', 'demo@devtrack.local', hashedPassword, 'member', 1]
    );

    if (result.insertId) {
      // Create Tenant for Demo
      const slug = 'demo-workspace-' + Date.now();
      const [tenantRes] = await connection.query(
        'INSERT INTO tenants (name, slug, status) VALUES (?, ?, ?)',
        ['Demo Workspace', slug, 'active']
      );
      await connection.query(
        'UPDATE users SET tenant_id = ?, role = ? WHERE id = ?',
        [tenantRes.insertId, 'admin', result.insertId]
      );
      console.log('Local demo account created.');
    } else {
      console.log('Local demo account already exists.');
    }
    await connection.end();
  } catch (err) {
    console.error('Local creation failed:', err.message);
  }
}

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code) => resolve(out)).on('data', (data) => out += data).stderr.on('data', (data) => out += data);
    });
  });
}

async function createDemoRemote(hashedPassword) {
  console.log('Creating demo account remotely...');
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', async () => {
      try {
        const escapedHash = hashedPassword.replace(/\$/g, '\\$');
        const sql = `
          INSERT IGNORE INTO users (name, email, password, role, is_approved) VALUES ('Demo User', 'demo@devtrack.local', '${escapedHash}', 'member', 1);
          SET @user_id = LAST_INSERT_ID();
          INSERT INTO tenants (name, slug, status) SELECT 'Demo Workspace', CONCAT('demo-workspace-', UNIX_TIMESTAMP()), 'active' WHERE @user_id > 0;
          SET @tenant_id = LAST_INSERT_ID();
          UPDATE users SET tenant_id = @tenant_id, role = 'admin' WHERE id = @user_id AND @user_id > 0;
        `;
        await execCommand(conn, `echo "${sql}" | mysql devtrack`);
        console.log('Remote demo account created.');
      } catch (e) {
        console.error('Remote creation failed:', e.message);
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
  const hashedPassword = await bcrypt.hash('demo123', 10);
  await createDemoLocal(hashedPassword);
  await createDemoRemote(hashedPassword);
  console.log('Done.');
}

run();
