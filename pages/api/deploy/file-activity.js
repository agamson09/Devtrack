import { query, insert } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'POST') {
    try {
      const { file_path, action, file_size, module } = req.body
      if (!file_path || !action) return res.status(400).json({ error: 'file_path and action required' })

      const detected_module = module || 'general'
      await insert('INSERT INTO file_activity_logs (file_path, module, action, file_size, changed_by) VALUES (?, ?, ?, ?, ?)',
        [file_path, detected_module, action, file_size || 0, user.name || user.email])

      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('File activity log error:', err)
      return res.status(500).json({ error: 'Failed to log activity' })
    }
  }

  if (req.method === 'GET') {
    try {
      const { module, days = 7, limit = 50 } = req.query
      let sql = 'SELECT * FROM file_activity_logs WHERE detected_at >= DATE_SUB(NOW(), INTERVAL ? DAY)'
      const params = [parseInt(days)]
      
      if (module && module !== 'all') {
        sql += ' AND module = ?'
        params.push(module)
      }
      
      sql += ' ORDER BY detected_at DESC LIMIT ?'
      params.push(parseInt(limit))

      const activities = await query(sql, params)

      const summarySql = `SELECT module, COUNT(*) as count, 
        SUM(CASE WHEN action = 'created' THEN 1 ELSE 0 END) as created,
        SUM(CASE WHEN action = 'modified' THEN 1 ELSE 0 END) as modified,
        SUM(CASE WHEN action = 'deleted' THEN 1 ELSE 0 END) as deleted
        FROM file_activity_logs 
        WHERE detected_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY module ORDER BY count DESC`
      const summary = await query(summarySql, [parseInt(days)])

      return res.status(200).json({ activities, summary })
    } catch (err) {
      console.error('File activity fetch error:', err)
      return res.status(500).json({ error: 'Failed to fetch activity' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
