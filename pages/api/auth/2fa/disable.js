import { getAuthUser } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import * as otplib from 'otplib'
import { logSecurityEvent } from '@/lib/session'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { token } = req.body
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token is required to disable 2FA' })
  }

  try {
    const userData = await queryOne('SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ?', [user.id])
    if (!userData?.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is not enabled' })
    }

    const result = otplib.verifySync({ token: token.trim(), secret: userData.two_factor_secret })
    const isValid = result && result.valid
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid token. Check your authenticator app.' })
    }

    await query('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?', [user.id])
    await logSecurityEvent(user.id, '2fa_disabled', '2FA disabled', req, 'medium')

    return res.status(200).json({ success: true, message: '2FA disabled successfully' })
  } catch (error) {
    console.error('2FA disable error:', error)
    return res.status(500).json({ error: 'Failed to disable 2FA' })
  }
}
