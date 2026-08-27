const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmds = [
    `cd /var/www/devtrack && pm2 delete devtrack`,
    `cd /var/www/devtrack && NODE_ENV=production pm2 start server.js --name "devtrack"`,
    `pm2 save`
  ].join(' && ');

  console.log('Running remote commands...');
  conn.exec(cmds, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('Finished with code', code);
      console.log(out);
      conn.end();
    }).on('data', (data) => {
      out += data;
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      out += data;
      process.stderr.write(data);
    });
  });
}).connect({
  host: '103.247.11.248',
  port: 22,
  username: 'root',
  password: 'AB%L6Kz215Rqn#'
});
