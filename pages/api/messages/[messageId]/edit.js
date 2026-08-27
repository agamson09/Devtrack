import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQueryOne, tenantQuery } = db
import { getTenantFromRequest } from '@/lib/tenant'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantFromRequest(req)
  const { messageId } = req.query

  if (req.method === 'PUT') {
    const { message } = req.body
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' })

    try {
      const msg = await tenantQueryOne(tenantId, 'SELECT * FROM messages WHERE id = ?', [messageId])
      if (!msg) return res.status(404).json({ error: 'Message not found' })
      if (msg.sender_id !== user.id) return res.status(403).json({ error: 'You can only edit your own messages' })
      if (msg.is_deleted) return res.status(400).json({ error: 'Cannot edit deleted message' })

      await tenantQuery(tenantId, 'UPDATE messages SET message = ?, is_edited = 1 WHERE id = ?', [message.trim(), messageId])
      return res.status(200).json({ message: { ...msg, message: message.trim(), is_edited: 1 } })
    } catch (err) {
      console.error('Edit message error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const msg = await tenantQueryOne(tenantId, 'SELECT * FROM messages WHERE id = ?', [messageId])
      if (!msg) return res.status(404).json({ error: 'Message not found' })
      if (msg.sender_id !== user.id) return res.status(403).json({ error: 'You can only delete your own messages' })

      if (msg.message_type === 'image' || msg.message_type === 'voice') {
        await tenantQuery(tenantId, 'UPDATE messages SET is_deleted = 1, message = NULL, media_url = NULL WHERE id = ?', [messageId])
      } else {
        await tenantQuery(tenantId, 'UPDATE messages SET is_deleted = 1, message = NULL WHERE id = ?', [messageId])
      }
      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('Delete message error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
