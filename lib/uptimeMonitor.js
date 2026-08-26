// Uptime monitor — periodically checks external URLs, stores results,
// and notifies admins via Telegram on up/down transitions.
const { query, queryOne, insert } = require('./db');
const { sendTelegramMessage } = require('./telegram');

let running = false;

async function alertAdmins(message) {
  try {
    const admins = await query(
      "SELECT telegram_chat_id FROM users WHERE role = 'admin' AND telegram_chat_id IS NOT NULL AND telegram_chat_id != ''"
    );
    for (const a of admins) {
      await sendTelegramMessage(a.telegram_chat_id, message).catch(() => {});
    }
  } catch {}
}

async function checkMonitor(monitor) {
  const started = Date.now();
  let status = 'up';
  let statusCode = null;
  let error = null;

  try {
    const res = await fetch(monitor.url, {
      method: monitor.method || 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    statusCode = res.status;
    if (res.status >= 400) {
      status = 'down';
      error = `HTTP ${res.status}`;
    }
  } catch (e) {
    status = 'down';
    error = (e.cause?.code || e.name || 'error').slice(0, 200);
  }

  const responseMs = Date.now() - started;

  await insert(
    'INSERT INTO uptime_checks (monitor_id, status, response_ms, status_code, error) VALUES (?, ?, ?, ?, ?)',
    [monitor.id, status, responseMs, statusCode, error]
  );
  await query(
    'UPDATE uptime_monitors SET last_status = ?, last_checked_at = NOW()' + (status === 'down' ? ', last_down_at = NOW()' : '') + ' WHERE id = ?',
    [status, monitor.id]
  );

  // Transition alerts
  const prev = monitor.last_status;
  if (prev === 'up' && status === 'down') {
    await alertAdmins(
      `🔴 <b>Monitor DOWN</b>\n${monitor.name}\n${monitor.url}\n${error || 'HTTP ' + statusCode}`
    );
  } else if (prev === 'down' && status === 'up') {
    await alertAdmins(
      `🟢 <b>Monitor UP</b>\n${monitor.name}\n${monitor.url} kembali normal (${responseMs}ms)`
    );
  }

  return { status, responseMs, statusCode, error };
}

// Run one sweep: check every enabled monitor whose interval has elapsed.
async function checkDueMonitors() {
  if (running) return;
  running = true;
  try {
    const due = await query(
      `SELECT * FROM uptime_monitors
       WHERE enabled = 1
         AND (last_checked_at IS NULL OR last_checked_at <= DATE_SUB(NOW(), INTERVAL interval_seconds SECOND))`
    );
    for (const monitor of due) {
      await checkMonitor(monitor).catch((e) =>
        console.error(`[uptime] check failed for ${monitor.name}:`, e.message)
      );
    }

    // Occasional retention prune (checks older than 7 days)
    if (Math.random() < 0.02) {
      await query('DELETE FROM uptime_checks WHERE checked_at < DATE_SUB(NOW(), INTERVAL 7 DAY)').catch(() => {});
    }
  } catch (e) {
    console.error('[uptime] sweep error:', e.message);
  } finally {
    running = false;
  }
}

async function getMonitorOverview() {
  const monitors = await query('SELECT * FROM uptime_monitors ORDER BY name ASC');
  const overview = [];
  for (const m of monitors) {
    const stats = await queryOne(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS ups,
              ROUND(AVG(response_ms), 0) AS avg_ms
       FROM uptime_checks
       WHERE monitor_id = ? AND checked_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [m.id]
    );
    overview.push({
      ...m,
      uptime_24h: stats && stats.total > 0 ? Math.round((stats.ups / stats.total) * 1000) / 10 : null,
      avg_response_ms: stats?.avg_ms || null,
      checks_24h: stats?.total || 0,
    });
  }
  return overview;
}

module.exports = { checkDueMonitors, checkMonitor, getMonitorOverview };
