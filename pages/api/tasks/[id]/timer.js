import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const task = await db.queryOne(
        'SELECT timer_started_at, timer_accumulated_seconds, actual_hours FROM tasks WHERE id = ?',
        [id]
      );
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      let elapsed = task.timer_accumulated_seconds || 0;
      if (task.timer_started_at) {
        const started = new Date(task.timer_started_at);
        elapsed += Math.floor((Date.now() - started.getTime()) / 1000);
      }

      return res.status(200).json({
        timer_started_at: task.timer_started_at,
        timer_accumulated_seconds: task.timer_accumulated_seconds || 0,
        elapsed_seconds: elapsed,
        is_running: !!task.timer_started_at,
        actual_hours: task.actual_hours
      });
    } catch (error) {
      console.error('Get timer error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const { action } = req.body;

    try {
      const task = await db.queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (user.role === 'member' && user.id !== task.assigned_to) {
        return res.status(403).json({ error: 'Forbidden: You can only track time on tasks assigned to you' });
      }

      if (action === 'start') {
        if (task.timer_started_at) {
          return res.status(400).json({ error: 'Timer is already running' });
        }
        await db.update(
          'UPDATE tasks SET timer_started_at = NOW(), updated_at = NOW() WHERE id = ?',
          [id]
        );
        return res.status(200).json({ message: 'Timer started', timer_started_at: new Date().toISOString() });
      }

      if (action === 'stop') {
        if (!task.timer_started_at) {
          return res.status(400).json({ error: 'Timer is not running' });
        }
        const started = new Date(task.timer_started_at);
        const sessionSeconds = Math.floor((Date.now() - started.getTime()) / 1000);
        const totalAccumulated = (task.timer_accumulated_seconds || 0) + sessionSeconds;
        const totalHours = Math.round((totalAccumulated / 3600) * 100) / 100;

        await db.update(
          'UPDATE tasks SET timer_started_at = NULL, timer_accumulated_seconds = ?, actual_hours = ?, updated_at = NOW() WHERE id = ?',
          [totalAccumulated, totalHours, id]
        );

        await db.insert(
          'INSERT INTO task_history (task_id, user_id, field_changed, old_value, new_value, changed_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [id, user.id, 'timer', `${task.timer_accumulated_seconds || 0}s`, `${totalAccumulated}s`]
        );

        return res.status(200).json({
          message: 'Timer stopped',
          accumulated_seconds: totalAccumulated,
          actual_hours: totalHours,
          session_seconds: sessionSeconds
        });
      }

      if (action === 'reset') {
        await db.update(
          'UPDATE tasks SET timer_started_at = NULL, timer_accumulated_seconds = 0, updated_at = NOW() WHERE id = ?',
          [id]
        );
        return res.status(200).json({ message: 'Timer reset', accumulated_seconds: 0 });
      }

      return res.status(400).json({ error: 'Invalid action. Use: start, stop, or reset' });
    } catch (error) {
      console.error('Timer action error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
