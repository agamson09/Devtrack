const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`mysql -u root -pAleale2209! -e "SHOW DATABASES LIKE '%_devtrack';"`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      const dbs = out.split('\n').filter(d => d.trim() && !d.includes('Database') && d.trim() !== 'devtrack');
      
      let count = 0;
      if (dbs.length === 0) {
        conn.end();
        return;
      }
      
      dbs.forEach(db => {
        const dbName = db.trim();
        conn.exec(`mysql -u root -pAleale2209! -D ${dbName} -e "DELETE FROM users WHERE email IN ('admin@devtrack.local', 'dev1@devtrack.local');"`, (err, stream2) => {
          stream2.on('close', () => {
            console.log(`Cleaned ${dbName}`);
            count++;
            if (count === dbs.length) conn.end();
          });
        });
      });
    });
  });
}).connect({
  host: '103.247.11.248',
  port: 22,
  username: 'root',
  password: 'AB%L6Kz215Rqn#'
});
