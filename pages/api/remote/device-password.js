import bcrypt from 'bcryptjs'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

const pool = db.pool

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'POST') {
    // Set/update device password
    const { deviceId, password, unattendedEnabled } = req.body

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ error: 'Device ID is required' })
    }

    try {
      const [existing] = await pool.execute('SELECT id FROM remote_devices WHERE device_id = ?', [deviceId.trim()])
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Device not found' })
      }

      let hash = null
      if (password && password.length > 0) {
        if (password.length < 4) {
          return res.status(400).json({ error: 'Password must be at least 4 characters' })
        }
        hash = await bcrypt.hash(password, 10)
      }

      await pool.execute(
        'UPDATE remote_devices SET device_password_hash = ?, unattended_enabled = ? WHERE device_id = ?',
        [hash, unattendedEnabled !== false ? 1 : 0, deviceId.trim()]
      )

      console.log(`[device] Password updated for ${deviceId} by ${user.name}`)

      return res.status(200).json({
        success: true,
        message: hash ? 'Password set successfully' : 'Password removed',
        deviceId: deviceId.trim()
      })
    } catch (error) {
      console.error('[device] Password update error:', error)
      return res.status(500).json({ error: 'Failed to update password' })
    }
  }

  if (req.method === 'DELETE') {
    // Remove device password
    const { deviceId } = req.query

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' })
    }

    try {
      await pool.execute(
        'UPDATE remote_devices SET device_password_hash = NULL, unattended_enabled = 0 WHERE device_id = ?',
        [deviceId]
      )

      return res.status(200).json({ success: true, message: 'Password removed' })
    } catch (error) {
      return res.status(500).json({ error: 'Failed to remove password' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
