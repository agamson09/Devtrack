import db from '@/lib/db'

const pool = db.pool

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionId, viewerId, approved } = req.body

  if (!sessionId || !viewerId) {
    return res.status(400).json({ error: 'sessionId and viewerId are required' })
  }

  try {
    // Find the agent session
    const httpAgent = global.httpAgents?.get(sessionId)
    if (!httpAgent) {
      return res.status(404).json({ error: 'Agent session not found' })
    }

    // Find the viewer's socket
    const io = global.io
    if (!io) {
      return res.status(500).json({ error: 'Socket.IO not available' })
    }

    // Find viewer socket by userId (viewerId format: "user-{id}")
    const userId = parseInt(viewerId.replace('user-', ''))
    const viewerSockets = Array.from(io.sockets.sockets.values())
      .filter(s => s.userId === userId || s.handshake?.auth?.userId === userId)

    if (viewerSockets.length === 0) {
      return res.status(404).json({ error: 'Viewer not connected' })
    }

    if (approved) {
      // Queue start command
      const commands = global.pendingCommands?.get(sessionId) || []
      commands.push({ type: 'start', viewerId })
      global.pendingCommands?.set(sessionId, commands)

      // Create session
      if (global.remoteSessions) {
        global.remoteSessions.set(viewerId, {
          deviceId: sessionId,
          deviceName: httpAgent.name,
          userId: userId,
          startTime: new Date().toISOString(),
          recording: false,
          type: 'http',
          pairingMode: 'approval'
        })
      }

      // Notify viewer
      viewerSockets.forEach(s => {
        s.emit('remote:paired', {
          success: true,
          mode: 'approval',
          device: {
            deviceId: httpAgent.deviceId,
            name: httpAgent.name,
            sessionId: sessionId
          }
        })
      })

      console.log(`[approve] Connection approved for viewer ${viewerId} to ${httpAgent.name}`)
    } else {
      // Notify viewer of rejection
      viewerSockets.forEach(s => {
        s.emit('remote:pair-error', {
          error: 'Connection rejected by remote user'
        })
      })

      console.log(`[approve] Connection rejected for viewer ${viewerId} to ${httpAgent.name}`)
    }

    return res.status(200).json({ success: true, approved })
  } catch (error) {
    console.error('[approve] Error:', error)
    return res.status(500).json({ error: 'Approval processing failed' })
  }
}
