import { getAuthUser } from '@/lib/auth'
import { saveSubscription, removeSubscription } from '@/lib/push'

export default async function handler(req, res) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'POST') {
      const { subscription } = req.body
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ error: 'Invalid subscription' })
      }

      const userAgent = req.headers['user-agent'] || null
      const id = await saveSubscription(user.id, subscription, userAgent)
      return res.status(200).json({ success: true, id })
    }

    if (req.method === 'DELETE') {
      const { endpoint } = req.body
      if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint required' })
      }

      await removeSubscription(endpoint)
      return res.status(200).json({ success: true })
    }

    res.setHeader('Allow', ['POST', 'DELETE'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Push subscribe API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
