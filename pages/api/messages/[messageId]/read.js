import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQuery, tenantQueryOne, tenantInsert } = db
import { getTenantFromRequest } from '@/lib/tenant'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantFromRequest(req)
  const { messageId } = req.query

  if (req.method === 'GET') {
    try {
      const readers = await tenantQuery(tenantId, `
        SELECT mr.user_id, mr.read_at, u.name, u.avatar, u.avatar_style, u.avatar_seed, u.avatar_options
        FROM message_reads mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id = ?
        ORDER BY mr.read_at ASC
      `, [messageId])
      return res.status(200).json({ readers })
    } catch (err) {
      console.error('Get read-by error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    try {
      await tenantQuery(tenantId, `
        INSERT IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)
      `, [messageId, user.id])
      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('Mark read error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
