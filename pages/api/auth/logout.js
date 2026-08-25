import { getAuthUser } from '@/lib/auth'
import { destroySession, logSecurityEvent } from '@/lib/session'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthUser(req)

  const sessionToken = req.cookies?.devtrack_session || null

  if (sessionToken) {
    if (user) {
      await logSecurityEvent(user.id, 'logout', 'User logged out', req, 'low')
    }
    await destroySession(sessionToken)
  }

  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', [
    `devtrack_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag}`,
    `devtrack_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag}`,
    `devtrack_csrf=; Path=/; SameSite=Strict; Max-Age=0${secureFlag}`
  ])

  return res.status(200).json({ success: true })
}
