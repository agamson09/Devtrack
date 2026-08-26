// Cross-platform local system status collector.
// Linux/macOS: native commands. Windows: os module + PowerShell fallbacks.
const os = require('os');
const { execSync } = require('child_process');

function sh(cmd, timeout = 8000) {
  return execSync(cmd, { timeout }).toString().trim();
}

function cpuSample() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const k in c.times) total += c.times[k];
    idle += c.times.idle;
  }
  return { idle, total };
}

async function cpuUsagePercent() {
  const s1 = cpuSample();
  await new Promise((r) => setTimeout(r, 150));
  const s2 = cpuSample();
  const totalDelta = s2.total - s1.total;
  if (totalDelta <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((1 - (s2.idle - s1.idle) / totalDelta) * 100)));
}

function diskInfo() {
  try {
    if (process.platform === 'win32') {
      const out = sh(`powershell -NoProfile -Command "$d=Get-CimInstance Win32_LogicalDisk -Filter DriveType=3; $s=($d|Measure-Object Size -Sum).Sum; $f=($d|Measure-Object FreeSpace -Sum).Sum; Write-Output ('{0} {1}' -f [math]::Round($s/1GB,1),[math]::Round(($s-$f)/1GB,1))"`);
      const [totalGB, usedGB] = out.split(/\s+/).map(parseFloat);
      const percent = totalGB > 0 ? Math.round((usedGB / totalGB) * 100) : 0;
      return { total: `${totalGB}G`, used: `${usedGB}G`, available: `${Math.round((totalGB - usedGB) * 10) / 10}G`, percent };
    }
    const raw = sh('df -h / | tail -1', 5000).split(/\s+/);
    return { total: raw[1], used: raw[2], available: raw[3], percent: parseInt(raw[4], 10) || 0 };
  } catch {
    return { total: '0', used: '0', available: '0', percent: 0 };
  }
}

function processCount() {
  try {
    if (process.platform === 'win32') {
      return parseInt(sh('powershell -NoProfile -Command "(Get-Process).Count"'), 10) || 0;
    }
    return parseInt(sh('ps aux --no-headers | wc -l', 5000), 10) || 0;
  } catch {
    return 0;
  }
}

function networkTotals() {
  try {
    if (process.platform === 'win32') {
      const out = sh(`powershell -NoProfile -Command "$n=Get-NetAdapterStatistics; Write-Output ('{0} {1}' -f ($n|Measure-Object ReceivedBytes -Sum).Sum,($n|Measure-Object SentBytes -Sum).Sum)"`);
      const [rx, tx] = out.split(/\s+/).map((v) => parseInt(v, 10) || 0);
      return { rx, tx };
    }
    const raw = sh("cat /proc/net/dev | awk 'NR>2 && $1!~/lo:/ {print $2, $10; exit}'", 5000).split(/\s+/);
    return { rx: parseInt(raw[0], 10) || 0, tx: parseInt(raw[1], 10) || 0 };
  } catch {
    return { rx: 0, tx: 0 };
  }
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `up ${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
  if (hours > 0) return `up ${hours} hour${hours !== 1 ? 's' : ''}, ${mins} minute${mins !== 1 ? 's' : ''}`;
  return `up ${mins} minute${mins !== 1 ? 's' : ''}`;
}

async function getLocalStatus() {
  const cpuUsage = await cpuUsagePercent();

  const totalMem = Math.round(os.totalmem() / 1024 / 1024);
  const freeMem = Math.round(os.freemem() / 1024 / 1024);
  const usedMem = totalMem - freeMem;

  const isWin = process.platform === 'win32';
  const loadAvg = isWin ? [0, 0, 0] : os.loadavg();
  const net = networkTotals();

  // MySQL metrics via the app's own connection pool — works on any OS.
  let mysql = null;
  try {
    const db = require('./db');
    const sizeRow = await db.queryOne("SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb FROM information_schema.tables WHERE table_schema = 'devtrack'");
    const tablesRow = await db.queryOne("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'devtrack'");
    const connRow = await db.queryOne("SHOW STATUS LIKE 'Threads_connected'");
    const verRow = await db.queryOne('SELECT VERSION() AS v');
    mysql = {
      version: verRow?.v ? `MySQL ${verRow.v}` : 'MySQL',
      size_mb: sizeRow?.size_mb || 0,
      tables: tablesRow?.count || 0,
      connections: connRow?.Value || 0,
    };
  } catch {}

  return {
    target: { id: 'local', name: 'Local server', host: os.hostname() },
    cpu: { usage: cpuUsage },
    memory: {
      total: totalMem, used: usedMem, free: freeMem,
      percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
    },
    disk: diskInfo(),
    uptime: formatUptime(os.uptime()),
    load: { '1m': +loadAvg[0].toFixed(2), '5m': +loadAvg[1].toFixed(2), '15m': +loadAvg[2].toFixed(2) },
    processes: processCount(),
    nodeVersion: process.version,
    mysql,
    network: { rx_mb: Math.round(net.rx / 1024 / 1024), tx_mb: Math.round(net.tx / 1024 / 1024) },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { getLocalStatus };
