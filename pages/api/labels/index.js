import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    try {
      const labels = await db.query(
        `SELECT l.*, COUNT(tl.task_id) as task_count
         FROM labels l
         LEFT JOIN task_labels tl ON l.id = tl.label_id
         GROUP BY l.id
         ORDER BY l.name ASC`
      )
      return res.status(200).json({ labels })
    } catch (error) {
      console.error('List labels error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
    const { name, color } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Label name is required' })
    try {
      const existing = await db.queryOne('SELECT id FROM labels WHERE name = ?', [name.trim()])
      if (existing) return res.status(409).json({ error: 'Label already exists' })
      const result = await db.insert('labels', { name: name.trim(), color: color || '#6366f1' })
      return res.status(201).json({ label: { id: result.id, name: name.trim(), color: color || '#6366f1' } })
    } catch (error) {
      console.error('Create label error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Label ID is required' })
    try {
      await db.query('DELETE FROM labels WHERE id = ?', [id])
      return res.status(200).json({ message: 'Label deleted' })
    } catch (error) {
      console.error('Delete label error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
