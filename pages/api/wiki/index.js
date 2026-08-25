import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
import { getTenantFromRequest } from '@/lib/tenant'
import { validateData } from '@/lib/middleware'
import { requireCSRF } from '@/lib/csrf'

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200) || 'note'
}

async function uniqueSlug(base, tenantId) {
  let slug = base
  let n = 2
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = tenantId
      ? await db.query('SELECT id FROM wiki_notes WHERE slug = ? AND tenant_id = ?', [slug, tenantId])
      : await db.query('SELECT id FROM wiki_notes WHERE slug = ? AND tenant_id IS NULL', [slug])
    if (rows.length === 0) return slug
    slug = `${base}-${n++}`
  }
}

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantFromRequest(req)

  if (req.method === 'GET') {
    try {
      const { q, tag, project_id } = req.query
      let sql = `
        SELECT w.id, w.title, w.slug, w.tags, w.project_id, w.created_by, w.updated_at,
               u.name as author_name, p.name as project_name
        FROM wiki_notes w
        LEFT JOIN users u ON w.created_by = u.id
        LEFT JOIN projects p ON w.project_id = p.id
        WHERE 1=1`
      const params = []

      if (tenantId) {
        sql += ' AND (w.tenant_id = ? OR w.tenant_id IS NULL)'
        params.push(tenantId)
      }
      if (q) {
        sql += ' AND (w.title LIKE ? OR w.content LIKE ?)'
        params.push(`%${q}%`, `%${q}%`)
      }
      if (tag) {
        sql += ' AND FIND_IN_SET(?, REPLACE(w.tags, \', \', \',\'))'
        params.push(tag)
      }
      if (project_id) {
        sql += ' AND w.project_id = ?'
        params.push(project_id)
      }

      sql += ' ORDER BY w.updated_at DESC'

      const notes = await db.query(sql, params)
      return res.status(200).json({ notes })
    } catch (error) {
      console.error('List wiki notes error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'POST') {
    if (!(await requireCSRF(req, res))) return
    const { valid, data, errors } = validateData(req.body, 'createWikiNote')
    if (!valid) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }
    const { title, content, tags, project_id } = data

    try {
      const slug = await uniqueSlug(slugify(title), tenantId)
      const result = await db.insert(
        `INSERT INTO wiki_notes (project_id, title, slug, content, tags, created_by, tenant_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          project_id || null,
          title.trim(),
          slug,
          content || '',
          tags ? tags.split(',').map(t => t.trim()).filter(Boolean).join(', ') : null,
          user.id,
          tenantId,
        ]
      )

      await db.insert(
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [user.id, 'created wiki note', 'wiki_note', result.insertId, tenantId]
      )

      const note = await db.queryOne('SELECT * FROM wiki_notes WHERE id = ?', [result.insertId])
      return res.status(201).json({ note })
    } catch (error) {
      console.error('Create wiki note error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
