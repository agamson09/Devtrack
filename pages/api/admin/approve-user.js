import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Approve via Frontend Dashboard
    try {
      const session = getAuthUser(req)
      if (!session || session.id !== 1) {
        return res.status(403).json({ error: 'Forbidden. Only system admins can perform this action.' })
      }

      const { targetUserId } = req.body
      if (!targetUserId) {
        return res.status(400).json({ error: 'User ID is required' })
      }

      const users = await query('SELECT id, is_approved FROM users WHERE id = ?', [targetUserId])
      if (users.length === 0) return res.status(404).json({ error: 'User not found' })
      if (users[0].is_approved) return res.status(400).json({ error: 'User is already approved' })

      await query('UPDATE users SET is_approved = 1 WHERE id = ?', [targetUserId])
      return res.status(200).json({ message: 'User successfully approved' })
    } catch (err) {
      console.error('Approve via dashboard error:', err)
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }
  
  if (req.method === 'GET') {
    // Approve via Email Magic Link
    const { token } = req.query
    
    if (!token) {
      return res.status(400).send('Invalid or missing token.')
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      if (decoded.action !== 'approve' || !decoded.userId) {
        return res.status(400).send('Invalid token payload.')
      }

      const users = await query('SELECT id, is_approved, name FROM users WHERE id = ?', [decoded.userId])
      
      if (users.length === 0) {
        return res.status(404).send('User not found.')
      }

      if (users[0].is_approved) {
        return res.status(200).send(`User ${users[0].name} is already approved. They can login now.`)
      }

      await query('UPDATE users SET is_approved = 1 WHERE id = ?', [decoded.userId])

      return res.status(200).send(`
        <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
          <h1 style="color: #4ade80;">Success!</h1>
          <p>User <strong>${users[0].name}</strong> has been successfully approved.</p>
          <a href="/login?approved=1" style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:5px;">Go to Login</a>
        </div>
      `)
    } catch (error) {
      console.error('Approval error:', error)
      return res.status(400).send('Invalid or expired token.')
    }
  }

  return res.status(405).send('Method not allowed.')
}
