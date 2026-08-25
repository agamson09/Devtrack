import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { limit = 20, offset = 0, module } = req.query
    let countSql = 'SELECT COUNT(*) as total FROM deploy_logs dl'
    let sql = `SELECT dl.*, u.name as deployed_by_name 
               FROM deploy_logs dl 
               LEFT JOIN users u ON dl.deployed_by = u.id`
    const params = []
    const countParams = []

    if (module && module !== 'all') {
      sql += ' WHERE dl.module = ?'
      countSql += ' WHERE dl.module = ?'
      params.push(module)
      countParams.push(module)
    }

    sql += ' ORDER BY dl.created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const history = await query(sql, params)
    const countResult = await query(countSql, countParams)

    const parsed = history.map(h => {
      let files = []
      try { files = JSON.parse(h.files_json || '[]') } catch {}
      return { ...h, files }
    })

    return res.status(200).json({ history: parsed, total: countResult[0]?.total || 0 })
  } catch (err) {
    console.error('Deploy history error:', err)
    return res.status(500).json({ error: 'Failed to fetch history' })
  }
}
