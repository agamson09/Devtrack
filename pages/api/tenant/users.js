import db from '@/lib/db'
const dbPool = db.pool
import { verifyToken } from '@/lib/auth'

export default async function handler(req, res) {
  const token = req.cookies.devtrack_token || req.cookies.token || req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const decoded = verifyToken(token)
  if (!decoded) return res.status(401).json({ error: 'Invalid token' })

  // Get user's tenant
  const [users] = await dbPool.execute('SELECT id, tenant_id, role FROM users WHERE id = ?', [decoded.id])
  const currentUser = users[0]
  if (!currentUser) return res.status(401).json({ error: 'User not found' })

  const tenantId = currentUser.tenant_id || 1

  // ── GET: List users in this tenant ──
  if (req.method === 'GET') {
    try {
      const [members] = await dbPool.execute(
        `SELECT tu.id as membership_id, tu.role as tenant_role, tu.joined_at,
                u.id, u.name, u.email, u.avatar, u.avatar_style, u.avatar_seed, u.avatar_options, u.is_active,
                (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id) as task_count,
                CASE WHEN tu.invited_by IS NOT NULL THEN inv.name ELSE NULL END as invited_by_name
         FROM tenant_users tu
         JOIN users u ON tu.user_id = u.id
         LEFT JOIN users inv ON tu.invited_by = inv.id
         WHERE tu.tenant_id = ?
         ORDER BY
           FIELD(tu.role, 'owner', 'admin', 'member', 'viewer'),
           u.name ASC`,
        [tenantId]
      )

      const [pendingInvites] = await dbPool.execute(
        `SELECT ti.id, ti.email, ti.role, ti.status, ti.expires_at, ti.created_at,
                inv.name as invited_by_name
         FROM tenant_invites ti
         LEFT JOIN users inv ON ti.invited_by = inv.id
         WHERE ti.tenant_id = ? AND ti.status = 'pending'
         ORDER BY ti.created_at DESC`,
        [tenantId]
      )

      return res.status(200).json({ members, pendingInvites })
    } catch (error) {
      console.error('[tenant/users] GET error:', error)
      return res.status(500).json({ error: 'Failed to load members' })
    }
  }

  // Only admins/owners can modify
  const [roleCheck] = await dbPool.execute(
    'SELECT role FROM tenant_users WHERE tenant_id = ? AND user_id = ?',
    [tenantId, decoded.id]
  )
  const myTenantRole = roleCheck[0]?.role
  if (myTenantRole !== 'owner' && myTenantRole !== 'admin' && currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin or owner access required' })
  }

  // ── POST: Add existing user to tenant ──
  if (req.method === 'POST') {
    try {
      const { userId, email, role } = req.body
      const memberRole = role || 'member'

      if (!['admin', 'member', 'viewer'].includes(memberRole)) {
        return res.status(400).json({ error: 'Invalid role. Use: admin, member, viewer' })
      }

      // Find user by ID or email
      let targetUser
      if (userId) {
        const [found] = await dbPool.execute('SELECT id, name, email FROM users WHERE id = ?', [userId])
        targetUser = found[0]
      } else if (email) {
        const [found] = await dbPool.execute('SELECT id, name, email FROM users WHERE email = ?', [email.trim()])
        targetUser = found[0]
      }

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Check if already in tenant
      const [existing] = await dbPool.execute(
        'SELECT id FROM tenant_users WHERE tenant_id = ? AND user_id = ?',
        [tenantId, targetUser.id]
      )
      if (existing.length > 0) {
        return res.status(400).json({ error: 'User is already a member of this tenant' })
      }

      // Add to tenant
      await dbPool.execute(
        'INSERT INTO tenant_users (tenant_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)',
        [tenantId, targetUser.id, memberRole, decoded.id]
      )

      // Also update user's primary tenant_id
      await dbPool.execute('UPDATE users SET tenant_id = ? WHERE id = ?', [tenantId, targetUser.id])

      // Log activity
      await dbPool.execute(
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [decoded.id, 'added member', 'user', targetUser.id, JSON.stringify({ name: targetUser.name, email: targetUser.email, role: memberRole })]
      )

      return res.status(201).json({
        success: true,
        message: `${targetUser.name} added as ${memberRole}`,
        user: { id: targetUser.id, name: targetUser.name, email: targetUser.email, tenant_role: memberRole }
      })
    } catch (error) {
      console.error('[tenant/users] POST error:', error)
      return res.status(500).json({ error: 'Failed to add member' })
    }
  }

  // ── PUT: Update member role ──
  if (req.method === 'PUT') {
    try {
      const { membershipId, userId, role } = req.body

      if (!role || !['admin', 'member', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' })
      }

      // Can't downgrade owner
      const [targetCheck] = await dbPool.execute(
        'SELECT tu.role, tu.user_id FROM tenant_users tu WHERE tu.tenant_id = ? AND (tu.id = ? OR tu.user_id = ?)',
        [tenantId, membershipId || 0, userId || 0]
      )
      const target = targetCheck[0]
      if (!target) return res.status(404).json({ error: 'Member not found' })
      if (target.role === 'owner') return res.status(400).json({ error: 'Cannot change owner role' })
      if (target.user_id === decoded.id) return res.status(400).json({ error: 'Cannot change your own role' })

      await dbPool.execute(
        'UPDATE tenant_users SET role = ? WHERE tenant_id = ? AND user_id = ?',
        [role, tenantId, target.user_id]
      )

      return res.status(200).json({ success: true, message: 'Role updated' })
    } catch (error) {
      console.error('[tenant/users] PUT error:', error)
      return res.status(500).json({ error: 'Failed to update role' })
    }
  }

  // ── DELETE: Remove member from tenant ──
  if (req.method === 'DELETE') {
    try {
      const { userId, membershipId } = req.body
      const targetUserId = userId

      if (!targetUserId) return res.status(400).json({ error: 'userId required' })

      // Can't remove owner
      const [targetCheck] = await dbPool.execute(
        'SELECT role FROM tenant_users WHERE tenant_id = ? AND user_id = ?',
        [tenantId, targetUserId]
      )
      if (targetCheck[0]?.role === 'owner') {
        return res.status(400).json({ error: 'Cannot remove the owner' })
      }
      if (targetUserId === decoded.id) {
        return res.status(400).json({ error: 'Cannot remove yourself' })
      }

      await dbPool.execute(
        'DELETE FROM tenant_users WHERE tenant_id = ? AND user_id = ?',
        [tenantId, targetUserId]
      )

      // Log activity
      await dbPool.execute(
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [decoded.id, 'removed member', 'user', targetUserId, JSON.stringify({ userId: targetUserId })]
      )

      return res.status(200).json({ success: true, message: 'Member removed' })
    } catch (error) {
      console.error('[tenant/users] DELETE error:', error)
      return res.status(500).json({ error: 'Failed to remove member' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
