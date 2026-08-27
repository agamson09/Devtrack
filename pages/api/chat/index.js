import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQuery, tenantQueryOne, tenantInsert } = db
import { getTenantFromRequest } from '@/lib/tenant'
import { validateData } from '@/lib/middleware'
import { requireCSRF } from '@/lib/csrf'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'GET') {
    try {
      let query = `
        SELECT 
          u.id, u.name, u.avatar, u.avatar_style, u.avatar_seed, u.avatar_options, u.role,
          CASE WHEN m.message_type = 'image' THEN 'Image' ELSE m.message END as last_message,
          m.message_type as last_message_type,
          m.created_at as last_message_at,
          m.sender_id as last_sender,
          (
            SELECT COUNT(*) FROM messages 
            WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0
          ) as unread_count
        FROM users u
        INNER JOIN messages m ON (
          (m.sender_id = u.id AND m.receiver_id = ?) OR
          (m.sender_id = ? AND m.receiver_id = u.id)
        )
        AND m.id = (
          SELECT MAX(m2.id) FROM messages m2
          WHERE (m2.sender_id = u.id AND m2.receiver_id = ?)
             OR (m2.sender_id = ? AND m2.receiver_id = u.id)
        )
        WHERE u.id != ?
      `
      const params = [user.id, user.id, user.id, user.id, user.id, user.id]

      // Tenant scoping: only show users in same tenant
      if (tenantId) {
        query += ` AND u.id IN (SELECT user_id FROM tenant_users WHERE tenant_id = ?)`
        params.push(tenantId)
      }

      query += ' ORDER BY m.created_at DESC'

      const conversations = await tenantQuery(tenantId, query, params)

      return res.status(200).json({ conversations })
    } catch (err) {
      console.error('Chat list error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    if (!(await requireCSRF(req, res))) return
    const { valid, data, errors } = validateData(req.body, 'sendMessage')
    if (!valid) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    const { receiverId, message, message_type, mediaUrl, replyTo } = data
    const msgType = message_type || 'text'
    const msgContent = message

    try {
      // Verify receiver exists and is in same tenant
      if (tenantId) {
        const receiver = await tenantQueryOne(
          tenantId,
          'SELECT id FROM users WHERE id = ? AND id IN (SELECT user_id FROM tenant_users WHERE tenant_id = ?)',
          [receiverId, tenantId]
        )
        if (!receiver) {
          return res.status(404).json({ error: 'User not found in your organization' })
        }
      }

      const result = await tenantInsert(
        tenantId,
        'INSERT INTO messages (sender_id, receiver_id, message, message_type, media_url, reply_to, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user.id, receiverId, msgContent, msgType, mediaUrl || null, replyTo || null, tenantId]
      )

      const msgs = await tenantQuery(
        tenantId,
        'SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.avatar_style as sender_avatar_style, u.avatar_seed as sender_avatar_seed, u.avatar_options as sender_avatar_options FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?',
        [result.insertId]
      )
      const msg = msgs[0]

      if (global.io) {
        global.io.to(`user-${user.id}`).emit('chat:message', msg)
        global.io.to(`user-${receiverId}`).emit('chat:message', msg)
        global.io.to(`user-${receiverId}`).emit('chat:conversation-update', {
          userId: user.id,
          lastMessage: msgType === 'image' ? 'Image' : msgContent,
          timestamp: msg.created_at,
        })

        // Create notification record
        try {
          const notifResult = await tenantInsert(
            tenantId,
            'INSERT INTO notifications (user_id, type, title, message, link, source_type, source_id, actor_id, tenant_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())',
            [receiverId, 'chat_message', user.name || 'Someone', (msgContent || '').substring(0, 200), '/dashboard/chat', 'chat', null, user.id, tenantId]
          )
          const notifId = notifResult.insertId
          global.io.to(`user-${receiverId}`).emit('notification:new', {
            id: notifId,
            user_id: receiverId,
            type: 'chat_message',
            title: user.name || 'Someone',
            message: (msgContent || '').substring(0, 200),
            link: '/dashboard/chat',
            source_type: 'chat',
            source_id: null,
            actor_id: user.id,
            is_read: 0,
            created_at: new Date().toISOString(),
          })
          const unreadRows = await tenantQuery(
            tenantId,
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [receiverId]
          )
          global.io.to(`user-${receiverId}`).emit('notification:unread-count', { unreadCount: unreadRows[0].count })
        } catch (e) {
          console.error('Chat notification record failed:', e.message)
        }
      }

      return res.status(201).json({ message: msg })
    } catch (err) {
      console.error('Chat send error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
