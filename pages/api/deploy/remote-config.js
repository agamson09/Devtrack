import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
import { encryptSecret, decryptSecret } from '@/lib/vaultCrypto'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  // GET /api/deploy/remote-config          -> list all targets (no secrets)
  if (req.method === 'GET' && !req.query.id) {
    try {
      const rows = await db.query(
        `SELECT id, name, host, port, username, project_path, last_connected, created_at, updated_at
         FROM remote_deploy_configs ORDER BY name ASC`
      )
      return res.status(200).json({ configs: rows })
    } catch (err) {
      console.error('List deploy configs error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  // POST /api/deploy/remote-config         -> create / update / test
  if (req.method === 'POST') {
    const { action } = req.body

    // --- SSH connectivity test -------------------------------------------
    if (action === 'test') {
      const { id, host, port, username, password, project_path } = req.body
      try {
        let testPassword = password
        if (!testPassword && id) {
          const row = await db.queryOne('SELECT password_enc FROM remote_deploy_configs WHERE id = ?', [id])
          if (!row) return res.status(404).json({ error: 'Config not found' })
          testPassword = decryptSecret(row.password_enc)
        }
        const target = id
          ? await db.queryOne('SELECT host, port, username FROM remote_deploy_configs WHERE id = ?', [id])
          : { host, port, username }
        if (!target?.host) return res.status(400).json({ error: 'Host is required' })

        const { Client } = require('ssh2')
        const conn = new Client()
        const result = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve({ ok: false, message: 'Timeout after 10s' }), 10000)
          conn.on('ready', () => {
            clearTimeout(timer)
            conn.end()
            resolve({ ok: true, message: 'SSH connection OK' })
          }).on('error', (err) => {
            clearTimeout(timer)
            resolve({ ok: false, message: err.message })
          }).connect({
            host: target.host,
            port: parseInt(target.port) || 22,
            username: target.username,
            password: testPassword,
            readyTimeout: 10000,
          })
        })
        return res.status(result.ok ? 200 : 400).json(result)
      } catch (err) {
        console.error('Deploy config test error:', err)
        return res.status(500).json({ error: err.message })
      }
    }

    // --- save (create or update) ------------------------------------------
    const { id, name, host, port, username, password, project_path } = req.body
    if (!host || !username) {
      return res.status(400).json({ error: 'Host and username are required' })
    }
    try {
      if (id) {
        const existing = await db.queryOne('SELECT id FROM remote_deploy_configs WHERE id = ?', [id])
        if (!existing) return res.status(404).json({ error: 'Config not found' })

        if (password) {
          await db.update(
            'UPDATE remote_deploy_configs SET name = ?, host = ?, port = ?, username = ?, password_enc = ?, project_path = ? WHERE id = ?',
            [name || host, host, parseInt(port) || 22, username, encryptSecret(password), project_path || '/var/www/devtrack', id]
          )
        } else {
          await db.update(
            'UPDATE remote_deploy_configs SET name = ?, host = ?, port = ?, username = ?, project_path = ? WHERE id = ?',
            [name || host, host, parseInt(port) || 22, username, project_path || '/var/www/devtrack', id]
          )
        }
        return res.status(200).json({ success: true, id: Number(id) })
      }

      if (!password) {
        return res.status(400).json({ error: 'Password is required for a new server' })
      }
      const result = await db.insert(
        'INSERT INTO remote_deploy_configs (name, host, port, username, password_enc, project_path) VALUES (?, ?, ?, ?, ?, ?)',
        [name || host, host, parseInt(port) || 22, username, encryptSecret(password), project_path || '/var/www/devtrack']
      )
      return res.status(201).json({ success: true, id: result.insertId })
    } catch (err) {
      console.error('Save deploy config error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  // DELETE /api/deploy/remote-config?id=N  -> remove a target
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id is required' })
    try {
      await db.query('DELETE FROM remote_deploy_configs WHERE id = ?', [id])
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
