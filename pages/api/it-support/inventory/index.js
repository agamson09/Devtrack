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
      const items = await tenantQuery(tenantId,
        `SELECT i.*, u.name as assigned_to_name, 
         (SELECT ia.assigned_at FROM it_inventory_assign ia WHERE ia.inventory_id = i.id AND ia.returned_at IS NULL ORDER BY ia.assigned_at DESC LIMIT 1) as current_assigned_at
         FROM it_inventory i 
         LEFT JOIN it_inventory_assign ia ON i.id = ia.inventory_id AND ia.returned_at IS NULL
         LEFT JOIN users u ON ia.user_id = u.id 
         ORDER BY i.created_at DESC`
      )
      return res.status(200).json({ items })
    } catch (err) {
      console.error('List inventory error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    const { item_name, category, brand, model, serial_number, purchase_date, warranty_until, status, location, notes } = req.body
    if (!item_name) return res.status(400).json({ error: 'Item name is required' })

    try {
      const result = await tenantInsert(tenantId, 'it_inventory', {
        item_name, category, brand, model, serial_number,
        purchase_date: purchase_date || null, warranty_until: warranty_until || null,
        status: status || 'available', location, notes,
      })
      return res.status(201).json({ id: result.insertId, message: 'Inventory item created' })
    } catch (err) {
      console.error('Create inventory error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
