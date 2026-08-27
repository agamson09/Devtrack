import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQuery, tenantInsert, tenantQueryOne } = db
import { getTenantFromRequest } from '@/lib/tenant'
import { notifyTaskCreated } from '@/lib/notifications'
import { validateData, validatePagination } from '@/lib/middleware'
import { requireCSRF } from '@/lib/csrf'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'GET') {
    try {
      const { project_id, status, assigned_to, page, limit } = req.query
      let query = `
        SELECT
          t.*,
          u.name as assignee_name,
          u.avatar as assignee_avatar,
          u.avatar_style as assignee_avatar_style,
          u.avatar_seed as assignee_avatar_seed,
          u.avatar_options as assignee_avatar_options,
          p.name as project_name
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE 1=1
      `
      const params = []

      // Tenant scoping
      if (tenantId) {
        query += ' AND t.tenant_id = ?'
        params.push(tenantId)
      }

      if (project_id) {
        query += ' AND t.project_id = ?'
        params.push(project_id)
      }
      if (status) {
        query += ' AND t.status = ?'
        params.push(status)
      }
      if (assigned_to) {
        query += ' AND t.assigned_to = ?'
        params.push(assigned_to)
      }

      query += ' ORDER BY t.sort_order ASC, t.created_at DESC'

      // Opt-in pagination: without page/limit the full list is returned
      // (Kanban needs every task of a project at once).
      const pageNum = parseInt(page)
      const limitNum = parseInt(limit)
      const paginated = Number.isFinite(pageNum) && pageNum > 0 && Number.isFinite(limitNum) && limitNum > 0
      let total = null
      if (paginated) {
        const countRow = await tenantQueryOne(tenantId, query.replace(/^[\s\S]*?FROM tasks/, 'SELECT COUNT(*) AS total FROM tasks'), params)
        total = countRow?.total ?? 0
        query += ' LIMIT ? OFFSET ?'
        params.push(limitNum, (pageNum - 1) * limitNum)
      }

      const tasks = await tenantQuery(tenantId, query, params)

      // Batch-fetch labels for ALL tasks in one query (fixes N+1)
      let labelsByTask = new Map()
      if (tasks.length > 0) {
        const ids = tasks.map(t => t.id)
        const placeholders = ids.map(() => '?').join(',')
        const labelRows = await tenantQuery(
          tenantId,
          `SELECT tl.task_id, l.id, l.name, l.color
           FROM task_labels tl
           INNER JOIN labels l ON tl.label_id = l.id
           WHERE tl.task_id IN (${placeholders})`,
          ids
        )
        for (const row of labelRows) {
          if (!labelsByTask.has(row.task_id)) labelsByTask.set(row.task_id, [])
          labelsByTask.get(row.task_id).push({ id: row.id, name: row.name, color: row.color })
        }
      }

      const tasksWithLabels = tasks.map(task => ({ ...task, labels: labelsByTask.get(task.id) || [] }))

      return res.status(200).json({ tasks: tasksWithLabels, ...(paginated ? { page: pageNum, limit: limitNum, total } : {}) })
    } catch (error) {
      console.error('List tasks error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    if (!(await requireCSRF(req, res))) return
    const { valid, data, errors } = validateData(req.body, 'createTask')
    if (!valid) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    const { project_id, title, description, status, priority, assigned_to, module, deadline, start_date, estimated_hours } = data

    try {
      const project = await tenantQueryOne(tenantId, 'SELECT * FROM projects WHERE id = ?', [project_id])
      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }

      // New tasks land on top of their column
      const [{ maxOrder }] = await tenantQuery(
        tenantId,
        'SELECT COALESCE(MAX(sort_order), -1) + 10 AS maxOrder FROM tasks WHERE project_id = ? AND status = ?',
        [project_id, status || 'todo']
      )

      const result = await tenantInsert(
        tenantId,
        `INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, module, deadline, start_date, estimated_hours, sort_order, created_by, tenant_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          project_id,
          title.trim(),
          description || null,
          status || 'todo',
          priority || 'medium',
          assigned_to || null,
          module || null,
          deadline || null,
          start_date || null,
          estimated_hours || null,
          maxOrder || 0,
          user.id,
          tenantId,
        ]
      )

      const taskId = result.insertId

      await tenantInsert(
        tenantId,
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [user.id, 'created task', 'task', taskId, JSON.stringify({ title: title.trim() }), tenantId]
      )

      const task = await tenantQueryOne(
        tenantId,
        `SELECT t.*, u.name as assignee_name 
        FROM tasks t 
        LEFT JOIN users u ON t.assigned_to = u.id 
        WHERE t.id = ?`,
        [taskId]
      )

      try {
        await notifyTaskCreated(task, project, user.id)
      } catch (e) { console.error('Task notification error:', e) }

      return res.status(201).json({ task })
    } catch (error) {
      console.error('Create task error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
