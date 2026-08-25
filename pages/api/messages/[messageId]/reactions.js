import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { messageId } = req.query

  if (req.method === 'GET') {
    try {
      const reactions = await db.query(`
        SELECT mr.id, mr.emoji, mr.user_id, u.name
        FROM message_reactions mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id = ?
        ORDER BY mr.created_at ASC
      `, [messageId])

      const grouped = {}
      for (const r of reactions) {
        if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, users: [], count: 0 }
        grouped[r.emoji].users.push({ id: r.user_id, name: r.name })
        grouped[r.emoji].count++
      }
      return res.status(200).json({ reactions: Object.values(grouped) })
    } catch (err) {
      console.error('Get reactions error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    const { emoji } = req.body
    if (!emoji) return res.status(400).json({ error: 'emoji is required' })
    try {
      const existing = await db.queryOne(
        'SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
        [messageId, user.id, emoji]
      )
      if (existing) {
        await db.query('DELETE FROM message_reactions WHERE id = ?', [existing.id])
        return res.status(200).json({ action: 'removed', emoji })
      } else {
        await db.query(
          'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
          [messageId, user.id, emoji]
        )
        return res.status(201).json({ action: 'added', emoji })
      }
    } catch (err) {
      console.error('Toggle reaction error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
