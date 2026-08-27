import { getAuthUser } from '@/lib/auth'
import { getTenantFromRequest } from '@/lib/tenant'
import db from '@/lib/db'
import { notifyLabelsChanged } from '@/lib/notifications'

const { tenantQuery, tenantQueryOne, tenantInsert, tenantRemove } = db;

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantFromRequest(req);

  const { id } = req.query

  if (req.method === 'GET') {
    try {
      const labels = await tenantQuery(
        tenantId,
        `SELECT l.* FROM labels l
         INNER JOIN task_labels tl ON l.id = tl.label_id
         WHERE tl.task_id = ?
         ORDER BY l.name`,
        [id]
      )
      return res.status(200).json({ labels })
    } catch (error) {
      console.error('Get task labels error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    try {
      const { label_ids } = req.body
      if (!Array.isArray(label_ids)) return res.status(400).json({ error: 'label_ids must be an array' })

      const task = await tenantQueryOne(tenantId, 'SELECT id FROM tasks WHERE id = ?', [id])
      if (!task) return res.status(404).json({ error: 'Task not found' })

      await tenantQuery(tenantId, 'DELETE FROM task_labels WHERE task_id = ?', [id])

      for (const labelId of label_ids) {
        await tenantQuery(tenantId, 'INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)', [id, labelId])
      }

      const labels = await tenantQuery(
        tenantId,
        `SELECT l.* FROM labels l
         INNER JOIN task_labels tl ON l.id = tl.label_id
         WHERE tl.task_id = ?
         ORDER BY l.name`,
        [id]
      )
      try {
        const fullTask = await tenantQueryOne(tenantId, 'SELECT * FROM tasks WHERE id = ?', [id])
        if (fullTask) await notifyLabelsChanged(fullTask, labels, user.id)
      } catch (e) { console.error('Label notification error:', e) }
      return res.status(200).json({ labels })
    } catch (error) {
      console.error('Update task labels error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
