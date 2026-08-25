import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'

export default async function handler(req, res) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'GET') {
      const settings = await db.queryOne(
        'SELECT telegram_chat_id, email_notifications, telegram_notifications FROM users WHERE id = ?',
        [user.id]
      )
      return res.status(200).json({ settings })
    }

    if (req.method === 'PUT') {
      const { telegram_chat_id, email_notifications, telegram_notifications } = req.body

      await db.update(
        'UPDATE users SET telegram_chat_id = ?, email_notifications = ?, telegram_notifications = ? WHERE id = ?',
        [telegram_chat_id || null, email_notifications ? 1 : 0, telegram_notifications ? 1 : 0, user.id]
      )

      return res.status(200).json({ message: 'Settings updated successfully' })
    }

    res.setHeader('Allow', ['GET', 'PUT'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('User settings API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
