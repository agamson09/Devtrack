import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQuery } = db
import { getTenantFromRequest } from '@/lib/tenant'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'GET') {
    const { userId } = req.query

    if (req.query.media === '1') {
      try {
        const media = await tenantQuery(tenantId, `
          SELECT m.id, m.media_url, m.created_at, u.name as sender_name
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
            AND m.message_type = 'image' AND m.media_url IS NOT NULL
          ORDER BY m.created_at DESC
        `, [user.id, userId, userId, user.id])
        return res.status(200).json({ media })
      } catch (err) {
        console.error('Chat media error:', err)
        return res.status(500).json({ error: 'Internal server error' })
      }
    }

    try {
      const messages = await tenantQuery(tenantId, `
        SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.avatar_style as sender_avatar_style, u.avatar_seed as sender_avatar_seed, u.avatar_options as sender_avatar_options,
          rm.message as reply_message, rm.sender_id as reply_sender_id, rm.message_type as reply_message_type,
          ru.name as reply_sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN messages rm ON m.reply_to = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
        LIMIT 200
      `, [user.id, userId, userId, user.id])

      await tenantQuery(tenantId,
        'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
        [userId, user.id]
      )

      // Also mark chat notifications from this user as read
      await tenantQuery(tenantId,
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type IN ('chat_message', 'chat_mention') AND actor_id = ? AND is_read = 0",
        [user.id, userId]
      )

      return res.status(200).json({ messages })
    } catch (err) {
      console.error('Chat messages error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET'])
  return res.status(405).json({ error: 'Method not allowed' })
}
