import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'GET') {
    try {
      const sessions = global.remoteSessions ? Array.from(global.remoteSessions.entries()).map(([viewerId, s]) => ({
        viewerId,
        deviceId: s.deviceId,
        deviceName: s.deviceName,
        userId: s.userId,
        userName: s.userName,
        startTime: s.startTime,
        recording: s.recording,
        fileSize: s.fileSize || 0
      })) : []

      return res.status(200).json({ sessions })
    } catch (error) {
      console.error('Sessions API error:', error)
      return res.status(500).json({ error: 'Failed to fetch sessions' })
    }
  }

  if (req.method === 'POST') {
    const { action, deviceId, deviceName, recording } = req.body

    if (action === 'start') {
      // Log to database
      try {
        const { query } = require('@/lib/db')
        await query(
          'INSERT INTO activity_logs (user_id, action, target_type, details) VALUES (?, ?, ?, ?)',
          [user.id, 'remote_start', 'remote', JSON.stringify({ message: `Started remote session to ${deviceName}` })]
        )
      } catch (err) {
        console.error('Activity log error:', err)
      }

      return res.status(200).json({ success: true })
    }

    if (action === 'stop') {
      // Find session by userId from global.remoteSessions (stored by socket.id)
      if (global.remoteSessions) {
        for (const [viewerId, session] of global.remoteSessions.entries()) {
          if (session.userId === user.id) {
            try {
              const { query } = require('@/lib/db')
              await query(
              'INSERT INTO activity_logs (user_id, action, target_type, details) VALUES (?, ?, ?, ?)',
              [user.id, 'remote_stop', 'remote', JSON.stringify({ message: `Ended remote session to ${session.deviceName}`, duration: Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000) })]
              )
            } catch (err) {
              console.error('Activity log error:', err)
            }
            break
          }
        }
      }
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Invalid action' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
