import { getAuthUser } from '@/lib/auth';
import db from '@/lib/db';

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const templates = await db.query(
        'SELECT tt.*, u.name as created_by_name FROM task_templates tt LEFT JOIN users u ON tt.created_by = u.id ORDER BY tt.created_at DESC'
      );
      return res.status(200).json({ templates });
    } catch (error) {
      console.error('Get templates error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, description, priority, module, estimated_hours, checklist_items } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

      const result = await db.insert(
        'INSERT INTO task_templates (name, description, priority, module, estimated_hours, checklist_items, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          name.trim(),
          description || null,
          priority || 'medium',
          module || null,
          estimated_hours || null,
          checklist_items ? JSON.stringify(checklist_items) : null,
          user.id
        ]
      );

      const template = await db.queryOne('SELECT * FROM task_templates WHERE id = ?', [result.insertId]);
      return res.status(201).json({ template });
    } catch (error) {
      console.error('Create template error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id: templateId, name, description, priority, module, estimated_hours, checklist_items } = req.body;
      if (!templateId) return res.status(400).json({ error: 'Template ID is required' });

      const existing = await db.queryOne('SELECT * FROM task_templates WHERE id = ?', [templateId]);
      if (!existing) return res.status(404).json({ error: 'Template not found' });

      await db.query(
        'UPDATE task_templates SET name = ?, description = ?, priority = ?, module = ?, estimated_hours = ?, checklist_items = ? WHERE id = ?',
        [
          name || existing.name,
          description !== undefined ? description : existing.description,
          priority || existing.priority,
          module !== undefined ? module : existing.module,
          estimated_hours !== undefined ? estimated_hours : existing.estimated_hours,
          checklist_items ? JSON.stringify(checklist_items) : existing.checklist_items,
          templateId
        ]
      );

      const template = await db.queryOne('SELECT * FROM task_templates WHERE id = ?', [templateId]);
      return res.status(200).json({ template });
    } catch (error) {
      console.error('Update template error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id: templateId } = req.query;
      if (!templateId) return res.status(400).json({ error: 'Template ID is required' });

      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

      await db.query('DELETE FROM task_templates WHERE id = ?', [templateId]);
      return res.status(200).json({ message: 'Template deleted' });
    } catch (error) {
      console.error('Delete template error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}