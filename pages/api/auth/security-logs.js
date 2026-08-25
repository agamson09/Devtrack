import { getAuthUser } from '@/lib/auth'
import { query } from '@/lib/db'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { limit = 50, severity, event_type } = req.query

    let sql = `SELECT sl.*, u.name as user_name, u.email as user_email 
               FROM security_logs sl 
               LEFT JOIN users u ON sl.user_id = u.id`
    const params = []
    const conditions = []

    if (severity) {
      conditions.push('sl.severity = ?')
      params.push(severity)
    }
    if (event_type) {
      conditions.push('sl.event_type = ?')
      params.push(event_type)
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY sl.created_at DESC LIMIT ?'
    params.push(parseInt(limit))

    const logs = await query(sql, params)

    const stats = await query(`
      SELECT severity, COUNT(*) as count 
      FROM security_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
      GROUP BY severity
    `)

    const eventStats = await query(`
      SELECT event_type, COUNT(*) as count 
      FROM security_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
      GROUP BY event_type 
      ORDER BY count DESC
    `)

    return res.status(200).json({ logs, stats, eventStats })
  } catch (err) {
    console.error('Security logs error:', err)
    return res.status(500).json({ error: 'Failed to fetch security logs' })
  }
}
