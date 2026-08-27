import { queryOne, query } from '@/lib/db'
import { generateToken, COOKIE_NAME } from '@/lib/auth'
import { createCSRFToken, logSecurityEvent } from '@/lib/session'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { getAuthUser } = require('@/lib/auth')
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { workspaceId } = req.body
  if (!workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' })
  }

  try {
    // Verify user belongs to this workspace
    const membership = await queryOne(
      `SELECT tu.role, t.name, t.slug, t.status, wd.db_name as workspace_db_name
       FROM tenant_users tu
       JOIN tenants t ON tu.tenant_id = t.id
       LEFT JOIN workspace_databases wd ON wd.tenant_id = tu.tenant_id
       WHERE tu.tenant_id = ? AND tu.user_id = ?`,
      [workspaceId, user.id]
    )

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this workspace' })
    }

    if (membership.status !== 'active') {
      return res.status(403).json({ error: 'This workspace is no longer active' })
    }

    // Update user's tenant_id in master DB
    await query('UPDATE users SET tenant_id = ?, role = ? WHERE id = ?', [
      workspaceId,
      membership.role === 'owner' ? 'admin' : (membership.role || 'member'),
      user.id
    ])

    // Issue full JWT with workspace context
    const jwtToken = generateToken({
      id: user.id,
      tenant_id: workspaceId,
      workspaceDbName: membership.workspace_db_name || null,
      name: user.name,
      email: user.email,
      role: membership.role === 'owner' ? 'admin' : (membership.role || user.role),
    })

    // Get tenant settings for the response
    const settings = await query(
      'SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?',
      [workspaceId]
    )
    const settingsObj = {}
    for (const row of settings) {
      settingsObj[row.setting_key] = row.setting_value
    }

    res.setHeader('Set-Cookie', [
      `${COOKIE_NAME}=${jwtToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      `active_tenant=${workspaceId}; Path=/; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
    ])

    const csrfToken = await createCSRFToken(user.id)

    return res.status(200).json({
      success: true,
      token: jwtToken,
      csrfToken,
      tenant: { id: workspaceId, name: membership.name, slug: membership.slug },
      settings: settingsObj,
      userRole: membership.role,
    })
  } catch (error) {
    console.error('[select-workspace] error:', error)
    return res.status(500).json({ error: 'Failed to select workspace' })
  }
}
