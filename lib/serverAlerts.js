// Server monitor alerting — compares live metrics against thresholds and
// sends Telegram notifications with per-target/metric cooldown dedupe.
const { queryOne, query } = require('./db');
const { sendTelegramMessage } = require('./telegram');

let settingsCache = { at: 0, data: null };
const lastAlerted = new Map(); // "target:metric" -> timestamp

async function getSettings() {
  if (settingsCache.data && Date.now() - settingsCache.at < 60000) return settingsCache.data;
  const row = await queryOne('SELECT * FROM server_alert_settings ORDER BY id LIMIT 1');
  settingsCache = { at: Date.now(), data: row || null };
  return settingsCache.data;
}

function resolveRecipients(settings) {
  return (async () => {
    const recipients = new Set();
    if (settings.telegram_chat_id) {
      String(settings.telegram_chat_id)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((id) => recipients.add(id));
    }
    if (recipients.size === 0) {
      const admins = await query(
        "SELECT telegram_chat_id FROM users WHERE role = 'admin' AND telegram_chat_id IS NOT NULL AND telegram_chat_id != ''"
      );
      admins.forEach((a) => recipients.add(a.telegram_chat_id));
    }
    return [...recipients];
  })();
}

// Fire-and-forget safe — never throws.
async function checkAlerts(status) {
  try {
    const settings = await getSettings();
    if (!settings || !settings.enabled) return;

    const targetId = status.target?.id ?? 'local';
    const targetName = status.target?.name || 'Local server';
    const checks = [
      ['CPU', status.cpu?.usage, settings.cpu_threshold],
      ['Memory', status.memory?.percent, settings.memory_threshold],
      ['Disk', status.disk?.percent, settings.disk_threshold],
    ];

    for (const [metric, value, threshold] of checks) {
      if (value == null || threshold == null || value < threshold) continue;

      const key = `${targetId}:${metric}`;
      const last = lastAlerted.get(key) || 0;
      const cooldown = (settings.cooldown_minutes || 30) * 60000;
      if (Date.now() - last < cooldown) continue;
      lastAlerted.set(key, Date.now());

      const message =
        `🚨 <b>DevTrack Server Alert</b>\n` +
        `Server: <b>${targetName}</b>\n` +
        `${metric}: <b>${value}%</b> (melewati batas ${threshold}%)`;

      const recipients = await resolveRecipients(settings);
      for (const chatId of recipients) {
        await sendTelegramMessage(chatId, message).catch((e) =>
          console.error('[alerts] telegram send failed:', e.message)
        );
      }
    }
  } catch (e) {
    console.error('[alerts] check failed:', e.message);
  }
}

async function updateSettings(fields) {
  const existing = await queryOne('SELECT id FROM server_alert_settings ORDER BY id LIMIT 1');
  const allowed = ['enabled', 'cpu_threshold', 'memory_threshold', 'disk_threshold', 'cooldown_minutes', 'telegram_chat_id'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(fields[key]);
    }
  }
  if (!sets.length) return getSettings();
  if (existing) {
    params.push(existing.id);
    await query(`UPDATE server_alert_settings SET ${sets.join(', ')} WHERE id = ?`, params);
  } else {
    await query(`INSERT INTO server_alert_settings (${allowed.filter((k) => fields[k] !== undefined).join(', ')}) VALUES (${sets.map(() => '?').join(', ')})`, params);
  }
  settingsCache = { at: 0, data: null };
  return getSettings();
}

module.exports = { checkAlerts, getSettings, updateSettings };
