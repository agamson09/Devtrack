import { getAuthUser } from '@/lib/auth'
import { deployById } from '@/lib/gitDeploy'

// POST /api/deploy/git-deploy  { id }
// Runs the git deploy pipeline on a saved target and persists history.
// Step progress is emitted via Socket.IO event "deploy:git-step".
export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id is required' })

  try {
    const result = await deployById(id, user.id, (step) => {
      if (global.io) {
        global.io.emit('deploy:git-step', { configId: Number(id), step })
      }
    })

    return res.status(200).json({
      success: true,
      message: `Deployed ${result.commitBefore || '?'} -> ${result.commitAfter || '?'}`,
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
