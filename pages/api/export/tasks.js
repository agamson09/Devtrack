import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { project_id, status, assigned_to, mine } = req.query;
    let query = `
      SELECT t.id, t.title, t.description, t.status, t.priority, t.module,
             t.deadline, t.estimated_hours, t.actual_hours, t.created_at,
             u.name as assignee_name, p.name as project_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (mine === '1') {
      query += ' AND t.assigned_to = ?';
      params.push(user.id);
    }
    if (project_id) {
      query += ' AND t.project_id = ?';
      params.push(project_id);
    }
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (assigned_to) {
      query += ' AND t.assigned_to = ?';
      params.push(assigned_to);
    }

    query += ' ORDER BY t.created_at DESC';

    const tasks = await db.query(query, params);

    const statusLabels = { todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done' };
    const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

    const header = ['ID', 'Title', 'Project', 'Status', 'Priority', 'Assignee', 'Module', 'Deadline', 'Est. Hours', 'Actual Hours', 'Created At'];
    const rows = tasks.map(t => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.project_name || '').replace(/"/g, '""')}"`,
      statusLabels[t.status] || t.status,
      priorityLabels[t.priority] || t.priority,
      `"${(t.assignee_name || 'Unassigned').replace(/"/g, '""')}"`,
      t.module || '',
      t.deadline ? new Date(t.deadline + 'T00:00:00').toLocaleDateString() : '',
      t.estimated_hours || '',
      t.actual_hours || '',
      new Date(t.created_at).toLocaleString()
    ]);

    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="devtrack-tasks-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.status(200).send('\uFEFF' + csv);
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
