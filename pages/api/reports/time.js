import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate, tenantRemove } = db
import { getTenantFromRequest } from '@/lib/tenant'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantFromRequest(req)

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { start_date, end_date, project_id, user_id } = req.query

    const sd = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const ed = end_date || new Date().toISOString().split('T')[0]

    let taskQuery = `
      SELECT t.id, t.title, t.status, t.priority, t.deadline, t.estimated_hours, t.actual_hours,
             t.module, t.project_id, t.assigned_to,
             p.name as project_name,
             u.name as assignee_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.actual_hours IS NOT NULL AND t.actual_hours > 0
    `
    const taskParams = []
    if (project_id) { taskQuery += ' AND t.project_id = ?'; taskParams.push(project_id) }
    if (user_id) { taskQuery += ' AND t.assigned_to = ?'; taskParams.push(user_id) }
    taskQuery += ' ORDER BY t.actual_hours DESC'

    const tasks = await tenantQuery(tenantId, taskQuery, taskParams)

    const hoursByUser = await tenantQuery(tenantId,
      `SELECT u.id, u.name, SUM(t.actual_hours) as total_hours, COUNT(t.id) as task_count
       FROM tasks t
       INNER JOIN users u ON t.assigned_to = u.id
       WHERE t.actual_hours IS NOT NULL AND t.actual_hours > 0
       ${user_id ? 'AND t.assigned_to = ?' : ''}
       GROUP BY u.id, u.name
       ORDER BY total_hours DESC`,
      user_id ? [user_id] : []
    )

    const hoursByProject = await tenantQuery(tenantId,
      `SELECT p.id, p.name, SUM(t.actual_hours) as total_hours, COUNT(t.id) as task_count
       FROM tasks t
       INNER JOIN projects p ON t.project_id = p.id
       WHERE t.actual_hours IS NOT NULL AND t.actual_hours > 0
       ${project_id ? 'AND t.project_id = ?' : ''}
       GROUP BY p.id, p.name
       ORDER BY total_hours DESC`,
      project_id ? [project_id] : []
    )

    const hoursByPriority = await tenantQuery(tenantId,
      `SELECT priority, SUM(actual_hours) as total_hours, COUNT(*) as task_count
       FROM tasks
       WHERE actual_hours IS NOT NULL AND actual_hours > 0
       GROUP BY priority`
    )

    const hoursByModule = await tenantQuery(tenantId,
      `SELECT COALESCE(module, 'Unassigned') as module_name, SUM(actual_hours) as total_hours, COUNT(*) as task_count
       FROM tasks
       WHERE actual_hours IS NOT NULL AND actual_hours > 0
       GROUP BY module
       ORDER BY total_hours DESC`
    )

    const totalHours = tasks.reduce((sum, t) => sum + (parseFloat(t.actual_hours) || 0), 0)
    const totalEstimated = tasks.reduce((sum, t) => sum + (parseFloat(t.estimated_hours) || 0), 0)

    return res.status(200).json({
      tasks,
      summary: {
        total_hours: totalHours,
        total_estimated: totalEstimated,
        task_count: tasks.length,
        efficiency: totalEstimated > 0 ? ((totalEstimated / totalHours) * 100).toFixed(1) : null,
      },
      byUser: hoursByUser,
      byProject: hoursByProject,
      byPriority: hoursByPriority,
      byModule: hoursByModule,
    })
  } catch (error) {
    console.error('Reports error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
