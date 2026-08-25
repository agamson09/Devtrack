/**
 * Deploy DevTrack to the target server defined in .vscode/sftp.json.
 * Flow (mirrors deploy.ps1): upload changed source files -> npm run build on server -> pm2 restart devtrack.
 * Usage: node scripts/deploy_sftp.cjs [--files-only] [--skip-restart]
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.vscode', 'sftp.json'), 'utf8'));

// Files changed in the login avatar + JWT payload fix
const FILES = [
  'pages/api/auth/login.js',
  'pages/api/users/me/password.js',
];

// Remote paths to remove before build (deleted duplicates)
const REMOTE_DELETES = [
  cfg.remotePath + '/pages/dashboard/projects/[id].js', // superseded by [id]/index.js
  cfg.remotePath + '/pages/api/debug-jwt.js',           // SECURITY: leaked JWT secret info, unauthenticated
  cfg.remotePath + '/pages/api/hello.js',               // Next.js scaffold noise
];

const args = new Set(process.argv.slice(2));
const skipRestart = args.has('--skip-restart');
const REMOTE_BUILD_CMD = 'cd ' + cfg.remotePath + ' && npm run build 2>&1 | tail -n 25';
const RESTART_CMD = 'cd ' + cfg.remotePath + ' && (pm2 restart devtrack --update-env || systemctl restart devtrack 2>/dev/null || echo "RESTART_FAILED")';

function log(msg) {
  console.log('[' + new Date().toISOString().slice(11, 19) + '] ' + msg);
}

function mkdirp(sftp, remoteDir) {
  const segments = remoteDir.split('/').filter(Boolean);
  let cur = '';
  return segments.reduce((chain, seg) => {
    cur += '/' + seg;
    const target = cur;
    return chain.then(() => new Promise((resolve) => {
      sftp.exists(target, (exists) => {
        if (exists === 'd') return resolve();
        sftp.mkdir(target, {}, () => resolve()); // ignore EEXIST-style failures; exists() check covers us
      });
    }));
  }, Promise.resolve());
}

function putFile(sftp, relFile) {
  const local = path.join(ROOT, relFile);
  const remote = cfg.remotePath.replace(/\/+$/, '') + '/' + relFile.split(path.sep).join('/');
  return mkdirp(sftp, path.posix.dirname(remote)).then(() => new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => err ? reject(new Error(relFile + ': ' + err.message)) : resolve());
  })).then(() => log('uploaded  ' + relFile));
}

function runCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (d) => { process.stdout.write(d); out += d; });
      stream.stderr.on('data', (d) => { process.stderr.write(d); });
      stream.on('close', (code) => resolve({ code, output: out }));
    });
  });
}

const conn = new Client();
conn.on('ready', () => {
  log('connected to ' + cfg.host + ':' + (cfg.port || 22));

  conn.sftp(async (err, sftp) => {
    if (err) { console.error('SFTP session failed:', err.message); conn.end(); process.exit(1); }
    try {
      for (const f of FILES.map((f) => f.split('/').join(path.sep))) {
        await putFile(sftp, f);
      }
      log('all ' + FILES.length + ' files uploaded');
      sftp.end();

      if (!args.has('--files-only')) {
        for (const target of REMOTE_DELETES) {
          const del = await runCommand(conn, 'rm -f ' + JSON.stringify(target) + ' && echo removed');
          log('cleanup: ' + target);
        }
        log('building on server (this can take a few minutes)...');
        const build = await runCommand(conn, REMOTE_BUILD_CMD);
        if (build.code !== 0) throw new Error('remote build failed with exit code ' + build.code);
        log('server build OK');
      }

      if (!skipRestart && !args.has('--files-only')) {
        log('restarting service...');
        const restart = await runCommand(conn, RESTART_CMD);
        if (restart.output.includes('RESTART_FAILED')) throw new Error('could not restart via pm2 or systemd');
        log('service restarted');
      }

      log('DEPLOY COMPLETE');
      conn.end();
      process.exit(0);
    } catch (e) {
      console.error('DEPLOY FAILED:', e.message);
      try { sftp.end(); } catch {}
      conn.end();
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('SSH connection failed:', err.message);
  process.exit(1);
}).connect({
  host: cfg.host,
  port: cfg.port || 22,
  username: cfg.username,
  password: cfg.password,
  readyTimeout: 20000,
});
