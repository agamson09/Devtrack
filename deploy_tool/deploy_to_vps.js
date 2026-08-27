const { Client } = require('ssh2');

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code) => {
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

async function deploy() {
  const conn = new Client();
  conn.on('ready', async () => {
    try {
      await execCommand(conn, `cd /var/www/devtrack && git pull origin main`);
      await execCommand(conn, `cd /var/www/devtrack && npm install`);
      await execCommand(conn, `cd /var/www/devtrack && npm run build`);
      await execCommand(conn, `pm2 restart devtrack`);
      console.log('Deployed to VPS successfully!');
      conn.end();
    } catch (e) {
      console.error(e);
      conn.end();
    }
  }).connect({ host: '103.247.11.248', port: 22, username: 'root', password: 'AB%L6Kz215Rqn#' });
}
deploy();
