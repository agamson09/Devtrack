import { getAuthUser } from '@/lib/auth'
import { getNotifications, markAllAsRead } from '@/lib/notifications'

export default async function handler(req, res) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'GET') {
      const { limit, offset } = req.query
      const result = await getNotifications(
        user.id,
        parseInt(limit) || 20,
        parseInt(offset) || 0
      )
      return res.status(200).json(result)
    }

    if (req.method === 'POST') {
      await markAllAsRead(user.id)
      return res.status(200).json({ message: 'All notifications marked as read' })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Notifications API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
