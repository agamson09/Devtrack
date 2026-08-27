const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate, tenantRemove } = db
const { getTenantFromRequest } = require('@/lib/tenant')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'GET') {
    try {
      const [purchaseStats] = await tenantQuery(tenantId,
        "SELECT COUNT(*) as total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved FROM it_purchase_requests")
      const [invStats] = await tenantQuery(tenantId,
        "SELECT COUNT(*) as total, SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) as available, SUM(CASE WHEN status='in_use' THEN 1 ELSE 0 END) as in_use, SUM(CASE WHEN status='repair' THEN 1 ELSE 0 END) as repair FROM it_inventory")
      const [pwStats] = await tenantQuery(tenantId, "SELECT COUNT(*) as total FROM it_password_vault")
      const [ipStats] = await tenantQuery(tenantId,
        "SELECT COUNT(*) as total, SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) as available, SUM(CASE WHEN status='used' THEN 1 ELSE 0 END) as used FROM it_ip_addresses")
      const [emailStats] = await tenantQuery(tenantId,
        "SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active FROM it_email_accounts")
      const recentPurchases = await tenantQuery(tenantId,
        `SELECT p.*, u.name as requested_by_name FROM it_purchase_requests p 
         LEFT JOIN users u ON p.requested_by = u.id ORDER BY p.created_at DESC LIMIT 5`)

      return res.status(200).json({
        purchases: { total: purchaseStats.total, pending: purchaseStats.pending, approved: purchaseStats.approved },
        inventory: { total: invStats.total, available: invStats.available, in_use: invStats.in_use, repair: invStats.repair },
        passwords: { total: pwStats.total },
        ips: { total: ipStats.total, available: ipStats.available, used: ipStats.used },
        emails: { total: emailStats.total, active: emailStats.active },
        recentPurchases,
      })
    } catch (err) {
      console.error('Dashboard stats error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET'])
  return res.status(405).json({ error: 'Method not allowed' })
}
