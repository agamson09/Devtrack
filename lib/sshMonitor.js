// Remote server monitoring over SSH — collects the same metrics shape as the
// local /api/system/status endpoint (Linux targets).
const { Client } = require('ssh2');
const { decryptSecret } = require('./vaultCrypto');

function connect(ssh) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timer = setTimeout(() => { conn.end(); reject(new Error('SSH timeout after 12s')); }, 12000);
    conn.on('ready', () => { clearTimeout(timer); resolve(conn); });
    conn.on('error', (err) => { clearTimeout(timer); reject(err); });
    conn.connect({
      host: ssh.host,
      port: parseInt(ssh.port) || 22,
      username: ssh.username,
      password: ssh.password,
      readyTimeout: 12000,
    });
  });
}

const SCRIPT = [
  'echo "---CPU---"; top -bn1 | grep \'Cpu(s)\' | awk \'{print $2}\'',
  'echo "---MEM---"; free -m | grep Mem',
  'echo "---DISK---"; df -h / | tail -1',
  'echo "---UPTIME---"; uptime -p 2>/dev/null || uptime',
  'echo "---LOAD---"; cat /proc/loadavg',
  'echo "---PROCS---"; ps aux --no-headers 2>/dev/null | wc -l',
  'echo "---NODE---"; node --version 2>/dev/null || echo none',
  'echo "---NET---"; awk \'NR>2 && $1!~/lo:/ {print $2, $10; exit}\' /proc/net/dev',
  'echo "---MYSQL---"; mysql --version 2>/dev/null || echo none',
].join('; ');

async function getStatusRemote(config) {
  const password = decryptSecret(config.password_enc);
  const conn = await connect({ host: config.host, port: config.port, username: config.username, password });

  try {
    const out = await new Promise((resolve, reject) => {
      conn.exec(SCRIPT, (err, stream) => {
        if (err) return reject(err);
        let buf = '';
        const timer = setTimeout(() => { stream.close(); reject(new Error('Metrics timeout')); }, 20000);
        stream.on('data', (d) => { buf += d.toString(); });
        stream.stderr.on('data', () => {});
        stream.on('close', () => { clearTimeout(timer); resolve(buf); });
      });
    });

    const section = (name) => {
      const m = buf.match(new RegExp(`---${name}---\\n([\\s\\S]*?)(?=\\n---|$)`));
      return m ? m[1].trim() : '';
    };

    const cpuUsage = parseFloat(section('CPU')) || 0;
    const memParts = section('MEM').split(/\s+/); // Mem: total used free ...
    const memTotal = parseInt(memParts[1], 10) || 0;
    const memUsed = parseInt(memParts[2], 10) || 0;
    const memFree = parseInt(memParts[3], 10) || 0;
    const diskParts = section('DISK').split(/\s+/); // Filesystem Size Used Avail Use% Mounted
    const loadParts = section('LOAD').split(/\s+/);
    const netParts = section('NET').split(/\s+/);
    const nodeOut = section('NODE');
    const mysqlOut = section('MYSQL');

    return {
      target: { id: config.id, name: config.name, host: config.host },
      cpu: { usage: Math.min(cpuUsage, 100) },
      memory: {
        total: memTotal, used: memUsed, free: memFree,
        percent: memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0,
      },
      disk: {
        total: diskParts[1] || '0', used: diskParts[2] || '0',
        available: diskParts[3] || '0', percent: parseInt(diskParts[4], 10) || 0,
      },
      uptime: section('UPTIME') || 'unknown',
      load: { '1m': parseFloat(loadParts[0]) || 0, '5m': parseFloat(loadParts[1]) || 0, '15m': parseFloat(loadParts[2]) || 0 },
      processes: parseInt(section('PROCS'), 10) || 0,
      nodeVersion: nodeOut && nodeOut !== 'none' ? nodeOut : null,
      mysql: mysqlOut && mysqlOut !== 'none'
        ? { version: mysqlOut, size_mb: null, tables: null, connections: null }
        : null,
      network: { rx_mb: Math.round((parseInt(netParts[0], 10) || 0) / 1024 / 1024), tx_mb: Math.round((parseInt(netParts[1], 10) || 0) / 1024 / 1024) },
      timestamp: new Date().toISOString(),
    };
  } finally {
    conn.end();
  }
}

module.exports = { getStatusRemote };
