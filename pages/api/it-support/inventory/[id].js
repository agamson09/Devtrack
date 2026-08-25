const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      const item = await db.queryOne('SELECT * FROM it_inventory WHERE id = ?', [id])
      if (!item) return res.status(404).json({ error: 'Not found' })
      const history = await db.query(
        `SELECT ia.*, u.name as user_name, u2.name as assigned_by_name 
         FROM it_inventory_assign ia 
         LEFT JOIN users u ON ia.user_id = u.id 
         LEFT JOIN users u2 ON ia.assigned_by = u2.id 
         WHERE ia.inventory_id = ? ORDER BY ia.assigned_at DESC`, [id]
      )
      return res.status(200).json({ item, history })
    } catch (err) {
      console.error('Get inventory error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })
    const { item_name, category, brand, model, serial_number, purchase_date, warranty_until, status, location, notes } = req.body

    try {
      const item = await db.queryOne('SELECT * FROM it_inventory WHERE id = ?', [id])
      if (!item) return res.status(404).json({ error: 'Not found' })

      await db.update('UPDATE it_inventory SET item_name=COALESCE(?,item_name), category=COALESCE(?,category), brand=COALESCE(?,brand), model=COALESCE(?,model), serial_number=COALESCE(?,serial_number), purchase_date=COALESCE(?,purchase_date), warranty_until=COALESCE(?,warranty_until), status=COALESCE(?,status), location=COALESCE(?,location), notes=COALESCE(?,notes) WHERE id=?',
        [item_name, category, brand, model, serial_number, purchase_date, warranty_until, status, location, notes, id])
      return res.status(200).json({ message: 'Updated' })
    } catch (err) {
      console.error('Update inventory error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete' })
    try {
      await db.remove('DELETE FROM it_inventory_assign WHERE inventory_id = ?', [id])
      await db.remove('DELETE FROM it_inventory WHERE id = ?', [id])
      return res.status(200).json({ message: 'Deleted' })
    } catch (err) {
      console.error('Delete inventory error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
