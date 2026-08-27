import { getAuthUser } from '@/lib/auth';
import { getTenantFromRequest } from '@/lib/tenant';
import db from '@/lib/db';

const { tenantQuery, tenantQueryOne, tenantInsert, tenantRemove } = db;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = await getTenantFromRequest(req);

  try {
    const { status, project_id } = req.query;
    let query = `
      SELECT t.*, u.name as assignee_name, u.avatar as assignee_avatar, u.avatar_style as assignee_avatar_style, u.avatar_seed as assignee_avatar_seed, u.avatar_options as assignee_avatar_options, p.name as project_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.assigned_to = ?
    `;
    const params = [user.id];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (project_id) {
      query += ' AND t.project_id = ?';
      params.push(project_id);
    }

    query += ' ORDER BY FIELD(t.status, "in_progress", "review", "todo", "done"), t.deadline ASC';

    const tasks = await tenantQuery(tenantId, query, params);
    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('My tasks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
