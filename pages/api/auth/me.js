import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
import { createCSRFToken } from '@/lib/session'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const authUser = await getAuthUser(req)

      if (!authUser) {
        return res.status(401).json({ error: 'Not authenticated' })
      }

      const user = await db.queryOne(
        'SELECT id, name, email, avatar, avatar_style, avatar_seed, avatar_options, role, is_active FROM users WHERE id = ?',
        [authUser.id]
      )

      if (!user) {
        return res.status(401).json({ error: 'User not found' })
      }

      // Refresh CSRF token on every auth check
      let csrfToken = null
      try {
        csrfToken = await createCSRFToken(user.id)
      } catch (e) { console.error('CSRF refresh error:', e) }

      return res.status(200).json({ user, csrfToken })
    } catch (error) {
      console.error('Auth check error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.setHeader('Set-Cookie', [
      `devtrack_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag}`,
      `devtrack_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag}`,
      `devtrack_csrf=; Path=/; SameSite=Strict; Max-Age=0${secureFlag}`
    ])
    return res.status(200).json({ message: 'Logged out' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
