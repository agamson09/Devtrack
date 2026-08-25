import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'PUT') {
      const { currentPassword, newPassword } = req.body

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required' })
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' })
      }

      if (!/[A-Z]/.test(newPassword)) {
        return res.status(400).json({ error: 'Password must contain at least 1 uppercase letter' })
      }

      if (!/[a-z]/.test(newPassword)) {
        return res.status(400).json({ error: 'Password must contain at least 1 lowercase letter' })
      }

      if (!/[0-9]/.test(newPassword)) {
        return res.status(400).json({ error: 'Password must contain at least 1 number' })
      }

      const userData = await db.queryOne(
        'SELECT password FROM users WHERE id = ?',
        [user.id]
      )

      const isValid = await bcrypt.compare(currentPassword, userData.password)
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' })
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12)
      const { generateToken } = require('@/lib/auth')
      const newToken = generateToken({ id: user.id, tenant_id: user.tenant_id ?? null, name: user.name, email: user.email, role: user.role })
      await db.update(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, user.id]
      )

      return res.status(200).json({ message: 'Password changed successfully', token: newToken })
    }

    res.setHeader('Allow', ['PUT'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Password change API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
