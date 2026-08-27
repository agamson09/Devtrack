import { getAuthUser } from '@/lib/auth'
import { markAsRead } from '@/lib/notifications'
import db from '@/lib/db'
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate, tenantRemove } = db
import { getTenantFromRequest } from '@/lib/tenant'

export default async function handler(req, res) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const tenantId = await getTenantFromRequest(req)

    if (req.method === 'PUT') {
      const { id } = req.query
      // Verify ownership — only allow marking own notifications as read
      const notif = await tenantQueryOne(tenantId, 'SELECT user_id FROM notifications WHERE id = ?', [parseInt(id)])
      if (!notif) return res.status(404).json({ error: 'Notification not found' })
      if (notif.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' })
      await markAsRead(parseInt(id))
      return res.status(200).json({ message: 'Notification marked as read' })
    }

    res.setHeader('Allow', ['PUT'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Notification API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
