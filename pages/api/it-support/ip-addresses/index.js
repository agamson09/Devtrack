const { getAuthUser } = require('@/lib/auth')
const db = require('@/lib/db')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    try {
      const addresses = await db.query(
        `SELECT ip.*, u.name as user_name FROM it_ip_addresses ip 
         LEFT JOIN users u ON ip.user_id = u.id ORDER BY ip.ip_address`)
      return res.status(200).json({ addresses })
    } catch (err) {
      console.error('List IPs error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    const { ip_address, subnet, device_name, user_id, location, status, notes } = req.body
    if (!ip_address) return res.status(400).json({ error: 'IP address required' })

    try {
      const result = await db.insert('it_ip_addresses', {
        ip_address, subnet, device_name, user_id: user_id || null,
        location, status: status || 'available', notes,
      })
      return res.status(201).json({ id: result.insertId, message: 'Created' })
    } catch (err) {
      console.error('Create IP error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
