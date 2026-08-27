import db from '@/lib/db'
const dbPool = db.pool
import { verifyToken } from '@/lib/auth'
import { syncUserToTenantDb } from '@/lib/tenant'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  const token = req.cookies.devtrack_token || req.cookies.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const decoded = verifyToken(token)
  if (!decoded) return res.status(401).json({ error: 'Invalid token' })

  // Get user info
  const [users] = await dbPool.execute('SELECT id, tenant_id, role FROM users WHERE id = ?', [decoded.id])
  const currentUser = users[0]
  if (!currentUser) return res.status(401).json({ error: 'User not found' })

  const tenantId = currentUser.tenant_id || 1

  // ── POST: Send invite ──
  if (req.method === 'POST') {
    try {
      // Verify caller is admin/owner
      const [roleCheck] = await dbPool.execute(
        'SELECT role FROM tenant_users WHERE tenant_id = ? AND user_id = ?',
        [tenantId, decoded.id]
      )
      const myTenantRole = roleCheck[0]?.role
      if (myTenantRole !== 'owner' && myTenantRole !== 'admin' && currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin or owner access required' })
      }

      const { email, role, name, password } = req.body
      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'Email is required' })
      }

      const inviteRole = role || 'member'
      if (!['admin', 'member', 'viewer'].includes(inviteRole)) {
        return res.status(400).json({ error: 'Invalid role' })
      }

      // Check if user already exists
      const [existingUser] = await dbPool.execute('SELECT id, name FROM users WHERE email = ?', [email.trim()])
      
      if (existingUser.length > 0) {
        // User exists — just add them to the tenant
        const targetUserId = existingUser[0].id
        
        const [alreadyMember] = await dbPool.execute(
          'SELECT id FROM tenant_users WHERE tenant_id = ? AND user_id = ?',
          [tenantId, targetUserId]
        )
        if (alreadyMember.length > 0) {
          return res.status(400).json({ error: 'User is already a member of this tenant' })
        }

        await dbPool.execute(
          'INSERT INTO tenant_users (tenant_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)',
          [tenantId, targetUserId, inviteRole, decoded.id]
        )
        await dbPool.execute('UPDATE users SET tenant_id = ? WHERE id = ?', [tenantId, targetUserId])

        // Sync user to workspace database
        await syncUserToTenantDb(targetUserId, tenantId, inviteRole)

        return res.status(200).json({
          success: true,
          message: `${existingUser[0].name} has been added to the team`,
          type: 'added'
        })
      }

      // User doesn't exist — create invite token
      const inviteToken = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      // Check for existing pending invite
      const [existingInvite] = await dbPool.execute(
        'SELECT id FROM tenant_invites WHERE tenant_id = ? AND email = ? AND status = ?',
        [tenantId, email.trim(), 'pending']
      )
      if (existingInvite.length > 0) {
        // Update existing invite
        await dbPool.execute(
          'UPDATE tenant_invites SET token = ?, role = ?, expires_at = ?, invited_by = ? WHERE id = ?',
          [inviteToken, inviteRole, expiresAt, decoded.id, existingInvite[0].id]
        )
      } else {
        await dbPool.execute(
          'INSERT INTO tenant_invites (tenant_id, email, role, token, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
          [tenantId, email.trim(), inviteRole, inviteToken, decoded.id, expiresAt]
        )
      }

      // If password provided, create the user account now
      if (password && password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)) {
        const hashedPassword = await bcrypt.hash(password, 10)
        const avatarStyles = ['lorelei', 'bottts', 'pixel-art', 'avataaars', 'fun-emoji', 'identicon', 'personas']
        const defaultStyle = avatarStyles[Math.floor(Math.random() * avatarStyles.length)]
        const defaultSeed = (name || email.split('@')[0]).toLowerCase().replace(/\s+/g, '')

        const [result] = await dbPool.execute(
          'INSERT INTO users (name, email, password, role, tenant_id, avatar_style, avatar_seed, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          [name || email.split('@')[0], email.trim(), hashedPassword, 'member', tenantId, defaultStyle, defaultSeed]
        )

        // Add to tenant_users
        await dbPool.execute(
          'INSERT INTO tenant_users (tenant_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)',
          [tenantId, result.insertId, inviteRole, decoded.id]
        )

        // Sync new user to workspace database
        await syncUserToTenantDb(result.insertId, tenantId, inviteRole)

        // Mark invite as accepted
        await dbPool.execute(
          'UPDATE tenant_invites SET status = ? WHERE token = ?',
          ['accepted', inviteToken]
        )

        return res.status(201).json({
          success: true,
          message: `Account created and added to team`,
          type: 'created',
          inviteToken
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Invite token generated',
        type: 'invited',
        inviteToken,
        inviteUrl: `/invite/${inviteToken}`
      })
    } catch (error) {
      console.error('[tenant/invite] POST error:', error)
      return res.status(500).json({ error: 'Failed to send invite' })
    }
  }

  // ── GET: Check invite status / accept invite ──
  if (req.method === 'GET') {
    try {
      const { token: inviteToken } = req.query

      if (!inviteToken) {
        // List invites for this tenant
        const [invites] = await dbPool.execute(
          `SELECT ti.id, ti.email, ti.role, ti.status, ti.expires_at, ti.created_at,
                  inv.name as invited_by_name
           FROM tenant_invites ti
           LEFT JOIN users inv ON ti.invited_by = inv.id
           WHERE ti.tenant_id = ? AND ti.status = 'pending'
           ORDER BY ti.created_at DESC`,
          [tenantId]
        )
        return res.status(200).json({ invites })
      }

      // Validate specific invite token
      const [invites] = await dbPool.execute(
        `SELECT ti.*, t.name as tenant_name
         FROM tenant_invites ti
         JOIN tenants t ON ti.tenant_id = t.id
         WHERE ti.token = ? AND ti.status = 'pending'`,
        [inviteToken]
      )

      const invite = invites[0]
      if (!invite) {
        return res.status(404).json({ error: 'Invite not found or already used' })
      }

      if (new Date(invite.expires_at) < new Date()) {
        await dbPool.execute('UPDATE tenant_invites SET status = ? WHERE id = ?', ['expired', invite.id])
        return res.status(410).json({ error: 'Invite has expired' })
      }

      return res.status(200).json({
        valid: true,
        email: invite.email,
        role: invite.role,
        tenantName: invite.tenant_name,
        expiresAt: invite.expires_at
      })
    } catch (error) {
      console.error('[tenant/invite] GET error:', error)
      return res.status(500).json({ error: 'Failed to check invite' })
    }
  }

  // ── DELETE: Revoke invite ──
  if (req.method === 'DELETE') {
    try {
      const { inviteId } = req.body
      if (!inviteId) return res.status(400).json({ error: 'inviteId required' })

      await dbPool.execute(
        'DELETE FROM tenant_invites WHERE id = ? AND tenant_id = ?',
        [inviteId, tenantId]
      )

      return res.status(200).json({ success: true, message: 'Invite revoked' })
    } catch (error) {
      console.error('[tenant/invite] DELETE error:', error)
      return res.status(500).json({ error: 'Failed to revoke invite' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
