import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = getAuthUser(req)
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Only user ID 1 (or global admins) can access this
    if (session.id !== 1) {
      return res.status(403).json({ error: 'Forbidden. Only system admins can access this.' })
    }

    // Fetch users who are not approved yet
    const pendingUsers = await query(
      'SELECT id, name, email, created_at FROM users WHERE is_approved = 0 ORDER BY created_at DESC'
    )

    return res.status(200).json({ users: pendingUsers })
  } catch (error) {
    console.error('Fetch pending users error:', error)
    return res.status(500).json({ error: 'Failed to fetch pending users' })
  }
}
