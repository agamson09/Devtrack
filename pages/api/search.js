import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';
const { tenantQuery } = db;
import { getTenantFromRequest } from '@/lib/tenant';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(200).json({ tasks: [], projects: [], notes: [] });
  }

  const searchTerm = `%${q.trim()}%`;
  const tenantId = await getTenantFromRequest(req);

  try {
    const tasks = await tenantQuery(
      tenantId,
      `SELECT t.id, t.title, t.status, t.priority, t.deadline, t.module,
              u.name as assignee_name, p.name as project_name, p.id as project_id
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE (t.title LIKE ? OR t.description LIKE ? OR t.module LIKE ?)
       ORDER BY t.created_at DESC
       LIMIT 20`,
      [searchTerm, searchTerm, searchTerm]
    );

    const projects = await tenantQuery(
      tenantId,
      `SELECT id, name, description, status
       FROM projects
       WHERE name LIKE ? OR description LIKE ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [searchTerm, searchTerm]
    );

    let notes = [];
    try {
      let noteSql = `
        SELECT w.id, w.title, w.tags, w.updated_at, p.name as project_name
        FROM wiki_notes w
        LEFT JOIN projects p ON w.project_id = p.id
        WHERE (w.title LIKE ? OR w.content LIKE ? OR w.tags LIKE ?)`;
      const noteParams = [searchTerm, searchTerm, searchTerm];
      if (tenantId) {
        noteSql += ' AND (w.tenant_id = ? OR w.tenant_id IS NULL)';
        noteParams.push(tenantId);
      }
      noteSql += ' ORDER BY w.updated_at DESC LIMIT 10';
      notes = await tenantQuery(tenantId, noteSql, noteParams);
    } catch (e) {
      console.error('Wiki search error:', e.message);
    }

    return res.status(200).json({ tasks, projects, notes });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
