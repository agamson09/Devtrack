export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionId, viewerId, text } = req.body

  if (!sessionId || !viewerId || text === undefined) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Validate the session exists
    const httpAgent = global.httpAgents?.get(sessionId)
    if (!httpAgent) {
      return res.status(404).json({ error: 'Agent session not found' })
    }

    // Forward clipboard to viewer
    const io = global.io
    if (!io) {
      return res.status(500).json({ error: 'Socket.IO not available' })
    }

    // Find viewer socket by userId
    const userId = parseInt(viewerId.replace('user-', ''))
    const viewerSockets = Array.from(io.sockets.sockets.values())
      .filter(s => s.userId === userId || s.handshake?.auth?.userId === userId)

    if (viewerSockets.length === 0) {
      return res.status(404).json({ error: 'Viewer not connected' })
    }

    viewerSockets.forEach(s => {
      s.emit('remote:clipboard', { text })
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[clipboard] Relay error:', error)
    return res.status(500).json({ error: 'Clipboard relay failed' })
  }
}
