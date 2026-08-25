import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';
import { notifyNewCommit } from '@/lib/notifications';

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const task = await db.queryOne('SELECT id FROM tasks WHERE id = ?', [id]);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const commits = await db.query(
        'SELECT * FROM task_commits WHERE task_id = ? ORDER BY created_at DESC',
        [id]
      );

      return res.status(200).json({ commits });
    } catch (error) {
      console.error('List commits error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const { commit_hash, message, author, additions, deletions } = req.body;

    if (!commit_hash || !commit_hash.trim()) {
      return res.status(400).json({ error: 'Commit hash is required' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Commit message is required' });
    }

    try {
      const task = await db.queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const result = await db.insert(
        `INSERT INTO task_commits (task_id, commit_hash, commit_message, author, added_lines, deleted_lines, status, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, 'manual', NOW())`,
        [
          id,
          commit_hash.trim(),
          message.trim(),
          author || user.name,
          additions || 0,
          deletions || 0,
        ]
      );

      await db.insert(
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [user.id, `added commit ${commit_hash.trim().substring(0, 7)}`, 'task', id, JSON.stringify({ title: task.title })]
      );

      const commit = await db.queryOne('SELECT * FROM task_commits WHERE id = ?', [result.insertId]);

      // Send notification to task assignee and creator
      try {
        await notifyNewCommit(task, { message: message.trim() }, { id: user.id, name: user.name })
      } catch (e) { console.error('Commit notification error:', e) }

      return res.status(201).json({ commit });
    } catch (error) {
      console.error('Add commit error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
