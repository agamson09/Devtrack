const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate, tenantRemove } = db
const { getTenantFromRequest } = require('@/lib/tenant')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'POST') {
    const { action, inventory_id, user_id, notes } = req.body

    if (action === 'unassign') {
      if (!inventory_id) return res.status(400).json({ error: 'inventory_id required' })
      try {
        await tenantQuery(tenantId,
          'UPDATE it_inventory_assign SET returned_at = NOW() WHERE inventory_id = ? AND returned_at IS NULL', [inventory_id])
        await tenantQuery(tenantId, "UPDATE it_inventory SET status = 'available' WHERE id = ?", [inventory_id])
        return res.status(200).json({ message: 'Item unassigned' })
      } catch (err) {
        console.error('Unassign error:', err)
        return res.status(500).json({ error: 'Internal server error' })
      }
    }

    if (!inventory_id || !user_id) return res.status(400).json({ error: 'inventory_id and user_id required' })
    try {
      await tenantQuery(tenantId,
        'UPDATE it_inventory_assign SET returned_at = NOW() WHERE inventory_id = ? AND returned_at IS NULL', [inventory_id])
      await tenantInsert(tenantId, 'it_inventory_assign', {
        inventory_id, user_id, assigned_by: user.id, notes: notes || null,
      })
      await tenantQuery(tenantId, "UPDATE it_inventory SET status = 'in_use' WHERE id = ?", [inventory_id])
      return res.status(201).json({ message: 'Item assigned' })
    } catch (err) {
      console.error('Assign error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
