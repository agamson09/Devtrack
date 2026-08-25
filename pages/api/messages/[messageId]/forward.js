import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { messageId } = req.query

  if (req.method === 'POST') {
    const { targetReceiverId, targetGroupId } = req.body
    if (!targetReceiverId && !targetGroupId) return res.status(400).json({ error: 'targetReceiverId or targetGroupId is required' })

    try {
      const msg = await db.queryOne('SELECT * FROM messages WHERE id = ?', [messageId])
      if (!msg) return res.status(404).json({ error: 'Message not found' })

      const isGroup = !!targetGroupId
      const result = await db.insert(
        'INSERT INTO messages (sender_id, receiver_id, group_id, message, message_type, media_url, forwarded_from) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user.id, targetReceiverId || null, targetGroupId || null, msg.message, msg.message_type, msg.media_url, msg.id]
      )

      const newMsg = await db.queryOne(
        'SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?',
        [result.insertId]
      )

      if (global.io) {
        if (isGroup) {
          const members = await db.query('SELECT user_id FROM chat_group_members WHERE group_id = ?', [targetGroupId])
          for (const m of members) {
            global.io.to(`user-${m.user_id}`).emit('chat:message', newMsg)
          }
        } else {
          global.io.to(`user-${user.id}`).emit('chat:message', newMsg)
          global.io.to(`user-${targetReceiverId}`).emit('chat:message', newMsg)
        }
      }

      return res.status(201).json({ message: newMsg })
    } catch (err) {
      console.error('Forward message error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
