const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`mysql -u root -p'Aleale2209!' test_s_workspace_devtrack -e "SELECT * FROM tenant_users;"`, (err, stream) => {
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
