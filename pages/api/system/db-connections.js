import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
import { encryptSecret, decryptSecret } from '@/lib/vaultCrypto'
import { createAdapter } from '@/lib/externalDb'

const VALID_TYPES = ['mysql', 'postgres', 'mssql']

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

  // GET -> list saved DB hosts (no secrets)
  if (req.method === 'GET') {
    try {
      const rows = await db.query(
        'SELECT id, name, type, host, port, username, created_at, updated_at FROM db_connections ORDER BY name ASC'
      )
      return res.status(200).json({ connections: rows })
    } catch (err) {
      console.error('List db connections error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    const { action } = req.body

    // --- connectivity test -------------------------------------------------
    if (action === 'test') {
      const { id, type, host, port, username, password } = req.body
      try {
        let cfg = { type, host, port, username, password }
        if (!password && id) {
          const row = await db.queryOne('SELECT * FROM db_connections WHERE id = ?', [id])
          if (!row) return res.status(404).json({ error: 'Connection not found' })
          cfg = {
            type: row.type || 'mysql',
            host: row.host,
            port: row.port,
            username: row.username,
            password: decryptSecret(row.password_enc),
          }
        }
        if (!cfg.host) return res.status(400).json({ error: 'Host is required' })
        const adapter = createAdapter(cfg)
        const result = await adapter.test()
        return res.status(200).json({ ok: true, message: result.message })
      } catch (err) {
        return res.status(400).json({ ok: false, message: err.message })
      }
    }

    // --- save ----------------------------------------------------------------
    const { id, name, type, host, port, username, password } = req.body
    if (!name || !host || !username) {
      return res.status(400).json({ error: 'Name, host, and username are required' })
    }
    const safeType = VALID_TYPES.includes(type) ? type : 'mysql'
    const safePort = parseInt(port) || (safeType === 'postgres' ? 5432 : safeType === 'mssql' ? 1433 : 3306)
    try {
      if (id) {
        const existing = await db.queryOne('SELECT id FROM db_connections WHERE id = ?', [id])
        if (!existing) return res.status(404).json({ error: 'Connection not found' })
        if (password) {
          await db.update(
            'UPDATE db_connections SET name = ?, type = ?, host = ?, port = ?, username = ?, password_enc = ? WHERE id = ?',
            [name.trim(), safeType, host, safePort, username, encryptSecret(password), id]
          )
        } else {
          await db.update(
            'UPDATE db_connections SET name = ?, type = ?, host = ?, port = ?, username = ? WHERE id = ?',
            [name.trim(), safeType, host, safePort, username, id]
          )
        }
        return res.status(200).json({ success: true, id: Number(id) })
      }

      if (!password) {
        return res.status(400).json({ error: 'Password is required for a new connection' })
      }
      const result = await db.insert(
        'INSERT INTO db_connections (name, type, host, port, username, password_enc) VALUES (?, ?, ?, ?, ?, ?)',
        [name.trim(), safeType, host, safePort, username, encryptSecret(password)]
      )
      return res.status(201).json({ success: true, id: result.insertId })
    } catch (err) {
      console.error('Save db connection error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  // DELETE /api/system/db-connections?id=N
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id is required' })
    try {
      await db.query('DELETE FROM db_connections WHERE id = ?', [id])
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
