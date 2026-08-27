import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQuery, tenantQueryOne, tenantInsert, tenantRemove } = db
import { getTenantFromRequest } from '@/lib/tenant'

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
      const members = await tenantQuery(tenantId, `
        SELECT u.id, u.name, u.avatar, u.avatar_style, u.avatar_seed, u.avatar_options, u.role, cgm.joined_at
        FROM chat_group_members cgm
        JOIN users u ON cgm.user_id = u.id
        WHERE cgm.group_id = ?
        ORDER BY cgm.joined_at ASC
      `, [groupId])

      return res.status(200).json({ members })
    } catch (err) {
      console.error('List members error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    const { userIds } = req.body
    if (!userIds || !userIds.length) {
      return res.status(400).json({ error: 'userIds is required' })
    }

    try {
      for (const uid of userIds) {
        await tenantInsert(
          tenantId,
          'INSERT IGNORE INTO chat_group_members (group_id, user_id) VALUES (?, ?)',
          [groupId, uid]
        )
      }

      return res.status(200).json({ message: 'Members added' })
    } catch (err) {
      console.error('Add members error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    const { userId } = req.query
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    try {
      await tenantRemove(
        tenantId,
        'DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?',
        [groupId, userId]
      )

      return res.status(200).json({ message: 'Member removed' })
    } catch (err) {
      console.error('Remove member error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'GET' && req.query.media === '1') {
    try {
      const media = await tenantQuery(tenantId, `
        SELECT m.id, m.media_url, m.created_at, u.name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.group_id = ? AND m.message_type = 'image' AND m.media_url IS NOT NULL
        ORDER BY m.created_at DESC
      `, [groupId])
      return res.status(200).json({ media })
    } catch (err) {
      console.error('Group media error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
