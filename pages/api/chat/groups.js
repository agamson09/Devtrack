import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    try {
      const groups = await db.query(`
        SELECT cg.id, cg.name, cg.created_by, cg.created_at,
          (
            SELECT COUNT(*) FROM chat_group_members WHERE group_id = cg.id
          ) as member_count,
          (
            SELECT m.message FROM messages m
            WHERE m.group_id = cg.id
            ORDER BY m.created_at DESC LIMIT 1
          ) as last_message,
          (
            SELECT m.message_type FROM messages m
            WHERE m.group_id = cg.id
            ORDER BY m.created_at DESC LIMIT 1
          ) as last_message_type,
          (
            SELECT m.created_at FROM messages m
            WHERE m.group_id = cg.id
            ORDER BY m.created_at DESC LIMIT 1
          ) as last_message_at,
          (
            SELECT m.sender_id FROM messages m
            WHERE m.group_id = cg.id
            ORDER BY m.created_at DESC LIMIT 1
          ) as last_sender,
          (
            SELECT COUNT(*) FROM messages m
            WHERE m.group_id = cg.id AND m.sender_id != ? AND m.is_read = 0
          ) as unread_count
        FROM chat_groups cg
        INNER JOIN chat_group_members cgm ON cg.id = cgm.group_id
        WHERE cgm.user_id = ?
        ORDER BY last_message_at DESC, cg.created_at DESC
      `, [user.id, user.id])

      return res.status(200).json({ groups })
    } catch (err) {
      console.error('List groups error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    const { name, memberIds } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' })
    }

    try {
      const result = await db.insert(
        'INSERT INTO chat_groups (name, created_by, created_at) VALUES (?, ?, NOW())',
        [name.trim(), user.id]
      )
      const groupId = result.insertId

      await db.insert(
        'INSERT INTO chat_group_members (group_id, user_id) VALUES (?, ?)',
        [groupId, user.id]
      )

      if (memberIds && memberIds.length > 0) {
        const uniqueMembers = [...new Set(memberIds.filter(id => id != user.id))]
        for (const memberId of uniqueMembers) {
          await db.insert(
            'INSERT IGNORE INTO chat_group_members (group_id, user_id) VALUES (?, ?)',
            [groupId, memberId]
          )
        }
      }

      const group = await db.queryOne('SELECT * FROM chat_groups WHERE id = ?', [groupId])

      if (global.io) {
        const allMembers = await db.query(
          'SELECT user_id FROM chat_group_members WHERE group_id = ?',
          [groupId]
        )
        for (const m of allMembers) {
          global.io.to(`user-${m.user_id}`).emit('chat:group-created', group)
        }
      }

      return res.status(201).json({ group })
    } catch (err) {
      console.error('Create group error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
