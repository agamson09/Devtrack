import { WebSocket } from 'ws'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionId, viewerId, frame, ts, size } = req.body
    const httpAgents = global.httpAgents

    if (!httpAgents) {
      return res.status(500).json({ error: 'Agent store not initialized' })
    }

    const agent = httpAgents.get(sessionId)
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    // Forward frame to viewer via Socket.IO if available
    if (global.io && viewerId) {
      try {
        // Emit to the specific viewer
        global.io.to(viewerId).emit('remote:frame', {
          frame,
          ts: ts || Date.now(),
          size: size || 0,
          sessionId
        })
      } catch (e) {
        // Viewer might not be connected via socket
      }
    }

    // Store latest frame in agent data
    agent.latestFrame = frame
    agent.lastFrameTime = ts || Date.now()

    res.status(200).json({ success: true })
  } catch (error) {
    console.error('[remote] Frame error:', error)
    res.status(500).json({ error: 'Frame processing failed' })
  }
}
