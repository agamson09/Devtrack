import { getAuthUser, generateToken, COOKIE_NAME } from '@/lib/auth'
import { createTenant } from '@/lib/tenant'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { name } = req.body

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Workspace name must be at least 2 characters' })
  }

  try {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString(36)

    const tenantId = await createTenant(name.trim(), slug, user.id)

    // Update user's tenant_id + role admin in main DB
    const db = require('@/lib/db')
    await db.insert(
      'UPDATE users SET tenant_id = ?, role = ? WHERE id = ?',
      [tenantId, 'admin', user.id]
    )

    // Look up the workspace DB name for the JWT
    const wsDb = await db.queryOne('SELECT db_name FROM workspace_databases WHERE tenant_id = ?', [tenantId])

    // Generate new JWT with the new tenant
    const newToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'admin',
      tenant_id: tenantId,
      workspaceDbName: wsDb?.db_name || null,
    })

    // Set cookies
    res.setHeader('Set-Cookie', [
      `${COOKIE_NAME}=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
      `active_tenant=${tenantId}; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
    ])

    return res.status(201).json({
      success: true,
      tenant: { id: tenantId, name: name.trim(), slug },
      message: `Workspace "${name.trim()}" created with its own database`,
    })
  } catch (error) {
    console.error('[tenant/create] error:', error)
    return res.status(500).json({ error: 'Failed to create workspace' })
  }
}
