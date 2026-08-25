const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    try {
      let queries, params
      if (user.role === 'admin' || user.role === 'it_support') {
        queries = `SELECT p.*, u1.name as requested_by_name, u2.name as reviewed_by_name 
          FROM it_purchase_requests p 
          LEFT JOIN users u1 ON p.requested_by = u1.id 
          LEFT JOIN users u2 ON p.reviewed_by = u2.id 
          ORDER BY p.created_at DESC`
        params = []
      } else {
        queries = `SELECT p.*, u1.name as requested_by_name, u2.name as reviewed_by_name 
          FROM it_purchase_requests p 
          LEFT JOIN users u1 ON p.requested_by = u1.id 
          LEFT JOIN users u2 ON p.reviewed_by = u2.id 
          WHERE p.requested_by = ? ORDER BY p.created_at DESC`
        params = [user.id]
      }
      const purchases = await db.query(queries, params)
      return res.status(200).json({ purchases })
    } catch (err) {
      console.error('List purchases error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    const { item_name, description, quantity, estimated_price, urgency, reason } = req.body
    if (!item_name) return res.status(400).json({ error: 'Item name is required' })

    try {
      const result = await db.insert('it_purchase_requests', {
        requested_by: user.id,
        item_name,
        description: description || null,
        quantity: quantity || 1,
        estimated_price: estimated_price || null,
        urgency: urgency || 'medium',
        reason: reason || null,
      })
      return res.status(201).json({ id: result.insertId, message: 'Purchase request created' })
    } catch (err) {
      console.error('Create purchase error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
