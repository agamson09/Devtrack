const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')
const { encrypt } = require('@/lib/vault')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    try {
      const accounts = await db.query(
        `SELECT e.*, u.name as user_name FROM it_email_accounts e 
         LEFT JOIN users u ON e.user_id = u.id ORDER BY e.email`)
      accounts.forEach(a => { if (a.password) a.password = '[encrypted]' })
      return res.status(200).json({ accounts })
    } catch (err) {
      console.error('List emails error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    const { email, user_id, provider, password, status, created_date, notes } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })

    try {
      const encryptedPw = password ? encrypt(password) : null
      const result = await db.insert('it_email_accounts', {
        email, user_id: user_id || null, provider, password: encryptedPw,
        status: status || 'active', created_date: created_date || null, notes,
      })
      return res.status(201).json({ id: result.insertId, message: 'Created' })
    } catch (err) {
      console.error('Create email error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
