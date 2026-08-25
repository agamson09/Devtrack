/** Run a command on the target server defined in .vscode/sftp.json.
 * Usage: node scripts/ssh_run.cjs "command" */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.vscode', 'sftp.json'), 'utf8'));
const cmd = process.argv[2];
if (!cmd) { console.error('Usage: node scripts/ssh_run.cjs "<command>"'); process.exit(2); }

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error('exec failed:', err.message); process.exit(1); }
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', (code) => { conn.end(); process.exit(code); });
  });
}).on('error', (e) => { console.error('SSH failed:', e.message); process.exit(1); })
  .connect({ host: cfg.host, port: cfg.port || 22, username: cfg.username, password: cfg.password, readyTimeout: 20000 });
