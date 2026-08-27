import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQuery, tenantQueryOne } = db
import { getTenantFromRequest } from '@/lib/tenant'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'GET') {
    try {
      const { page = 1, limit = 50, user_id, action, target_type, date_from, date_to } = req.query
      const offset = (parseInt(page) - 1) * parseInt(limit)

      let whereConditions = []
      let params = []

      if (tenantId) {
        whereConditions.push('al.tenant_id = ?')
        params.push(tenantId)
      }
      if (user_id) {
        whereConditions.push('al.user_id = ?')
        params.push(user_id)
      }
      if (action) {
        whereConditions.push('al.action LIKE ?')
        params.push(`%${action}%`)
      }
      if (target_type) {
        whereConditions.push('al.target_type = ?')
        params.push(target_type)
      }
      if (date_from) {
        whereConditions.push('al.created_at >= ?')
        params.push(date_from)
      }
      if (date_to) {
        whereConditions.push('al.created_at <= ?')
        params.push(date_to + ' 23:59:59')
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''

      const countResult = await tenantQueryOne(
        tenantId,
        `SELECT COUNT(*) as total FROM activity_logs al ${whereClause}`,
        params
      )

      const activities = await tenantQuery(
        tenantId,
        `SELECT al.*, u.name as user_name, u.avatar as user_avatar
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      )

      const users = await tenantQuery(tenantId, 'SELECT id, name FROM users ORDER BY name ASC')

      return res.status(200).json({
        activities,
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult?.total || 0,
          pages: Math.ceil((countResult?.total || 0) / parseInt(limit)),
        },
      })
    } catch (error) {
      console.error('Activity log error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
