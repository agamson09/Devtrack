import { getAuthUser } from '@/lib/auth';
import { getTenantFromRequest } from '@/lib/tenant';
import db from '@/lib/db';
import { notifyFileUploaded } from '@/lib/notifications';

const { tenantQuery, tenantQueryOne, tenantInsert, tenantRemove } = db;

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const tenantId = await getTenantFromRequest(req);

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const attachments = await tenantQuery(
        tenantId,
        'SELECT ta.*, u.name as uploaded_by_name FROM task_attachments ta LEFT JOIN users u ON ta.uploaded_by = u.id WHERE ta.task_id = ? ORDER BY ta.created_at DESC',
        [id]
      );
      return res.status(200).json({ attachments });
    } catch (error) {
      console.error('Get attachments error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { filename, file_url, file_size, mime_type } = req.body;
      if (!filename || !file_url) return res.status(400).json({ error: 'Filename and file_url are required' });

      const result = await tenantInsert(
        tenantId,
        'INSERT INTO task_attachments (task_id, filename, file_url, file_size, mime_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
        [id, filename, file_url, file_size || 0, mime_type || null, user.id]
      );

      const attachment = await tenantQueryOne(
        tenantId,
        'SELECT ta.*, u.name as uploaded_by_name FROM task_attachments ta LEFT JOIN users u ON ta.uploaded_by = u.id WHERE ta.id = ?',
        [result.insertId]
      );
      try {
        const task = await tenantQueryOne(tenantId, 'SELECT * FROM tasks WHERE id = ?', [id])
        if (task) await notifyFileUploaded(task, filename, user.id)
      } catch (e) { console.error('File upload notification error:', e) }
      return res.status(201).json({ attachment });
    } catch (error) {
      console.error('Create attachment error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { attachment_id } = req.query;
      if (!attachment_id) return res.status(400).json({ error: 'Attachment ID is required' });

      const existing = await tenantQueryOne(tenantId, 'SELECT * FROM task_attachments WHERE id = ? AND task_id = ?', [attachment_id, id]);
      if (!existing) return res.status(404).json({ error: 'Attachment not found' });

      if (user.role !== 'admin' && user.id !== existing.uploaded_by) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await tenantQuery(tenantId, 'DELETE FROM task_attachments WHERE id = ?', [attachment_id]);
      return res.status(200).json({ message: 'Attachment deleted' });
    } catch (error) {
      console.error('Delete attachment error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
