import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
import { getTenantFromRequest } from '@/lib/tenant'
import { validateData, validateId } from '@/lib/middleware'
import { requireCSRF } from '@/lib/csrf'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query
  const idValidation = validateId(id)
  if (!idValidation.valid) {
    return res.status(400).json({ error: idValidation.error })
  }

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'GET') {
    try {
      const note = await db.queryOne(
        `SELECT w.*, u.name as author_name,
                p.name as project_name
         FROM wiki_notes w
         LEFT JOIN users u ON w.created_by = u.id
         LEFT JOIN projects p ON w.project_id = p.id
         WHERE w.id = ?`,
        [id]
      )
      if (!note) return res.status(404).json({ error: 'Note not found' })
      if (tenantId && note.tenant_id !== null && note.tenant_id !== tenantId) return res.status(404).json({ error: 'Note not found' })

      // Backlinks: other notes whose content references [[this-slug]] or [[This Title]]
      const likeA = `%[[${note.slug}]]%`
      const likeB = `%[[${note.title}]]%`
      let backSql = `
        SELECT DISTINCT w.id, w.title, w.slug
        FROM wiki_notes w
        WHERE w.id != ?
          AND (w.content LIKE ? OR w.content LIKE ?)`
      const backParams = [id, likeA, likeB]
      if (tenantId) {
        backSql += ' AND (w.tenant_id = ? OR w.tenant_id IS NULL)'
        backParams.push(tenantId)
      }
      backSql += ' ORDER BY w.title ASC LIMIT 50'

      const backlinks = await db.query(backSql, backParams)
      return res.status(200).json({ note, backlinks })
    } catch (error) {
      console.error('Get wiki note error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'PUT') {
    if (!(await requireCSRF(req, res))) return
    const { valid, data, errors } = validateData(req.body, 'updateWikiNote')
    if (!valid) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    try {
      const existing = await db.queryOne('SELECT * FROM wiki_notes WHERE id = ?', [id])
      if (!existing) return res.status(404).json({ error: 'Note not found' })
      if (tenantId && existing.tenant_id !== null && existing.tenant_id !== tenantId) return res.status(404).json({ error: 'Note not found' })

      // Author or admin can edit
      if (user.role !== 'admin' && user.id !== existing.created_by) {
        return res.status(403).json({ error: 'Forbidden: only the author or an admin can edit this note' })
      }

      // Slug stays stable across renames so existing [[links]] keep working.
      const fields = []
      const params = []
      for (const key of ['title', 'content', 'tags', 'project_id']) {
        if (data[key] !== undefined) {
          fields.push(`${key} = ?`)
          if (key === 'tags') {
            params.push(data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean).join(', ') : null)
          } else if (key === 'project_id') {
            params.push(data.project_id || null)
          } else {
            params.push(data[key] || null)
          }
        }
      }
      if (fields.length === 0) {
        return res.status(200).json({ note: existing })
      }
      fields.push('updated_at = NOW()')
      params.push(id)

      await db.update(`UPDATE wiki_notes SET ${fields.join(', ')} WHERE id = ?`, params)

      const note = await db.queryOne(
        `SELECT w.*, u.name as author_name FROM wiki_notes w
         LEFT JOIN users u ON w.created_by = u.id WHERE w.id = ?`,
        [id]
      )
      return res.status(200).json({ note })
    } catch (error) {
      console.error('Update wiki note error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    if (!(await requireCSRF(req, res))) return
    try {
      const existing = await db.queryOne('SELECT * FROM wiki_notes WHERE id = ?', [id])
      if (!existing) return res.status(404).json({ error: 'Note not found' })
      if (user.role !== 'admin' && user.id !== existing.created_by) {
        return res.status(403).json({ error: 'Forbidden: only the author or an admin can delete this note' })
      }
      await db.query('DELETE FROM wiki_notes WHERE id = ?', [id])
      return res.status(200).json({ message: 'Note deleted' })
    } catch (error) {
      console.error('Delete wiki note error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
