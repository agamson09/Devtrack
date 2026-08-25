import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
import { getTenantFromRequest, scopeQuery, getTenantId } from '@/lib/tenant'
import { notifyProjectCreated } from '@/lib/notifications'
import { requireCSRF } from '@/lib/csrf'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'GET') {
    try {
      const { status } = req.query
      let query = `
        SELECT 
          p.*,
          COUNT(DISTINCT t.id) as task_count,
          COUNT(DISTINCT t.assigned_to) as member_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
      `
      const params = []
      const conditions = []

      // Tenant scoping
      if (tenantId) {
        conditions.push('p.tenant_id = ?')
        params.push(tenantId)
      }

      if (user.role !== 'admin') {
        conditions.push(`(p.id IN (SELECT project_id FROM tasks WHERE assigned_to = ?) OR p.owner_id = ?)`)
        params.push(user.id, user.id)
      }

      if (status && status !== 'all') {
        conditions.push('p.status = ?')
        params.push(status)
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ')
      }

      query += ' GROUP BY p.id ORDER BY p.created_at DESC'

      const projects = await db.query(query, params)
      return res.status(200).json({ projects })
    } catch (error) {
      console.error('List projects error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    if (!(await requireCSRF(req, res))) return
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin only' })
    }

    const { name, description, git_repo } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' })
    }

    try {
      const result = await db.insert(
        'INSERT INTO projects (name, description, git_repo_url, status, owner_id, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [name.trim(), description || null, git_repo || null, 'active', user.id, tenantId]
      )

      const projectId = result.insertId

      await db.insert(
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [user.id, 'created project', 'project', projectId, JSON.stringify({ name: name.trim() }), tenantId]
      )

      const project = await db.queryOne('SELECT * FROM projects WHERE id = ?', [projectId])
      try {
        await notifyProjectCreated(project, user.id)
      } catch (e) { console.error('Project notification error:', e) }
      return res.status(201).json({ project })
    } catch (error) {
      console.error('Create project error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
