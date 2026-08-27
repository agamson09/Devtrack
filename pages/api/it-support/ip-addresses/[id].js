const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate, tenantRemove } = db
const { getTenantFromRequest } = require('@/lib/tenant')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  const tenantId = await getTenantFromRequest(req)

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      const addr = await tenantQueryOne(tenantId,
        `SELECT ip.*, u.name as user_name FROM it_ip_addresses ip LEFT JOIN users u ON ip.user_id = u.id WHERE ip.id = ?`, [id])
      if (!addr) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json({ address: addr })
    } catch (err) {
      console.error('Get IP error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    const { ip_address, subnet, device_name, user_id, location, status, notes } = req.body
    try {
      await tenantQuery(tenantId,
        'UPDATE it_ip_addresses SET ip_address=COALESCE(?,ip_address), subnet=COALESCE(?,subnet), device_name=COALESCE(?,device_name), user_id=COALESCE(?,user_id), location=COALESCE(?,location), status=COALESCE(?,status), notes=COALESCE(?,notes) WHERE id=?',
        [ip_address, subnet, device_name, user_id || null, location, status, notes, id])
      return res.status(200).json({ message: 'Updated' })
    } catch (err) {
      console.error('Update IP error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete' })
    try {
      await tenantRemove(tenantId, 'DELETE FROM it_ip_addresses WHERE id = ?', [id])
      return res.status(200).json({ message: 'Deleted' })
    } catch (err) {
      console.error('Delete IP error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
