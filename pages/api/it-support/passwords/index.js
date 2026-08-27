const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate, tenantRemove } = db
const { getTenantFromRequest } = require('@/lib/tenant')
const { encrypt } = require('@/lib/vault')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'GET') {
    try {
      const entries = await tenantQuery(tenantId,
        'SELECT p.*, u.name as created_by_name FROM it_password_vault p LEFT JOIN users u ON p.created_by = u.id ORDER BY p.service_name')
      entries.forEach(e => { if (e.password) e.password = '[encrypted]' })
      return res.status(200).json({ entries })
    } catch (err) {
      console.error('List passwords error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    const { service_name, category, username, password, url, notes } = req.body
    if (!service_name) return res.status(400).json({ error: 'Service name required' })

    try {
      const encryptedPw = password ? encrypt(password) : null
      const result = await tenantInsert(tenantId, 'it_password_vault', {
        service_name, category, username, password: encryptedPw, url, notes, created_by: user.id,
      })
      return res.status(201).json({ id: result.insertId, message: 'Created' })
    } catch (err) {
      console.error('Create password error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
