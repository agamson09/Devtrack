import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
import { getMonitorOverview, checkMonitor } from '@/lib/uptimeMonitor'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  // GET — list monitors with 24h uptime stats
  if (req.method === 'GET') {
    try {
      const monitors = await getMonitorOverview()
      return res.status(200).json({ monitors })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    const { action } = req.body || {}

    // --- immediate manual check -------------------------------------------
    if (action === 'check') {
      const { id } = req.body
      try {
        const monitor = await db.queryOne('SELECT * FROM uptime_monitors WHERE id = ?', [id])
        if (!monitor) return res.status(404).json({ error: 'Monitor not found' })
        const result = await checkMonitor(monitor)
        return res.status(200).json({ success: true, ...result })
      } catch (err) {
        return res.status(400).json({ error: err.message })
      }
    }

    // --- create / update ----------------------------------------------------
    const { id, name, url, method, interval_seconds, enabled } = req.body
    if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' })
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'URL must start with http:// or https://' })
    const safeMethod = ['GET', 'HEAD'].includes(method) ? method : 'HEAD'
    const safeInterval = Math.max(30, parseInt(interval_seconds) || 60)
    const safeEnabled = enabled === false || enabled === 0 ? 0 : 1

    try {
      if (id) {
        const existing = await db.queryOne('SELECT id FROM uptime_monitors WHERE id = ?', [id])
        if (!existing) return res.status(404).json({ error: 'Monitor not found' })
        await db.query(
          'UPDATE uptime_monitors SET name = ?, url = ?, method = ?, interval_seconds = ?, enabled = ? WHERE id = ?',
          [name.trim(), url.trim(), safeMethod, safeInterval, safeEnabled, id]
        )
        if (!safeEnabled) {
          await db.query("UPDATE uptime_monitors SET last_status = 'paused' WHERE id = ?", [id])
        }
        return res.status(200).json({ success: true, id: Number(id) })
      }

      const result = await db.insert(
        'INSERT INTO uptime_monitors (name, url, method, interval_seconds, enabled) VALUES (?, ?, ?, ?, ?)',
        [name.trim(), url.trim(), safeMethod, safeInterval, safeEnabled]
      )
      return res.status(201).json({ success: true, id: result.insertId })
    } catch (err) {
      console.error('uptime save error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  // DELETE /api/uptime?id=N
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id is required' })
    try {
      await db.query('DELETE FROM uptime_checks WHERE monitor_id = ?', [id])
      await db.query('DELETE FROM uptime_monitors WHERE id = ?', [id])
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
