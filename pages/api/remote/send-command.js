import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  try {
    const { sessionId, command } = req.body
    const httpAgents = global.httpAgents
    const pendingCommands = global.pendingCommands

    if (!httpAgents || !pendingCommands) {
      return res.status(500).json({ error: 'Agent store not initialized' })
    }

    const agent = httpAgents.get(sessionId)
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    // Add command to pending queue
    const commands = pendingCommands.get(sessionId) || []
    commands.push(command)
    pendingCommands.set(sessionId, commands)

    res.status(200).json({ success: true, queued: commands.length })
  } catch (error) {
    console.error('[remote] Send command error:', error)
    res.status(500).json({ error: 'Failed to send command' })
  }
}
