const { Client } = require('ssh2');

const host = '103.247.11.248';
const username = 'root';
const password = 'AB%L6Kz215Rqn#';
const remotePath = '/var/www/devtrack';

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

async function fix() {
  const conn = new Client();
  conn.on('ready', async () => {
    try {
      await execCommand(conn, `cd ${remotePath} && pm2 delete devtrack`);
      await execCommand(conn, `cd ${remotePath} && pm2 start server.js --name "devtrack"`);
      await execCommand(conn, `pm2 save`);
      console.log('Fixed PM2 process!');
      conn.end();
    } catch (e) {
      console.error(e);
      conn.end();
    }
  }).connect({ host, port: 22, username, password });
}
fix();
