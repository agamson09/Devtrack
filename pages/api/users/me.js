import { getAuthUser } from '@/lib/auth'
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

    if (req.method === 'GET') {
      const userData = await tenantQueryOne(tenantId,
        'SELECT id, name, email, avatar, avatar_style, avatar_seed, avatar_options, role, created_at FROM users WHERE id = ?',
        [user.id]
      )
      return res.status(200).json({ user: userData })
    }

    if (req.method === 'PUT') {
      const { name, email, avatar, avatar_style, avatar_seed, avatar_options } = req.body

      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' })
      }

      const existingUser = await tenantQueryOne(tenantId,
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, user.id]
      )
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' })
      }

      await tenantUpdate(tenantId,
        'UPDATE users SET name = ?, email = ?, avatar = ?, avatar_style = ?, avatar_seed = ?, avatar_options = ? WHERE id = ?',
        [name, email, avatar || null, avatar_style || null, avatar_seed || null, avatar_options ? JSON.stringify(avatar_options) : null, user.id]
      )

      return res.status(200).json({ message: 'Profile updated successfully' })
    }

    res.setHeader('Allow', ['GET', 'PUT'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('User profile API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
