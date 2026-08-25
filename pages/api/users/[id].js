import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
import { notifyRoleChanged } from '@/lib/notifications'
import { requireCSRF } from '@/lib/csrf'

export default async function handler(req, res) {
  const authUser = await getAuthUser(req)
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const currentUser = await db.queryOne('SELECT role FROM users WHERE id = ?', [authUser.id])
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can manage users' })
  }

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      const user = await db.queryOne(
        'SELECT id, name, email, role, avatar, avatar_style, avatar_seed, avatar_options, is_active FROM users WHERE id = ?',
        [id]
      )
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }
      return res.status(200).json({ user })
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    if (!(await requireCSRF(req, res))) return;
    const { role, name, email, is_active } = req.body

    if (role && !['admin', 'member', 'it_support'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    if (parseInt(id) === authUser.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin role' })
    }

    const user = await db.queryOne('SELECT id, name, email FROM users WHERE id = ?', [id])
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (email && email !== user.email) {
      const existing = await db.queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, id])
      if (existing) {
        return res.status(400).json({ error: 'Email already exists' })
      }
    }

    const updates = []
    const params = []

    if (role) { updates.push('role = ?'); params.push(role) }
    if (name) { updates.push('name = ?'); params.push(name.trim()) }
    if (email) { updates.push('email = ?'); params.push(email.trim()) }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0) }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    params.push(id)
    await db.update(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)

    const changes = []
    if (role && role !== user.role) changes.push(`role: ${user.role} → ${role}`)
    if (name && name !== user.name) changes.push(`name: ${user.name} → ${name}`)
    if (email && email !== user.email) changes.push(`email: ${user.email} → ${email}`)
    if (is_active !== undefined) changes.push(`active: ${is_active ? 'yes' : 'no'}`)

    if (changes.length > 0) {
      await db.insert(
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [authUser.id, 'updated user', 'user', id, JSON.stringify({ changes })]
      )
    }

    try {
      if (role && role !== user.role) {
        await notifyRoleChanged(parseInt(id), user.role, role, authUser.id)
      }
    } catch (e) { console.error('Role change notification error:', e) }

    const updated = await db.queryOne('SELECT id, name, email, role, avatar, avatar_style, avatar_seed, avatar_options, is_active FROM users WHERE id = ?', [id])
    return res.status(200).json({ user: updated })
  }

  if (req.method === 'DELETE') {
    if (!(await requireCSRF(req, res))) return;
    if (parseInt(id) === authUser.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' })
    }

    const user = await db.queryOne('SELECT id FROM users WHERE id = ?', [id])
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await db.update('UPDATE users SET is_active = 0 WHERE id = ?', [id])

    await db.insert(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [authUser.id, 'deactivated user', 'user', id, JSON.stringify({})]
    )

    return res.status(200).json({ message: 'User deactivated successfully' })
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
