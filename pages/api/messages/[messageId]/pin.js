import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQueryOne, tenantQuery } = db
import { getTenantFromRequest } from '@/lib/tenant'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantFromRequest(req)
  const { messageId } = req.query

  if (req.method === 'POST') {
    try {
      const msg = await tenantQueryOne(tenantId, 'SELECT id, is_pinned, group_id, sender_id FROM messages WHERE id = ?', [messageId])
      if (!msg) return res.status(404).json({ error: 'Message not found' })

      const newPinned = msg.is_pinned ? 0 : 1
      await tenantQuery(tenantId, 'UPDATE messages SET is_pinned = ? WHERE id = ?', [newPinned, messageId])
      return res.status(200).json({ is_pinned: newPinned })
    } catch (err) {
      console.error('Pin message error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
