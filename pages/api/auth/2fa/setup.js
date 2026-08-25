import { getAuthUser } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import * as otplib from 'otplib'
import QRCode from 'qrcode'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const existing = await queryOne('SELECT two_factor_enabled FROM users WHERE id = ?', [user.id])
    if (existing?.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled. Disable it first.' })
    }

    const secret = otplib.generateSecret()
    const otpauth = otplib.generateURI({ secret, label: user.email || user.name, issuer: 'DevTrack' })

    await query('UPDATE users SET two_factor_secret = ? WHERE id = ?', [secret, user.id])

    const qrDataUrl = await QRCode.toDataURL(otpauth)

    return res.status(200).json({
      secret,
      qrCode: qrDataUrl,
      otpauth,
    })
  } catch (error) {
    console.error('2FA setup error:', error)
    return res.status(500).json({ error: 'Failed to setup 2FA' })
  }
}
