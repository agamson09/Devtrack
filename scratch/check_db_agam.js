const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`mysql -u root -p'Aleale2209!' devtrack -e "SELECT id, sender_id, receiver_id, message FROM messages WHERE (sender_id=1 AND receiver_id=4) OR (sender_id=4 AND receiver_id=1) ORDER BY id DESC LIMIT 10"`, (err, stream) => {
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
