export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionId } = req.body
    const httpAgents = global.httpAgents
    const pendingCommands = global.pendingCommands

    if (!httpAgents) {
      return res.status(500).json({ error: 'Agent store not initialized' })
    }

    // Remove agent
    httpAgents.delete(sessionId)
    if (pendingCommands) pendingCommands.delete(sessionId)

    console.log(`[remote] HTTP Agent unregistered: ${sessionId}`)

    res.status(200).json({ success: true })
  } catch (error) {
    console.error('[remote] Unregister error:', error)
    res.status(500).json({ error: 'Unregister failed' })
  }
}
