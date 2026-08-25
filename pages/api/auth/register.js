import { queryOne, insert } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { createTenant, joinTenantByInvite } from '@/lib/tenant'
import { validateData } from '@/lib/middleware'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate input
  const { valid, data, errors } = validateData(req.body, 'register')
  if (!valid) {
    return res.status(400).json({ error: 'Validation failed', details: errors })
  }

  const { name, email, password, mode, workspaceName, inviteCode } = data

  try {
    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email])
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' })
    }

    const hashedPassword = await hashPassword(password)

    // Create user first (without tenant_id — will be set below)
    const result = await insert('users', {
      name,
      email,
      password: hashedPassword,
      role: 'member',
      created_at: new Date(),
    })

    const userId = result.insertId
    let tenantId = null

    if (mode === 'create') {
      // User wants to create a new workspace — create tenant + set as owner
      if (!workspaceName || workspaceName.trim().length < 2) {
        return res.status(400).json({ error: 'Workspace name must be at least 2 characters' })
      }

      const slug = workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now().toString(36)

      tenantId = await createTenant(workspaceName.trim(), slug, userId)

      // Update user with tenant_id + role admin
      await insert(
        'UPDATE users SET tenant_id = ?, role = ? WHERE id = ?',
        [tenantId, 'admin', userId]
      )

    } else if (mode === 'join' && inviteCode) {
      // User wants to join existing workspace via invite code
      const joinResult = await joinTenantByInvite(userId, inviteCode)
      if (!joinResult.success) {
        return res.status(400).json({ error: joinResult.error })
      }
      tenantId = joinResult.tenantId

      // Update user with tenant_id
      await insert(
        'UPDATE users SET tenant_id = ? WHERE id = ?',
        [tenantId, userId]
      )

    } else {
      // Default: create a personal workspace
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36)
      tenantId = await createTenant(name + "'s Workspace", slug, userId)
      await insert(
        'UPDATE users SET tenant_id = ?, role = ? WHERE id = ?',
        [tenantId, 'admin', userId]
      )
    }

    return res.status(201).json({
      message: 'Account created successfully',
      userId,
      tenantId,
      mode: mode || 'auto',
    })
  } catch (error) {
    console.error('Register error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
