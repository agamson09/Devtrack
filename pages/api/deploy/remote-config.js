import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'
const { tenantQuery, tenantQueryOne, tenantInsert, tenantUpdate, tenantRemove } = db
import { getTenantFromRequest } from '@/lib/tenant'
import { encryptSecret, decryptSecret } from '@/lib/vaultCrypto'

const GIT_FIELDS = ['repo_url', 'branch', 'install_cmd', 'build_cmd', 'restart_cmd']

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  const tenantId = await getTenantFromRequest(req)

  // GET /api/deploy/remote-config          -> list all targets (no secrets)
  if (req.method === 'GET' && !req.query.id) {
    try {
      const rows = await tenantQuery(tenantId,
        `SELECT id, name, host, port, username, project_path, repo_url, branch,
                install_cmd, build_cmd, restart_cmd, auto_deploy,
                last_commit, last_deployed_at, last_connected, created_at, updated_at
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

    // --- SSH + git connectivity test ---------------------------------------
    if (action === 'test') {
      const { id, host, port, username, password, project_path } = req.body
      try {
        let testPassword = password
        if (!testPassword && id) {
          const row = await tenantQueryOne(tenantId, 'SELECT password_enc FROM remote_deploy_configs WHERE id = ?', [id])
          if (!row) return res.status(404).json({ error: 'Config not found' })
          testPassword = decryptSecret(row.password_enc)
        }
        const target = id
          ? await tenantQueryOne(tenantId, 'SELECT host, port, username FROM remote_deploy_configs WHERE id = ?', [id])
          : { host, port, username }
        if (!target?.host) return res.status(400).json({ error: 'Host is required' })

        const { Client } = require('ssh2')
        const conn = new Client()
        const result = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve({ ok: false, message: 'Timeout after 10s' }), 10000)
          let out = ''
          conn.on('ready', () => {
            conn.exec('git --version', (err, stream) => {
              if (err) { clearTimeout(timer); conn.end(); return resolve({ ok: true, message: 'SSH OK (git check skipped)' }) }
              stream.on('data', (d) => { out += d.toString() })
              stream.on('close', () => {
                clearTimeout(timer)
                conn.end()
                const gitOk = /git version/.test(out)
                resolve({
                  ok: true,
                  message: gitOk ? `SSH OK — ${out.trim()}` : 'SSH OK — WARNING: git not found on server',
                })
              })
            })
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
    const { id, name, host, port, username, password, project_path, repo_url, repo_token, branch, install_cmd, build_cmd, restart_cmd, auto_deploy } = req.body
    if (!host || !username) {
      return res.status(400).json({ error: 'Host and username are required' })
    }
    const safeBranch = (branch || 'main').replace(/[^a-zA-Z0-9._\-\/]/g, '') || 'main'
    const tokenEnc = repo_token ? encryptSecret(repo_token) : null
    const auto = auto_deploy === true || auto_deploy === 1 ? 1 : 0

    try {
      if (id) {
        const existing = await tenantQueryOne(tenantId, 'SELECT id FROM remote_deploy_configs WHERE id = ?', [id])
        if (!existing) return res.status(404).json({ error: 'Config not found' })

        if (password) {
          await tenantUpdate(tenantId,
            `UPDATE remote_deploy_configs SET name = ?, host = ?, port = ?, username = ?, password_enc = ?, project_path = ?,
             repo_url = ?, branch = ?, install_cmd = ?, build_cmd = ?, restart_cmd = ?, auto_deploy = ?${tokenEnc ? ', repo_token = ?' : ''} WHERE id = ?`,
            tokenEnc
              ? [name || host, host, parseInt(port) || 22, username, encryptSecret(password), project_path || null, repo_url || null, safeBranch, install_cmd || null, build_cmd || null, restart_cmd || null, auto, tokenEnc, id]
              : [name || host, host, parseInt(port) || 22, username, encryptSecret(password), project_path || null, repo_url || null, safeBranch, install_cmd || null, build_cmd || null, restart_cmd || null, auto, id]
          )
        } else {
          await tenantUpdate(tenantId,
            `UPDATE remote_deploy_configs SET name = ?, host = ?, port = ?, username = ?, project_path = ?,
             repo_url = ?, branch = ?, install_cmd = ?, build_cmd = ?, restart_cmd = ?, auto_deploy = ?${tokenEnc ? ', repo_token = ?' : ''} WHERE id = ?`,
            tokenEnc
              ? [name || host, host, parseInt(port) || 22, username, project_path || null, repo_url || null, safeBranch, install_cmd || null, build_cmd || null, restart_cmd || null, auto, tokenEnc, id]
              : [name || host, host, parseInt(port) || 22, username, project_path || null, repo_url || null, safeBranch, install_cmd || null, build_cmd || null, restart_cmd || null, auto, id]
          )
        }
        return res.status(200).json({ success: true, id: Number(id) })
      }

      if (!password) {
        return res.status(400).json({ error: 'Password is required for a new server' })
      }
      const result = await tenantInsert(tenantId,
        `INSERT INTO remote_deploy_configs (name, host, port, username, password_enc, project_path, repo_url, repo_token, branch, install_cmd, build_cmd, restart_cmd, auto_deploy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name || host, host, parseInt(port) || 22, username, encryptSecret(password), project_path || null, repo_url || null, tokenEnc, safeBranch, install_cmd || null, build_cmd || null, restart_cmd || null, auto]
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
      await tenantQuery(tenantId, 'DELETE FROM remote_deploy_configs WHERE id = ?', [id])
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
