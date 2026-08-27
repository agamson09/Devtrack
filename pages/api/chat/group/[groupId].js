import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQuery, tenantQueryOne, tenantInsert } = db
import { getTenantFromRequest } from '@/lib/tenant'
import { sendPushNotification } from '@/lib/push'
import { notifyChatMention, notifyGroupMessageOffline } from '@/lib/notifications'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantFromRequest(req)
  const { groupId } = req.query

  const membership = await tenantQueryOne(
    tenantId,
    'SELECT id FROM chat_group_members WHERE group_id = ? AND user_id = ?',
    [groupId, user.id]
  )
  if (!membership) {
    return res.status(403).json({ error: 'You are not a member of this group' })
  }

  if (req.method === 'GET') {
    try {
      const messages = await tenantQuery(tenantId, `
        SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.avatar_style as sender_avatar_style, u.avatar_seed as sender_avatar_seed, u.avatar_options as sender_avatar_options,
          rm.message as reply_message, rm.sender_id as reply_sender_id, rm.message_type as reply_message_type,
          ru.name as reply_sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN messages rm ON m.reply_to = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE m.group_id = ?
        ORDER BY m.created_at ASC
        LIMIT 200
      `, [groupId])

      await tenantQuery(tenantId,
        'UPDATE messages SET is_read = 1 WHERE group_id = ? AND sender_id != ? AND is_read = 0',
        [groupId, user.id]
      )

      // Also mark group notifications as read when opening group chat
      await tenantQuery(tenantId,
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type IN ('group_message', 'group_mention') AND source_id = ? AND is_read = 0",
        [user.id, groupId]
      )

      return res.status(200).json({ messages })
    } catch (err) {
      console.error('Group messages error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    const { message, messageType, mediaUrl, replyTo } = req.body
    const msgType = messageType || 'text'
    const msgContent = (message || '').trim()

    if (msgType === 'text' && !msgContent) {
      return res.status(400).json({ error: 'Message is required' })
    }

    try {
      const result = await tenantInsert(
        tenantId,
        'INSERT INTO messages (sender_id, receiver_id, group_id, message, message_type, media_url, reply_to) VALUES (?, NULL, ?, ?, ?, ?, ?)',
        [user.id, groupId, msgContent, msgType, mediaUrl || null, replyTo || null]
      )

      const msgs = await tenantQuery(
        tenantId,
        'SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.avatar_style as sender_avatar_style, u.avatar_seed as sender_avatar_seed, u.avatar_options as sender_avatar_options FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?',
        [result.insertId]
      )
      const msg = msgs[0]

      if (global.io) {
        const members = await tenantQuery(
          tenantId,
          'SELECT user_id FROM chat_group_members WHERE group_id = ?',
          [groupId]
        )
        for (const m of members) {
          if (m.user_id !== user.id) {
            global.io.to(`user-${m.user_id}`).emit('chat:message', msg)
            if (!global.io.sockets.adapter.rooms.get(`user-${m.user_id}`)) {
              const groupName = await tenantQueryOne(tenantId, 'SELECT name FROM chat_groups WHERE id = ?', [groupId])
              sendPushNotification(m.user_id, {
                title: `${user.name} in ${groupName?.name || 'Group'}`,
                body: msgContent.substring(0, 200),
                url: `/dashboard/chat`,
                tag: `group-${groupId}`,
              }).catch(e => console.error('Group push error:', e))
            }
          }
        }
        global.io.to(`user-${user.id}`).emit('chat:message', msg)
      }

      try {
        await notifyChatMention(user.id, user.name, msgContent, 'group', groupId)
        const members = await tenantQuery(
          tenantId,
          'SELECT user_id FROM chat_group_members WHERE group_id = ? AND user_id != ?',
          [groupId, user.id]
        )
        // Create notification records for ALL members so Header badge updates
        const groupNameRow = await tenantQueryOne(tenantId, 'SELECT name FROM chat_groups WHERE id = ?', [groupId])
        for (const m of members) {
          try {
            const notifResult = await tenantInsert(
              tenantId,
              'INSERT INTO notifications (user_id, type, title, message, link, source_type, source_id, actor_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())',
              [m.user_id, 'group_message', `${user.name} in ${groupNameRow?.name || 'Group'}`, msgContent.substring(0, 200), `/dashboard/chat?group=${groupId}`, 'group', groupId, user.id]
            )
            if (global.io) {
              const memberSocket = global.io.sockets?.adapter?.rooms?.get(`user-${m.user_id}`)
              if (memberSocket) {
                global.io.to(`user-${m.user_id}`).emit('notification:new', {
                  id: notifResult.insertId,
                  user_id: m.user_id,
                  type: 'group_message',
                  title: `${user.name} in ${groupNameRow?.name || 'Group'}`,
                  message: msgContent.substring(0, 200),
                  link: `/dashboard/chat?group=${groupId}`,
                  source_type: 'group',
                  source_id: groupId,
                  actor_id: user.id,
                  is_read: 0,
                  created_at: new Date().toISOString(),
                })
                const unreadRows = await tenantQuery(
                  tenantId,
                  'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
                  [m.user_id]
                )
                global.io.to(`user-${m.user_id}`).emit('notification:unread-count', { unreadCount: unreadRows[0].count })
              }
            }
          } catch (e) {
            console.error('Group notification record failed for user', m.user_id, e.message)
          }
        }
      } catch (e) { console.error('Group mention notification error:', e) }

      return res.status(201).json({ message: msg })
    } catch (err) {
      console.error('Group send error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
