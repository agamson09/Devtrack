// Historical server metrics — samples are stored on each status fetch
// (throttled to 1/minute per target) with 30-day retention.
const { query, queryOne } = require('./db');

let lastInsert = new Map(); // targetId -> timestamp

function targetKey(status) {
  const t = status.target?.id;
  return t != null ? String(t) : 'local';
}

// Fire-and-forget safe. Called from /api/system/status after metrics are collected.
async function recordSample(status) {
  try {
    const key = targetKey(status);
    const now = Date.now();
    const last = lastInsert.get(key) || 0;
    if (now - last < 60000) return; // throttle: 1 sample per minute per target
    lastInsert.set(key, now);

    await query(
      'INSERT INTO server_metrics_history (target_id, cpu_pct, memory_pct, disk_pct) VALUES (?, ?, ?, ?)',
      [key, status.cpu?.usage || 0, status.memory?.percent || 0, status.disk?.percent || 0]
    );

    // ~1% chance per insert: prune samples older than 30 days
    if (Math.random() < 0.01) {
      await query('DELETE FROM server_metrics_history WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)').catch(() => {});
    }
  } catch (e) {
    console.error('[metrics-history] record failed:', e.message);
  }
}

async function getHistory(targetId = 'local', hours = 24) {
  const hoursNum = Math.min(720, Math.max(1, parseInt(hours) || 24));
  const rows = await query(
    `SELECT cpu_pct, memory_pct, disk_pct, recorded_at
     FROM server_metrics_history
     WHERE target_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY recorded_at ASC`,
    [String(targetId), hoursNum]
  );
  return rows.map((r) => ({
    cpu: Number(r.cpu_pct) || 0,
    memory: Number(r.memory_pct) || 0,
    disk: Number(r.disk_pct) || 0,
    recorded_at: r.recorded_at,
  }));
}

module.exports = { recordSample, getHistory };
