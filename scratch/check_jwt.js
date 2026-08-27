const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cat /var/www/devtrack/.env.local | grep JWT_SECRET`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log(out);
      conn.end();
    }).on('data', (data) => {
      out += data;
    }).stderr.on('data', (data) => {
      out += data;
    });
  });
}).connect({
  host: '103.247.11.248',
  port: 22,
  username: 'root',
  password: 'AB%L6Kz215Rqn#'
});
