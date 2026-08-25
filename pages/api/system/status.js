import { getAuthUser } from '@/lib/auth';
import { execSync } from 'child_process';
import db from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const cpuRaw = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'", { timeout: 5000 }).toString().trim();
    const cpuUsage = parseFloat(cpuRaw) || 0;

    const memRaw = execSync("free -m | grep Mem", { timeout: 5000 }).toString().trim().split(/\s+/);
    const memTotal = parseInt(memRaw[1]) || 0;
    const memUsed = parseInt(memRaw[2]) || 0;
    const memFree = parseInt(memRaw[3]) || 0;

    const diskRaw = execSync("df -h / | tail -1", { timeout: 5000 }).toString().trim().split(/\s+/);
    const diskTotal = diskRaw[1] || '0';
    const diskUsed = diskRaw[2] || '0';
    const diskAvailable = diskRaw[3] || '0';
    const diskPercent = parseInt(diskRaw[4]) || 0;

    const uptimeRaw = execSync("uptime -p", { timeout: 5000 }).toString().trim();

    const loadRaw = execSync("cat /proc/loadavg", { timeout: 5000 }).toString().trim().split(/\s+/);
    const load1 = parseFloat(loadRaw[0]) || 0;
    const load5 = parseFloat(loadRaw[1]) || 0;
    const load15 = parseFloat(loadRaw[2]) || 0;

    const processesRaw = execSync("ps aux --no-headers | wc -l", { timeout: 5000 }).toString().trim();
    const totalProcesses = parseInt(processesRaw) || 0;

    const nodeVersion = execSync("node --version", { timeout: 5000 }).toString().trim();

    const mysqlVersion = execSync("mysql --version", { timeout: 5000 }).toString().trim();

    const mysqlSize = await db.queryOne(
      "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb FROM information_schema.tables WHERE table_schema = 'devtrack'"
    );

    const mysqlTables = await db.queryOne(
      "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'devtrack'"
    );

    const mysqlConnections = await db.queryOne("SHOW STATUS LIKE 'Threads_connected'");

    let rxBytes = 0, txBytes = 0;
    try {
      const netRaw = execSync("cat /proc/net/dev | grep enp3s0", { timeout: 5000 }).toString().trim().split(/\s+/);
      rxBytes = parseInt(netRaw[1]) || 0;
      txBytes = parseInt(netRaw[9]) || 0;
    } catch (e) {
      try {
        const netRaw = execSync("cat /proc/net/dev | grep eth0", { timeout: 5000 }).toString().trim().split(/\s+/);
        rxBytes = parseInt(netRaw[1]) || 0;
        txBytes = parseInt(netRaw[9]) || 0;
      } catch (e2) { /* no network interface found */ }
    }

    return res.status(200).json({
      cpu: { usage: Math.min(cpuUsage, 100) },
      memory: { total: memTotal, used: memUsed, free: memFree, percent: memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0 },
      disk: { total: diskTotal, used: diskUsed, available: diskAvailable, percent: diskPercent },
      uptime: uptimeRaw,
      load: { '1m': load1, '5m': load5, '15m': load15 },
      processes: totalProcesses,
      nodeVersion,
      mysql: { version: mysqlVersion, size_mb: mysqlSize?.size_mb || 0, tables: mysqlTables?.count || 0, connections: mysqlConnections?.Value || 0 },
      network: { rx_mb: Math.round(rxBytes / 1024 / 1024), tx_mb: Math.round(txBytes / 1024 / 1024) },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('System status error:', error);
    return res.status(500).json({ error: 'Failed to fetch system status' });
  }
}
