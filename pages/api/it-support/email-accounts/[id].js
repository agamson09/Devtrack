const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')
const { encrypt, decrypt } = require('@/lib/vault')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      const account = await db.queryOne(
        `SELECT e.*, u.name as user_name FROM it_email_accounts e LEFT JOIN users u ON e.user_id = u.id WHERE e.id = ?`, [id])
      if (!account) return res.status(404).json({ error: 'Not found' })
      if (account.password) account.password = decrypt(account.password)
      return res.status(200).json({ account })
    } catch (err) {
      console.error('Get email error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    const { email, user_id, provider, password, status, created_date, notes } = req.body
    try {
      const account = await db.queryOne('SELECT * FROM it_email_accounts WHERE id = ?', [id])
      if (!account) return res.status(404).json({ error: 'Not found' })

      // Only re-encrypt if a new password was actually provided
      // Skip masked placeholder value from the list endpoint
      const isMaskedPassword = password === '[encrypted]' || password === '••••••••'
      const hasNewPassword = password && !isMaskedPassword
      const encryptedPw = hasNewPassword ? encrypt(password) : account.password
      await db.query(
        'UPDATE it_email_accounts SET email=COALESCE(?,email), user_id=COALESCE(?,user_id), provider=COALESCE(?,provider), password=COALESCE(?,password), status=COALESCE(?,status), created_date=COALESCE(?,created_date), notes=COALESCE(?,notes) WHERE id=?',
        [email, user_id || null, provider, encryptedPw, status, created_date, notes, id])
      return res.status(200).json({ message: 'Updated' })
    } catch (err) {
      console.error('Update email error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete' })
    try {
      await db.remove('DELETE FROM it_email_accounts WHERE id = ?', [id])
      return res.status(200).json({ message: 'Deleted' })
    } catch (err) {
      console.error('Delete email error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
