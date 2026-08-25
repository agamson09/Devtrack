import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const modules = await query('SELECT * FROM modules WHERE is_active = 1 ORDER BY sort_order ASC')
    return res.status(200).json({ modules })
  } catch (err) {
    console.error('Modules fetch error:', err)
    return res.status(500).json({ error: 'Failed to fetch modules' })
  }
}
