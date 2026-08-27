const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmds = [
    `sed -i 's|NEXT_PUBLIC_APP_URL=http://localhost:3000|NEXT_PUBLIC_APP_URL=https://devtrack.agamlabs.cloud|g' /var/www/devtrack/.env.local`,
    `sed -i 's|NEXT_PUBLIC_WS_URL=http://localhost:3000|NEXT_PUBLIC_WS_URL=https://devtrack.agamlabs.cloud|g' /var/www/devtrack/.env.local`,
    `cd /var/www/devtrack && npm run build`,
    `cd /var/www/devtrack && pm2 restart devtrack`
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
