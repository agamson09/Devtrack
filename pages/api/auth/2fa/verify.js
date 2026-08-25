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
    return res.status(400).json({ error: 'Token is required' })
  }

  try {
    const userData = await queryOne('SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ?', [user.id])
    if (!userData?.two_factor_secret) {
      return res.status(400).json({ error: '2FA not set up. Run setup first.' })
    }

    if (userData.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' })
    }

    const result = otplib.verifySync({ token: token.trim(), secret: userData.two_factor_secret })
    const isValid = result && result.valid
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid token. Check your authenticator app.' })
    }

    await query('UPDATE users SET two_factor_enabled = 1 WHERE id = ?', [user.id])
    await logSecurityEvent(user.id, '2fa_enabled', '2FA enabled', req, 'low')

    return res.status(200).json({ success: true, message: '2FA enabled successfully' })
  } catch (error) {
    console.error('2FA verify error:', error)
    return res.status(500).json({ error: 'Failed to verify 2FA' })
  }
}
