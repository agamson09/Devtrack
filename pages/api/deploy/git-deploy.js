import { getAuthUser } from '@/lib/auth'
import { deployById, rollbackById } from '@/lib/gitDeploy'

// POST /api/deploy/git-deploy  { id, rollback_commit? }
// Runs the git deploy pipeline (or a rollback to a specific commit) on a
// saved target and persists history. Step progress is emitted via
// Socket.IO event "deploy:git-step".
export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id, rollback_commit: rollbackCommit } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id is required' })

  try {
    const onStep = (step) => {
      if (global.io) {
        global.io.emit('deploy:git-step', { configId: Number(id), step })
      }
    }

    const result = rollbackCommit
      ? await rollbackById(id, String(rollbackCommit), user.id, onStep)
      : await deployById(id, user.id, onStep)

    return res.status(200).json({
      success: true,
      message: rollbackCommit
        ? `Rolled back to ${String(rollbackCommit).slice(0, 7)} (live: ${result.commitAfter})`
        : `Deployed ${result.commitBefore || '?'} -> ${result.commitAfter || '?'}`,
      ...result,
    })
  } catch (err) {
    console.error('git-deploy error:', err.message)
    return res.status(400).json({
      error: err.message,
      steps: err.steps || [],
      commitBefore: err.commitBefore || null,
    })
  }
}
