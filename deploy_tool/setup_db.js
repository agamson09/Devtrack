const { Client } = require('ssh2');

const host = '103.247.11.248';
const username = 'root';
const password = 'AB%L6Kz215Rqn#';
const remotePath = '/var/www/devtrack';

function execCommand(conn, cmd, ignoreError = false) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code, signal) => {
        if (code !== 0 && !ignoreError) {
            return reject(new Error(`Command failed with code ${code}: ${out}`));
        }
        resolve(out);
      }).on('data', (data) => {
        out += data;
        process.stdout.write(data);
      }).stderr.on('data', (data) => {
        out += data;
        process.stderr.write(data);
      });
    });
  });
}

const envContent = `
# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Aleale2209!
DB_NAME=devtrack

# JWT
JWT_SECRET=DvTr@2026!SecureKey!9xM4pQ7wZ#LcRnBt
JWT_EXPIRES_IN=7d

# App
NEXT_PUBLIC_APP_URL=https://devtrack.agamlabs.cloud
NEXT_PUBLIC_WS_URL=https://devtrack.agamlabs.cloud
NODE_ENV=production

# Push Notifications VAPID
VAPID_PUBLIC_KEY=BBeyaenvM8Kh4yxUleDZWm24hq31DE3k3vvcbg8jAvMAyMXdiGte7uDDIMICXZA_w2iz9xgLgFLjZcyChxs810Q
VAPID_PRIVATE_KEY=Ki0AeY8tQagcgCYdBzOFtShNFZ-wTyOaotUwvLQdho4
VAPID_SUBJECT=mailto:admin@it.lelco.net
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BBeyaenvM8Kh4yxUleDZWm24hq31DE3k3vvcbg8jAvMAyMXdiGte7uDDIMICXZA_w2iz9xgLgFLjZcyChxs810Q
`;

async function setup() {
  console.log('Connecting via SSH...');
  const conn = new Client();
  
  conn.on('ready', async () => {
    console.log('SSH Connection ready.');
    try {
      // 1. Install MySQL
      await execCommand(conn, 'apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server');
      await execCommand(conn, 'systemctl enable mysql && systemctl start mysql');
      
      // 2. Configure MySQL
      // Set root password, create db
      const sqlCommands = `
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Aleale2209!';
CREATE DATABASE IF NOT EXISTS devtrack;
FLUSH PRIVILEGES;
`;
      await execCommand(conn, `echo "${sqlCommands.replace(/"/g, '\\"')}" | mysql`);
      
      // 3. Write .env.local
      // Escape dollar signs and backticks in case there are any, though envContent here has none
      await execCommand(conn, `cat << 'EOF' > ${remotePath}/.env.local\n${envContent}\nEOF`);
      
      // 4. Restart the app to pick up .env changes
      console.log('Restarting PM2 devtrack service...');
      await execCommand(conn, `cd ${remotePath} && npm run build || true`, true); // rebuild just in case env vars changed for frontend
      await execCommand(conn, `pm2 restart devtrack`);
      
      console.log('Database setup complete!');
      conn.end();
    } catch (err) {
      console.error('Error during setup:', err);
      conn.end();
    }
  }).on('error', (err) => {
    console.error('SSH Connection error:', err);
  }).connect({
    host: host,
    port: 22,
    username: username,
    password: password,
    keepaliveInterval: 10000
  });
}

setup();
