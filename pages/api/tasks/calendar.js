import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { start, end, project_id, assigned_to } = req.query

    let query = `
      SELECT t.id, t.title, t.status, t.priority, t.deadline, t.start_date,
             t.estimated_hours, t.actual_hours, t.module,
             p.name as project_name, p.id as project_id,
             u.name as assignee_name, u.id as assignee_id
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE 1=1
    `
    const params = []

    if (start) {
      query += ' AND (t.deadline >= ? OR t.start_date >= ?)'
      params.push(start, start)
    }
    if (end) {
      query += ' AND (t.deadline <= ? OR t.start_date <= ?)'
      params.push(end, end)
    }
    if (project_id) {
      query += ' AND t.project_id = ?'
      params.push(project_id)
    }
    if (assigned_to) {
      query += ' AND t.assigned_to = ?'
      params.push(assigned_to)
    }

    query += ' ORDER BY COALESCE(t.start_date, t.deadline) ASC'

    const tasks = await db.query(query, params)

    const tasksWithLabels = await Promise.all(tasks.map(async (task) => {
      const labels = await db.query(
        `SELECT l.id, l.name, l.color FROM labels l
         INNER JOIN task_labels tl ON l.id = tl.label_id
         WHERE tl.task_id = ?`,
        [task.id]
      )
      return { ...task, labels }
    }))

    return res.status(200).json({ tasks: tasksWithLabels })
  } catch (error) {
    console.error('Calendar tasks error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
