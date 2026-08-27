const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate, tenantRemove } = db
const { getTenantFromRequest } = require('@/lib/tenant')
const { encrypt, decrypt } = require('@/lib/vault')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  const tenantId = await getTenantFromRequest(req)

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      const entry = await tenantQueryOne(tenantId,
        'SELECT p.*, u.name as created_by_name FROM it_password_vault p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = ?', [id])
      if (!entry) return res.status(404).json({ error: 'Not found' })
      if (entry.password) entry.password = decrypt(entry.password)
      return res.status(200).json({ entry })
    } catch (err) {
      console.error('Get password error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    const { service_name, category, username, password, url, notes } = req.body
    try {
      const entry = await tenantQueryOne(tenantId, 'SELECT * FROM it_password_vault WHERE id = ?', [id])
      if (!entry) return res.status(404).json({ error: 'Not found' })

      // Only re-encrypt if a new password was actually provided
      // Skip masked placeholder value from the list endpoint
      const isMaskedPassword = password === '[encrypted]' || password === '••••••••'
      const hasNewPassword = password && !isMaskedPassword
      const encryptedPw = hasNewPassword ? encrypt(password) : entry.password
      await tenantQuery(tenantId,
        'UPDATE it_password_vault SET service_name=COALESCE(?,service_name), category=COALESCE(?,category), username=COALESCE(?,username), password=COALESCE(?,password), url=COALESCE(?,url), notes=COALESCE(?,notes) WHERE id=?',
        [service_name, category, username, encryptedPw, url, notes, id])
      return res.status(200).json({ message: 'Updated' })
    } catch (err) {
      console.error('Update password error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete' })
    try {
      await tenantRemove(tenantId, 'DELETE FROM it_password_vault WHERE id = ?', [id])
      return res.status(200).json({ message: 'Deleted' })
    } catch (err) {
      console.error('Delete password error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
