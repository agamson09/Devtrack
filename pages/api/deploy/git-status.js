import { getAuthUser } from '@/lib/auth'
import { getStatus } from '@/lib/gitDeploy'
import db from '@/lib/db'

// GET /api/deploy/git-status?id=N
// Monitor a git deploy target: live commit vs remote, pending commits.
export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id is required' })

  try {
    const config = await db.queryOne('SELECT * FROM remote_deploy_configs WHERE id = ?', [id])
    if (!config) return res.status(404).json({ error: 'Deploy config not found' })
    if (!config.repo_url) return res.status(400).json({ error: 'This target has no Git repository configured' })

    const status = await getStatus(config)

    // Persist last seen remote state (cheap monitor cache)
    await db.query('UPDATE remote_deploy_configs SET last_commit = ? WHERE id = ?', [status.currentCommit, config.id]).catch(() => {})

    return res.status(200).json({ config: { id: config.id, name: config.name, repo_url: config.repo_url, branch: status.branch }, ...status })
  } catch (err) {
    console.error('git-status error:', err.message)
    return res.status(400).json({ error: err.message })
  }
}
