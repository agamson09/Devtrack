import { getAuthUser } from '@/lib/auth';
import { getTenantFromRequest } from '@/lib/tenant';
import db from '@/lib/db';
import { notifyNewComment } from '@/lib/notifications';

const { tenantQuery, tenantQueryOne, tenantInsert, tenantRemove } = db;

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = await getTenantFromRequest(req);

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const task = await tenantQueryOne(tenantId, 'SELECT id FROM tasks WHERE id = ?', [id]);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const comments = await tenantQuery(
        tenantId,
        `SELECT tc.*, u.name as user_name, u.avatar as user_avatar, u.avatar_style as user_avatar_style, u.avatar_seed as user_avatar_seed, u.avatar_options as user_avatar_options
        FROM task_comments tc
        LEFT JOIN users u ON tc.user_id = u.id
        WHERE tc.task_id = ?
        ORDER BY tc.created_at ASC`,
        [id]
      );

      return res.status(200).json({ comments });
    } catch (error) {
      console.error('List comments error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const commentText = body.comment;
    const imageUrl = body.image_url || null;
    const checklistId = body.checklist_id || null;

    if (!commentText || !commentText.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    try {
      const task = await tenantQueryOne(tenantId, 'SELECT * FROM tasks WHERE id = ?', [id]);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const trimmedComment = commentText.trim();
      const result = await tenantInsert(
        tenantId,
        'INSERT INTO task_comments (task_id, user_id, comment, image_url, checklist_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [id, user.id, trimmedComment, imageUrl, checklistId]
      );

      await tenantInsert(
        tenantId,
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [user.id, 'commented on task', 'task', id, JSON.stringify({ title: task.title })]
      );

      const newComment = await tenantQueryOne(
        tenantId,
        `SELECT tc.*, u.name as user_name, u.avatar as user_avatar, u.avatar_style as user_avatar_style, u.avatar_seed as user_avatar_seed, u.avatar_options as user_avatar_options
        FROM task_comments tc
        LEFT JOIN users u ON tc.user_id = u.id
        WHERE tc.id = ?`,
        [result.insertId]
      );

      // Send notification to task assignee
      try {
        const commenter = await tenantQueryOne(tenantId, 'SELECT name FROM users WHERE id = ?', [user.id])
        await notifyNewComment(task, { ...newComment, user_name: commenter?.name }, user.id)
      } catch (e) { console.error('Comment notification error:', e) }

      return res.status(201).json({ comment: newComment });
    } catch (error) {
      console.error('Add comment error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    const { comment_id } = req.query;

    if (!comment_id) {
      return res.status(400).json({ error: 'Comment ID is required' });
    }

    try {
      const existingComment = await tenantQueryOne(
        tenantId,
        'SELECT * FROM task_comments WHERE id = ? AND task_id = ?',
        [comment_id, id]
      );

      if (!existingComment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (existingComment.user_id !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: You can only delete your own comments' });
      }

      await tenantQuery(tenantId, 'DELETE FROM task_comments WHERE id = ?', [comment_id]);

      return res.status(200).json({ message: 'Comment deleted' });
    } catch (error) {
      console.error('Delete comment error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
