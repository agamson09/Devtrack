// Git-based deployment engine — runs the fetch/reset/build/restart pipeline
// on a remote server over SSH (single connection, step-by-step).
const { Client } = require('ssh2');
const { query, queryOne, insert, update } = require('../db');
const { decryptSecret } = require('./vaultCrypto');
const { notifyDeployExecuted } = require('./notifications');

const STEP_TIMEOUT = 10 * 60 * 1000; // 10 minutes per command

function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

// Inject a PAT into an https repo URL (private repos). ssh:// URLs pass through.
function buildAuthedUrl(repoUrl, token) {
  if (!token) return repoUrl;
  return String(repoUrl).replace(/^https:\/\//i, `https://x-access-token:${token}@`);
}

function normalizeRepoUrl(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/\.git$/, '')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/\/$/, '');
}

function connect(ssh) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timer = setTimeout(() => { conn.end(); reject(new Error('SSH timeout after 15s')); }, 15000);
    conn.on('ready', () => { clearTimeout(timer); resolve(conn); });
    conn.on('error', (err) => { clearTimeout(timer); reject(err); });
    conn.connect({
      host: ssh.host,
      port: parseInt(ssh.port) || 22,
      username: ssh.username,
      password: ssh.password,
      readyTimeout: 15000,
    });
  });
}

function runCommand(conn, cmd, cwd) {
  return new Promise((resolve, reject) => {
    const full = cwd ? `cd ${shellQuote(cwd)} && ${cmd}` : cmd;
    conn.exec(full, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`Command timeout: ${cmd.slice(0, 80)}`));
      }, STEP_TIMEOUT);
      stream.on('data', (d) => { out += d.toString(); });
      stream.stderr.on('data', (d) => { errOut += d.toString(); });
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, out: out.trim(), err: errOut.trim() });
      });
    });
  });
}

async function withConnection(config, fn) {
  const password = decryptSecret(config.password_enc);
  const conn = await connect({ host: config.host, port: config.port, username: config.username, password });
  try {
    return await fn(conn);
  } finally {
    conn.end();
  }
}

// ---- Status / monitoring ----------------------------------------------------
async function getStatus(config) {
  const token = config.repo_token_enc ? decryptSecret(config.repo_token_enc) : null;
  const branch = config.branch || 'main';
  const path = config.project_path;
  const fetchUrl = buildAuthedUrl(config.repo_url, token);

  return withConnection(config, async (conn) => {
    const check = await runCommand(conn, 'test -d .git && git rev-parse --is-inside-work-tree', path).catch(() => ({ code: 1 }));
    if (check.code !== 0) {
      throw new Error(`${path} is not a git repository on the server (clone it first)`);
    }

    const fetch = await runCommand(conn, `git fetch --quiet ${shellQuote(fetchUrl)} ${shellQuote(branch)}`, path);
    if (fetch.code !== 0) {
      throw new Error('git fetch failed: ' + (fetch.err || fetch.out || 'unknown error'));
    }

    const [head, headMsg, remote, dirty] = await Promise.all([
      runCommand(conn, 'git rev-parse --short=7 HEAD', path),
      runCommand(conn, 'git log -1 --format=%s', path),
      runCommand(conn, 'git rev-parse --short=7 FETCH_HEAD', path),
      runCommand(conn, 'git status --porcelain | wc -l', path),
    ]);

    let pending = [];
    if (head.out !== remote.out) {
      const log = await runCommand(
        conn,
        `git log --format=%h|%an|%ar|%s HEAD..FETCH_HEAD`,
        path
      );
      pending = (log.out || '').split('\n').filter(Boolean).map((line) => {
        const [hash, author, date, ...msg] = line.split('|');
        return { hash, author, date, msg: msg.join('|') };
      });
    }

    return {
      branch,
      currentCommit: head.out || null,
      currentMsg: headMsg.out || null,
      remoteCommit: remote.out || null,
      dirtyFiles: parseInt(dirty.out, 10) || 0,
      upToDate: head.out === remote.out,
      pending,
    };
  });
}

// ---- Deploy pipeline ----------------------------------------------------------
async function deployPipeline(config, { userId, onStep } = {}) {
  const token = config.repo_token_enc ? decryptSecret(config.repo_token_enc) : null;
  const branch = config.branch || 'main';
  const path = config.project_path;
  const fetchUrl = buildAuthedUrl(config.repo_url, token);

  const steps = [
    { name: 'fetch', cmd: `git fetch --quiet ${shellQuote(fetchUrl)} ${shellQuote(branch)}`, critical: true },
    { name: 'reset', cmd: 'git reset --hard FETCH_HEAD', critical: true },
  ];
  if (config.install_cmd) {
    steps.push({
      name: 'install',
      cmd: `if git diff --name-only HEAD@{1} HEAD -- package.json package-lock.json 2>/dev/null | grep -q .; then ${config.install_cmd}; else echo "package.json unchanged - skipped"; fi`,
      critical: true,
      optionalSkip: true,
    });
  }
  if (config.build_cmd) steps.push({ name: 'build', cmd: config.build_cmd, critical: true });
  if (config.restart_cmd) steps.push({ name: 'restart', cmd: config.restart_cmd, critical: true });
  steps.push({ name: 'verify', cmd: 'git rev-parse --short=7 HEAD', critical: true });

  const started = Date.now();
  const results = [];
  let commitBefore = null;
  let commitAfter = null;

  const conn = await connect({ host: config.host, port: config.port, username: config.username, password: decryptSecret(config.password_enc) });

  try {
    for (const step of steps) {
      const t0 = Date.now();
      let res;
      try {
        res = await runCommand(conn, step.cmd, path);
      } catch (e) {
        res = { code: -1, out: '', err: e.message };
      }
      const entry = {
        name: step.name,
        cmd: step.cmd.replace(/x-access-token:[^@]+@/g, 'x-access-token:***@'),
        ok: res.code === 0,
        output: (res.out || res.err || '').slice(-4000),
        ms: Date.now() - t0,
      };
      results.push(entry);
      if (onStep) { try { onStep(entry) } catch {} }

      if (step.name === 'reset') commitBefore = commitAfter || res.out || null;
      if (step.name === 'verify') commitAfter = res.out || null;

      if (!entry.ok && step.critical) {
        throw Object.assign(new Error(`Step "${step.name}" failed: ${(res.err || res.out || 'exit ' + res.code).slice(0, 300)}`), {
          steps: results, commitBefore, commitAfter: null,
        });
      }
    }
  } finally {
    conn.end();
  }

  return {
    ok: true,
    commitBefore,
    commitAfter,
    steps: results,
    duration_ms: Date.now() - started,
  };
}

// ---- High-level: run deploy for a saved config + persist history ---------------
async function deployById(configId, userId, onStep) {
  const config = await queryOne('SELECT * FROM remote_deploy_configs WHERE id = ?', [configId]);
  if (!config) throw new Error('Deploy config not found');
  if (!config.repo_url) throw new Error('This target has no Git repository configured');

  const beforeStatus = await getStatus(config).catch(() => null);

  const logResult = await insert(
    'INSERT INTO deploy_logs (connection_id, branch, commit_before, deployed_by, status, note) VALUES (?, ?, ?, ?, ?, ?)',
    [configId, config.branch || 'main', beforeStatus?.currentCommit || null, userId || null, 'running', 'git deploy']
  );
  const deployLogId = logResult.insertId;

  try {
    const result = await deployPipeline(config, { userId, onStep });

    await update(
      'UPDATE deploy_logs SET status = "deployed", commit_after = ?, log_text = ?, deployed_at = NOW() WHERE id = ?',
      [result.commitAfter, JSON.stringify(result.steps), deployLogId]
    );
    await update(
      'UPDATE remote_deploy_configs SET last_commit = ?, last_deployed_at = NOW() WHERE id = ?',
      [result.commitAfter, configId]
    );

    try {
      await notifyDeployExecuted({ name: config.name }, { commit: result.commitAfter, duration: result.duration_ms });
    } catch {}

    return { ...result, deployLogId };
  } catch (err) {
    await update(
      'UPDATE deploy_logs SET status = "failed", log_text = ?, deployed_at = NOW() WHERE id = ?',
      [JSON.stringify(err.steps || [{ error: err.message }]), deployLogId]
    ).catch(() => {});
    throw err;
  }
}

// ---- Auto-deploy (webhook) — find matching config for a push --------------------
async function autoDeployForPush(repoUrl, branch) {
  const configs = await query(
    'SELECT * FROM remote_deploy_configs WHERE auto_deploy = 1 AND repo_url IS NOT NULL AND branch = ?',
    [branch || 'main']
  );
  const target = configs.find((c) => normalizeRepoUrl(c.repo_url) === normalizeRepoUrl(repoUrl));
  if (!target) return null;

  const status = await getStatus(target).catch(() => null);
  if (status && status.upToDate) return { skipped: true, reason: 'already up to date', config: target.name };

  const result = await deployById(target.id, null);
  return { skipped: false, config: target.name, result };
}

module.exports = {
  buildAuthedUrl,
  normalizeRepoUrl,
  getStatus,
  deployPipeline,
  deployById,
  autoDeployForPush,
};
