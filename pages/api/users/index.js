import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQuery, tenantQueryOne, tenantInsert } = db
import { getTenantFromRequest } from '@/lib/tenant'
import { requireCSRF } from '@/lib/csrf'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'GET') {
    try {
      let query = `
        SELECT u.id, u.name, u.email, u.role, u.avatar, u.avatar_style, u.avatar_seed, u.avatar_options, u.is_active,
          (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id AND (t.tenant_id = ? OR t.tenant_id IS NULL)) as task_count
        FROM users u
      `
      const params = [tenantId]

      // Tenant scoping: only show users in same tenant
      if (tenantId) {
        query += ` WHERE u.id IN (SELECT user_id FROM tenant_users WHERE tenant_id = ?)`
        params.push(tenantId)
      }

      query += ' ORDER BY u.name ASC'

      const users = await tenantQuery(tenantId, query, params)
      return res.status(200).json({ users })
    } catch (error) {
      console.error('List users error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    if (!(await requireCSRF(req, res))) return
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin only' })
    }

    const { name, email, password, role } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' })
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' })
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least 1 uppercase letter' })
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least 1 lowercase letter' })
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least 1 number' })
    }
    if (!role || !['admin', 'member', 'it_support'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    try {
      const existing = await tenantQueryOne(tenantId, 'SELECT id FROM users WHERE email = ?', [email.trim()])
      if (existing) {
        return res.status(400).json({ error: 'Email already exists' })
      }

      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash(password, 10)

      const avatarStyles = ['lorelei', 'bottts', 'pixel-art', 'avataaars', 'fun-emoji', 'identicon', 'personas']
      const defaultStyle = avatarStyles[Math.floor(Math.random() * avatarStyles.length)]
      const defaultSeed = name.trim().toLowerCase().replace(/\s+/g, '')

      const result = await tenantInsert(
        tenantId,
        'INSERT INTO users (name, email, password, role, avatar_style, avatar_seed, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())',
        [name.trim(), email.trim(), hashedPassword, role, defaultStyle, defaultSeed]
      )

      await tenantInsert(
        tenantId,
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [user.id, 'created user', 'user', result.insertId, JSON.stringify({ name: name.trim(), email: email.trim(), role }), tenantId]
      )

      const newUser = await tenantQueryOne(tenantId, 'SELECT id, name, email, role, avatar, avatar_style, avatar_seed, avatar_options, is_active FROM users WHERE id = ?', [result.insertId])
      return res.status(201).json({ user: newUser })
    } catch (error) {
      console.error('Create user error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
