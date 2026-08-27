import { getAuthUser } from '@/lib/auth';
import { getTenantFromRequest } from '@/lib/tenant';
import db from '@/lib/db';
import { notifyChecklistChanged } from '@/lib/notifications';

const { tenantQuery, tenantQueryOne, tenantInsert, tenantRemove } = db;

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = await getTenantFromRequest(req);

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const items = await tenantQuery(
        tenantId,
        'SELECT * FROM task_checklists WHERE task_id = ? ORDER BY sort_order ASC, id ASC',
        [id]
      );
      for (const item of items) {
        item.replies = await tenantQuery(
          tenantId,
          'SELECT tc.*, u.name as user_name, u.avatar as user_avatar, u.avatar_style as user_avatar_style, u.avatar_seed as user_avatar_seed, u.avatar_options as user_avatar_options FROM task_comments tc LEFT JOIN users u ON tc.user_id = u.id WHERE tc.checklist_id = ? ORDER BY tc.created_at ASC',
          [item.id]
        );
      }
      return res.status(200).json({ items });
    } catch (error) {
      console.error('Get checklists error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { title, sort_order, checklist_id, comment, image_url } = req.body;

      if (checklist_id) {
        if (!comment && !image_url) return res.status(400).json({ error: 'Comment or image required' });
        const result = await tenantInsert(
          tenantId,
          'INSERT INTO task_comments (task_id, user_id, checklist_id, comment, image_url) VALUES (?, ?, ?, ?, ?)',
          [id, user.id, checklist_id, comment || '', image_url || null]
        );
        return res.status(201).json({ id: result.insertId });
      }

      if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

      const maxOrder = await tenantQueryOne(tenantId, 'SELECT MAX(sort_order) as max_order FROM task_checklists WHERE task_id = ?', [id]);
      const order = sort_order ?? ((maxOrder?.max_order || 0) + 1);

      const result = await tenantInsert(
        tenantId,
        'INSERT INTO task_checklists (task_id, title, sort_order) VALUES (?, ?, ?)',
        [id, title.trim(), order]
      );

      const item = await tenantQueryOne(tenantId, 'SELECT * FROM task_checklists WHERE id = ?', [result.insertId]);
      try {
        const task = await tenantQueryOne(tenantId, 'SELECT * FROM tasks WHERE id = ?', [id])
        if (task) await notifyChecklistChanged(task, 'added', title.trim(), user.id)
      } catch (e) { console.error('Checklist notification error:', e) }
      return res.status(201).json({ item });
    } catch (error) {
      console.error('Create checklist error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { item_id, title, is_checked, sort_order } = req.body;
      if (!item_id) return res.status(400).json({ error: 'Item ID is required' });

      const existing = await tenantQueryOne(tenantId, 'SELECT * FROM task_checklists WHERE id = ? AND task_id = ?', [item_id, id]);
      if (!existing) return res.status(404).json({ error: 'Item not found' });

      const updates = [];
      const params = [];
      if (title !== undefined) { updates.push('title = ?'); params.push(title); }
      if (is_checked !== undefined) { updates.push('is_checked = ?'); params.push(is_checked ? 1 : 0); }
      if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }

      if (updates.length > 0) {
        params.push(item_id);
        await tenantQuery(tenantId, 'UPDATE task_checklists SET ' + updates.join(', ') + ' WHERE id = ?', params);
      }

      const item = await tenantQueryOne(tenantId, 'SELECT * FROM task_checklists WHERE id = ?', [item_id]);
      try {
        if (is_checked !== undefined) {
          const task = await tenantQueryOne(tenantId, 'SELECT * FROM tasks WHERE id = ?', [id])
          if (task) await notifyChecklistChanged(task, is_checked ? 'completed' : 'uncompleted', item?.title, user.id)
        }
      } catch (e) { console.error('Checklist notification error:', e) }
      return res.status(200).json({ item });
    } catch (error) {
      console.error('Update checklist error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { item_id, comment_id } = req.query;

      if (comment_id) {
        await tenantQuery(tenantId, 'DELETE FROM task_comments WHERE id = ? AND task_id = ?', [comment_id, id]);
        return res.status(200).json({ message: 'Reply deleted' });
      }

      if (!item_id) return res.status(400).json({ error: 'Item ID is required' });

      await tenantQuery(tenantId, 'DELETE FROM task_checklists WHERE id = ? AND task_id = ?', [item_id, id]);
      return res.status(200).json({ message: 'Item deleted' });
    } catch (error) {
      console.error('Delete checklist error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
