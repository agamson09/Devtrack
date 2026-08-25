import db from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  try {
    // Get all tenants the user belongs to
    const memberships = await db.query(
      `SELECT tu.tenant_id, tu.role, tu.joined_at,
              t.name, t.slug, t.status
       FROM tenant_users tu
       JOIN tenants t ON tu.tenant_id = t.id
       WHERE tu.user_id = ? AND t.status = 'active'
       ORDER BY tu.joined_at ASC`,
      [user.id]
    )

    // Get current active tenant (from cookie or default to first)
    const activeTenantId = user.tenant_id || (memberships.length > 0 ? memberships[0].tenant_id : null)

    return res.status(200).json({
      tenants: memberships.map(m => ({
        id: m.tenant_id,
        name: m.name,
        slug: m.slug,
        role: m.role,
        joinedAt: m.joined_at,
        isActive: m.tenant_id === activeTenantId,
      })),
      activeTenantId,
    })
  } catch (error) {
    console.error('[tenant/my-tenants] error:', error)
    return res.status(500).json({ error: 'Failed to load tenants' })
  }
}
