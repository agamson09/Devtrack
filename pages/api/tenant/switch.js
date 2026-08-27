import db from '@/lib/db'
import { getAuthUser, generateToken, COOKIE_NAME } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { tenantId } = req.body
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' })
  }

  try {
    // Verify user belongs to this tenant
    const membership = await db.queryOne(
      'SELECT role FROM tenant_users WHERE tenant_id = ? AND user_id = ?',
      [tenantId, user.id]
    )

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this workspace' })
    }

    // Get tenant info + workspace DB name
    const tenant = await db.queryOne(
      `SELECT t.id, t.name, t.slug, t.status, wd.db_name as workspace_db_name
       FROM tenants t
       LEFT JOIN workspace_databases wd ON wd.tenant_id = t.id
       WHERE t.id = ? AND t.status = ?`,
      [tenantId, 'active']
    )

    if (!tenant) {
      return res.status(404).json({ error: 'Workspace not found' })
    }

    // Update user's tenant_id in DB
    await db.query(
      'UPDATE users SET tenant_id = ? WHERE id = ?',
      [tenantId, user.id]
    )

    // Generate new token with updated tenant_id and workspaceDbName
    const newToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership.role === 'owner' ? 'admin' : membership.role,
      tenant_id: tenantId,
      workspaceDbName: tenant?.workspace_db_name || null,
    })

    // Set new cookies
    res.setHeader('Set-Cookie', [
      `${COOKIE_NAME}=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
      `active_tenant=${tenantId}; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
    ])

    // Get new tenant settings
    const settings = await db.query(
      'SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?',
      [tenantId]
    )

    const settingsObj = {}
    for (const row of settings) {
      settingsObj[row.setting_key] = row.setting_value
    }

    return res.status(200).json({
      success: true,
      tenant,
      settings: settingsObj,
      userRole: membership.role,
    })
  } catch (error) {
    console.error('[tenant/switch] error:', error)
    return res.status(500).json({ error: 'Failed to switch workspace' })
  }
}
