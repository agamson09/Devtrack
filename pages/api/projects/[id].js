import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate } = db;
import { getTenantFromRequest } from '@/lib/tenant';
import { notifyProjectUpdated, notifyProjectDeleted } from '@/lib/notifications';
import { requireCSRF } from '@/lib/csrf';

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = await getTenantFromRequest(req);
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const project = await tenantQueryOne(
        tenantId,
        `SELECT 
          p.*,
          COUNT(DISTINCT t.id) as task_count,
          COUNT(DISTINCT t.assigned_to) as member_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        WHERE p.id = ?
        GROUP BY p.id`,
        [id]
      );

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const members = await tenantQuery(
        tenantId,
        `SELECT DISTINCT u.id, u.name, u.email, u.role
        FROM tasks t
        JOIN users u ON t.assigned_to = u.id
        WHERE t.project_id = ?
        ORDER BY u.name`,
        [id]
      );

      return res.status(200).json({ project, members });
    } catch (error) {
      console.error('Get project error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    if (!(await requireCSRF(req, res))) return;
    const { name, description, git_repo_url, status } = req.body;

    try {
      const existing = await tenantQueryOne(tenantId, 'SELECT * FROM projects WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const updates = [];
      const params = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (git_repo_url !== undefined) {
        updates.push('git_repo_url = ?');
        params.push(git_repo_url);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = NOW()');
      params.push(id);

      await tenantUpdate(
        tenantId,
        `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      const changes = [];
      if (name !== undefined && name !== existing.name) changes.push('name');
      if (description !== undefined && description !== existing.description) changes.push('description');
      if (status !== undefined && status !== existing.status) changes.push('status');

      if (changes.length > 0) {
        await tenantInsert(
          tenantId,
          'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [user.id, `updated project (${changes.join(', ')})`, 'project', id, JSON.stringify({ name: existing.name })]
        );
      }

      const project = await tenantQueryOne(tenantId, 'SELECT * FROM projects WHERE id = ?', [id]);
      try {
        if (changes.length > 0) {
          await notifyProjectUpdated(project, changes.map(c => ({ field: c })), user.id)
        }
      } catch (e) { console.error('Project update notification error:', e) }
      return res.status(200).json({ project });
    } catch (error) {
      console.error('Update project error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    if (!(await requireCSRF(req, res))) return;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin only' });
    }

    try {
      const existing = await tenantQueryOne(tenantId, 'SELECT * FROM projects WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Project not found' });
      }

      await tenantQuery(tenantId, 'DELETE FROM task_commits WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)', [id]);
      await tenantQuery(tenantId, 'DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)', [id]);
      await tenantQuery(tenantId, 'DELETE FROM task_history WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)', [id]);
      await tenantQuery(tenantId, 'DELETE FROM tasks WHERE project_id = ?', [id]);
      await tenantQuery(tenantId, 'DELETE FROM projects WHERE id = ?', [id]);

      await tenantInsert(
        tenantId,
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [user.id, 'deleted project', 'project', id, JSON.stringify({ name: existing.name })]
      );

      try {
        await notifyProjectDeleted(existing, user.id)
      } catch (e) { console.error('Project delete notification error:', e) }

      return res.status(200).json({ message: 'Project deleted' });
    } catch (error) {
      console.error('Delete project error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
