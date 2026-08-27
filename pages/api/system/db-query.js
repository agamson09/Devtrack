import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
import { decryptSecret } from '@/lib/vaultCrypto'

const MAX_ROWS = 1000

/**
 * POST /api/system/db-query
 * Admin-only. Runs a single SQL statement against:
 *  - connection_id "local"  -> the DevTrack app pool
 *  - connection_id <number> -> a saved db_connections host (on-demand mysql2 connection)
 */
export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.id !== 1) return res.status(403).json({ error: 'System Admin access required' })

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { connection_id: connectionId, database, sql } = req.body || {}
  if (!sql || !String(sql).trim()) {
    return res.status(400).json({ error: 'SQL is required' })
  }
  if (String(sql).trim().includes(';') && String(sql).trim().split(';').filter(s => s.trim()).length > 1) {
    return res.status(400).json({ error: 'Only a single statement is allowed per run' })
  }

  const started = Date.now()

  try {
    // ---- Local app database -------------------------------------------------
    if (!connectionId || connectionId === 'local') {
      const rows = await db.query(String(sql))
      return res.status(200).json({
        columns: rows.length ? Object.keys(rows[0]) : [],
        rows: rows.slice(0, MAX_ROWS),
        total_rows: rows.length,
        truncated: rows.length > MAX_ROWS,
        duration_ms: Date.now() - started,
        target: 'local',
      })
    }

    // ---- Saved remote host ---------------------------------------------------
    const row = await db.queryOne('SELECT * FROM db_connections WHERE id = ?', [connectionId])
    if (!row) return res.status(404).json({ error: 'Connection not found' })
    const password = decryptSecret(row.password_enc)

    const mysql = require('mysql2/promise')
    const conn = await mysql.createConnection({
      host: row.host,
      port: parseInt(row.port) || 3306,
      user: row.username,
      password,
      database: database || undefined,
      connectTimeout: 8000,
    })

    try {
      const [result] = await conn.query(String(sql))

      // Non-SELECT statements return a ResultSetHeader instead of rows
      if (!Array.isArray(result)) {
        return res.status(200).json({
          columns: [],
          rows: [],
          affected: result.affectedRows ?? null,
          info: result.info || `${result.affectedRows ?? 0} row(s) affected`,
          duration_ms: Date.now() - started,
          target: row.name,
        })
      }

      const columns = result.length ? Object.keys(result[0]) : []
      return res.status(200).json({
        columns,
        rows: result.slice(0, MAX_ROWS),
        total_rows: result.length,
        truncated: result.length > MAX_ROWS,
        duration_ms: Date.now() - started,
        target: row.name,
      })
    } finally {
      await conn.end().catch(() => {})
    }
  } catch (err) {
    console.error('db-query error:', err.message)
    return res.status(400).json({ error: err.message })
  }
}
