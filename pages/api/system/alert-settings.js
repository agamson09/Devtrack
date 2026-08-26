import { getAuthUser } from '@/lib/auth'
import { getSettings, updateSettings } from '@/lib/serverAlerts'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  try {
    if (req.method === 'GET') {
      const settings = (await getSettings()) || {
        enabled: 0, cpu_threshold: 85, memory_threshold: 90,
        disk_threshold: 90, cooldown_minutes: 30, telegram_chat_id: null,
      }
      return res.status(200).json(settings)
    }

    if (req.method === 'POST') {
      const { enabled, cpu_threshold, memory_threshold, disk_threshold, cooldown_minutes, telegram_chat_id } = req.body || {}
      const settings = await updateSettings({
        enabled: enabled !== undefined ? (enabled ? 1 : 0) : undefined,
        cpu_threshold: cpu_threshold !== undefined ? Math.min(100, Math.max(1, parseInt(cpu_threshold) || 85)) : undefined,
        memory_threshold: memory_threshold !== undefined ? Math.min(100, Math.max(1, parseInt(memory_threshold) || 90)) : undefined,
        disk_threshold: disk_threshold !== undefined ? Math.min(100, Math.max(1, parseInt(disk_threshold) || 90)) : undefined,
        cooldown_minutes: cooldown_minutes !== undefined ? Math.max(1, parseInt(cooldown_minutes) || 30) : undefined,
        telegram_chat_id: telegram_chat_id !== undefined ? (String(telegram_chat_id).trim() || null) : undefined,
      })
      return res.status(200).json({ success: true, settings })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('alert-settings error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
