export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionId, apiKey } = req.body

    // Validate agent API key only if provided (backward compatible)
    if (apiKey) {
      const agentApiKeys = global.agentApiKeys
      if (agentApiKeys) {
        const expectedKey = agentApiKeys.get(sessionId)
        if (!expectedKey || expectedKey !== apiKey) {
          return res.status(401).json({ error: 'Invalid agent credentials' })
        }
      }
    }
    const httpAgents = global.httpAgents

    if (!httpAgents) {
      return res.status(500).json({ error: 'Agent store not initialized' })
    }

    const agent = httpAgents.get(sessionId)
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    // Update heartbeat
    agent.lastHeartbeat = new Date().toISOString()
    agent.status = 'online'

    res.status(200).json({ success: true })
  } catch (error) {
    console.error('[remote] Heartbeat error:', error)
    res.status(500).json({ error: 'Heartbeat failed' })
  }
}
