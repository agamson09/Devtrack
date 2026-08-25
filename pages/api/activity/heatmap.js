import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { days = 365, user_id } = req.query
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(days))
    const startStr = startDate.toISOString().split('T')[0]

    let query = `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM activity_logs
      WHERE created_at >= ?
    `
    const params = [startStr]

    if (user_id) {
      query += ' AND user_id = ?'
      params.push(user_id)
    }

    query += ' GROUP BY DATE(created_at) ORDER BY date ASC'

    const rows = await db.query(query, params)

    const heatmap = {}
    rows.forEach(r => {
      const d = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0]
      heatmap[d] = r.count
    })

    const allUsers = await db.query(
      `SELECT id, name FROM users WHERE is_active = 1 ORDER BY name`
    )

    return res.status(200).json({ heatmap, users: allUsers })
  } catch (error) {
    console.error('Heatmap error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
