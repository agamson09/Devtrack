const { Client } = require('ssh2');
const bcrypt = require('bcryptjs');

const conn = new Client();
conn.on('ready', async () => {
  const hashedPassword = await bcrypt.hash('Password@123', 10);
  
  // Escape for shell
  const safeHash = hashedPassword.replace(/\$/g, '\\$');
  
  const query = `INSERT IGNORE INTO users (name, email, password, role, is_approved, created_at) VALUES ('Budi (Demo)', 'budi@devtrack.com', '${safeHash}', 'member', 1, NOW());`;
  
  conn.exec(`mysql -u root -pAleale2209! -D devtrack -e "${query}"`, (err, stream) => {
    stream.on('close', () => {
      console.log('Added demo user to global db.');
      
      // Try to create a workspace for budi
      const getUserIdQuery = `SELECT id FROM users WHERE email='budi@devtrack.com'`;
      conn.exec(`mysql -u root -pAleale2209! -D devtrack -e "${getUserIdQuery}"`, (err2, stream2) => {
        let out = '';
        stream2.on('data', d => out += d);
        stream2.on('close', () => {
           // We just wanted to ensure the user exists for login.
           // Budi can create a workspace when he logs in!
           console.log('Done.');
           conn.end();
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
