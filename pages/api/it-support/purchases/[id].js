const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate, tenantRemove } = db
const { getTenantFromRequest } = require('@/lib/tenant')
const { notifyPurchaseApproved, notifyPurchaseRejected } = require('@/lib/notifications')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  const tenantId = await getTenantFromRequest(req)

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      const purchase = await tenantQueryOne(tenantId,
        `SELECT p.*, u1.name as requested_by_name, u2.name as reviewed_by_name 
         FROM it_purchase_requests p 
         LEFT JOIN users u1 ON p.requested_by = u1.id 
         LEFT JOIN users u2 ON p.reviewed_by = u2.id 
         WHERE p.id = ?`, [id]
      )
      if (!purchase) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json({ purchase })
    } catch (err) {
      console.error('Get purchase error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Only admins can approve/reject' })
    const { status, review_note, item_name, description, quantity, estimated_price, urgency, reason } = req.body

    try {
      const purchase = await tenantQueryOne(tenantId, 'SELECT * FROM it_purchase_requests WHERE id = ?', [id])
      if (!purchase) return res.status(404).json({ error: 'Not found' })

      const updates = {}
      if (status) {
        updates.status = status
        if (status === 'approved' || status === 'rejected') {
          updates.reviewed_by = user.id
          updates.reviewed_at = new Date()
          if (review_note) updates.review_note = review_note
        }
      }
      if (item_name !== undefined) updates.item_name = item_name
      if (description !== undefined) updates.description = description
      if (quantity !== undefined) updates.quantity = quantity
      if (estimated_price !== undefined) updates.estimated_price = estimated_price
      if (urgency !== undefined) updates.urgency = urgency
      if (reason !== undefined) updates.reason = reason
      if (review_note !== undefined && !status) updates.review_note = review_note

      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updates provided' })

      await tenantUpdate(tenantId, 'UPDATE it_purchase_requests SET ? WHERE id = ?', [updates, id])

      try {
        if (status === 'approved') {
          await notifyPurchaseApproved({ ...purchase, id: parseInt(id) }, user.name)
        } else if (status === 'rejected') {
          await notifyPurchaseRejected({ ...purchase, id: parseInt(id) }, user.name, review_note)
        }
      } catch (e) { console.error('Purchase notification error:', e) }

      return res.status(200).json({ message: 'Updated successfully' })
    } catch (err) {
      console.error('Update purchase error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete' })
    try {
      await tenantRemove(tenantId, 'DELETE FROM it_purchase_requests WHERE id = ?', [id])
      return res.status(200).json({ message: 'Deleted' })
    } catch (err) {
      console.error('Delete purchase error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
