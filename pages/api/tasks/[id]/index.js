import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate } = db;
import { getTenantFromRequest } from '@/lib/tenant';
import { notifyStatusChanged, notifyTaskAssigned, notifyTaskUpdated, notifyTaskDeleted } from '@/lib/notifications';
import { validateData, validateId } from '@/lib/middleware';
import { requireCSRF } from '@/lib/csrf';

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = await getTenantFromRequest(req);
  const { id } = req.query;
  const idValidation = validateId(id);
  if (!idValidation.valid) {
    return res.status(400).json({ error: idValidation.error });
  }

  if (req.method === 'GET') {
    try {
      const task = await tenantQueryOne(
        tenantId,
        `SELECT t.*, u.name as assignee_name, u.avatar as assignee_avatar, u.avatar_style as assignee_avatar_style, u.avatar_seed as assignee_avatar_seed, u.avatar_options as assignee_avatar_options, p.name as project_name
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.id = ?`,
        [id]
      );

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const commits = await tenantQuery(
        tenantId,
        'SELECT * FROM task_commits WHERE task_id = ? ORDER BY created_at DESC',
        [id]
      );

      const comments = await tenantQuery(
        tenantId,
        `SELECT tc.*, u.name as user_name, u.avatar as user_avatar, u.avatar_style as user_avatar_style, u.avatar_seed as user_avatar_seed, u.avatar_options as user_avatar_options
        FROM task_comments tc
        LEFT JOIN users u ON tc.user_id = u.id
        WHERE tc.task_id = ?
        ORDER BY tc.created_at ASC`,
        [id]
      );

      const history = await tenantQuery(
        tenantId,
        `SELECT th.*, u.name as user_name
        FROM task_history th
        LEFT JOIN users u ON th.user_id = u.id
        WHERE th.task_id = ?
        ORDER BY th.changed_at ASC`,
        [id]
      );

      const labels = await tenantQuery(
        tenantId,
        `SELECT l.id, l.name, l.color FROM labels l
         INNER JOIN task_labels tl ON l.id = tl.label_id
         WHERE tl.task_id = ?`,
        [id]
      );

      return res.status(200).json({
        task: {
          ...task,
          commits,
          comments,
          history,
          labels,
        },
      });
    } catch (error) {
      console.error('Get task error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    if (!(await requireCSRF(req, res))) return;
    const { valid, data, errors } = validateData(req.body, 'updateTask');
    if (!valid) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    try {
      const existing = await tenantQueryOne(tenantId, 'SELECT * FROM tasks WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (user.role === 'member' && user.id !== existing.assigned_to) {
        return res.status(403).json({ error: 'Forbidden: You can only update tasks assigned to you' });
      }

      let fields;
      if (user.role === 'member') {
        fields = {
          status: req.body.status,
          actual_hours: req.body.actual_hours,
        };
      } else {
        fields = {
          title: req.body.title,
          description: req.body.description,
          status: req.body.status,
          priority: req.body.priority,
          assigned_to: req.body.assigned_to,
          module: req.body.module,
          deadline: req.body.deadline,
          start_date: req.body.start_date,
          sort_order: req.body.sort_order,
          estimated_hours: req.body.estimated_hours,
          actual_hours: req.body.actual_hours,
          progress: req.body.progress,
          depends_on: req.body.depends_on,
          approved_by: req.body.approved_by,
          approved_at: req.body.approved_at,
        };
      }

      const updates = [];
      const params = [];
      const changes = [];

      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
          const oldVal = existing[key] !== null ? String(existing[key]) : null;
          const newVal = value !== null ? String(value) : null;
          if (oldVal !== newVal) {
            updates.push(`${key} = ?`);
            params.push(value || null);
            if (key !== 'sort_order') {
              changes.push({ field: key, old_value: oldVal, new_value: newVal });
            }
          }
        }
      }

      if (updates.length === 0) {
        return res.status(200).json({ task: existing });
      }

      updates.push('updated_at = NOW()');
      params.push(id);

      await tenantUpdate(
        tenantId,
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      for (const change of changes) {
        await tenantInsert(
          tenantId,
          `INSERT INTO task_history (task_id, user_id, field_changed, old_value, new_value, changed_at) 
          VALUES (?, ?, ?, ?, ?, NOW())`,
          [id, user.id, change.field, change.old_value, change.new_value]
        );
      }

      if (changes.some((c) => c.field === 'status')) {
        const newStatus = fields.status;
        const statusLabels = {
          todo: 'Todo',
          in_progress: 'In Progress',
          review: 'Review',
          done: 'Done',
        };
        await tenantInsert(
          tenantId,
          'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [user.id, `moved task to ${statusLabels[newStatus] || newStatus}`, 'task', id, JSON.stringify({ title: existing.title })]
        );
      } else if (changes.length > 0) {
        const changedFields = changes.map((c) => c.field).join(', ');
        await tenantInsert(
          tenantId,
          'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [user.id, `updated task (${changedFields})`, 'task', id, JSON.stringify({ title: existing.title })]
        );
      }

      const task = await tenantQueryOne(
        tenantId,
        `SELECT t.*, u.name as assignee_name
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.id = ?`,
        [id]
      );

      // Send chat message when task is assigned
      const assignChange = changes.find(c => c.field === 'assigned_to')
      if (assignChange && assignChange.new_value && global.io) {
        const assigneeId = parseInt(assignChange.new_value)
        try {
          const result = await tenantInsert(
            tenantId,
            'INSERT INTO messages (sender_id, receiver_id, message, message_type) VALUES (?, ?, ?, ?)',
            [user.id, assigneeId, `You have been assigned to task "${existing.title}" in project #${existing.project_id}`, 'text']
          )
          const msg = await tenantQueryOne(
            tenantId,
            'SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?',
            [result.insertId]
          )
          if (msg) {
            global.io.to(`user-${assigneeId}`).emit('chat:message', msg)
          }
        } catch (e) { console.error('Assignment notification error:', e) }
      }

      // Send in-app + email + Telegram notifications
      try {
        const project = await tenantQueryOne(tenantId, 'SELECT name FROM projects WHERE id = ?', [existing.project_id])
        for (const change of changes) {
          if (change.field === 'status') {
            const statusLabels = { todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done' }
            const oldLabel = statusLabels[change.old_value] || change.old_value
            const newLabel = statusLabels[change.new_value] || change.new_value
            await notifyStatusChanged({ ...existing, assigned_to: existing.assigned_to }, oldLabel, newLabel, user.id)
          }
          if (change.field === 'assigned_to' && change.new_value) {
            await notifyTaskAssigned(parseInt(change.new_value), existing, project || { name: 'Unknown' })
          }
        }
        const nonStatusChanges = changes.filter(c => !['status', 'assigned_to'].includes(c.field))
        if (nonStatusChanges.length > 0) {
          await notifyTaskUpdated(existing, nonStatusChanges, user.id)
        }
      } catch (e) { console.error('Notification dispatch error:', e) }

      return res.status(200).json({ task });
    } catch (error) {
      console.error('Update task error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    if (!(await requireCSRF(req, res))) return;
    try {
      const existing = await tenantQueryOne(tenantId, 'SELECT * FROM tasks WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (user.role !== 'admin' && user.id !== existing.created_by) {
        return res.status(403).json({ error: 'Forbidden: Only admin or task creator can delete tasks' });
      }

      await tenantQuery(tenantId, 'DELETE FROM task_commits WHERE task_id = ?', [id]);
      await tenantQuery(tenantId, 'DELETE FROM task_comments WHERE task_id = ?', [id]);
      await tenantQuery(tenantId, 'DELETE FROM task_history WHERE task_id = ?', [id]);
      await tenantQuery(tenantId, 'DELETE FROM tasks WHERE id = ?', [id]);

      await tenantInsert(
        tenantId,
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [user.id, 'deleted task', 'task', id, JSON.stringify({ title: existing.title })]
      );

      try {
        await notifyTaskDeleted(existing, user.id)
      } catch (e) { console.error('Task delete notification error:', e) }

      return res.status(200).json({ message: 'Task deleted' });
    } catch (error) {
      console.error('Delete task error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
