const { getAuthUser } = require('@/lib/auth')
const { searchProducts } = require('@/lib/ai')

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (user.role !== 'admin' && user.role !== 'it_support') return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'POST') {
    const { query } = req.body
    if (!query) return res.status(400).json({ error: 'Search query required' })

    try {
      const result = await searchProducts(query)
      return res.status(200).json(result)
    } catch (err) {
      console.error('AI search error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
