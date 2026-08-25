export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionId, apiKey } = req.query
    const httpAgents = global.httpAgents
    const pendingCommands = global.pendingCommands

    if (!httpAgents || !pendingCommands) {
      return res.status(500).json({ error: 'Agent store not initialized' })
    }

    const agent = httpAgents.get(sessionId)
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    // Validate agent API key if provided (backward compatible)
    if (apiKey) {
      const agentApiKeys = global.agentApiKeys
      if (agentApiKeys) {
        const expectedKey = agentApiKeys.get(sessionId)
        if (expectedKey && expectedKey !== apiKey) {
          return res.status(401).json({ error: 'Invalid agent credentials' })
        }
      }
    }

    // Get and clear pending commands
    const commands = pendingCommands.get(sessionId) || []
    pendingCommands.set(sessionId, [])

    res.status(200).json(commands)
  } catch (error) {
    console.error('[remote] Commands error:', error)
    res.status(200).json([])
  }
}
