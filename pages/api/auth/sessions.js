import { getAuthUser } from '@/lib/auth'
import { getActiveSessions, destroySession, destroyAllUserSessions, cleanupExpiredSessions } from '@/lib/session'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'GET') {
    try {
      const sessions = user.role === 'admin'
        ? await getActiveSessions()
        : await getActiveSessions(user.id)

      return res.status(200).json({ sessions })
    } catch (err) {
      console.error('Sessions fetch error:', err)
      return res.status(500).json({ error: 'Failed to fetch sessions' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { session_id, all } = req.body
      const currentToken = req.cookies?.devtrack_session

      if (all) {
        await destroyAllUserSessions(user.id, currentToken)
        return res.status(200).json({ success: true, message: 'Other sessions terminated' })
      }

      if (session_id) {
        const { query } = await import('@/lib/db')
        const sessions = await query('SELECT * FROM user_sessions WHERE id = ?', [session_id])
        if (sessions.length === 0) return res.status(404).json({ error: 'Session not found' })

        if (user.role !== 'admin' && sessions[0].user_id !== user.id) {
          return res.status(403).json({ error: 'Forbidden' })
        }

        await destroySession(sessions[0].session_token)
        return res.status(200).json({ success: true })
      }

      return res.status(400).json({ error: 'session_id or all required' })
    } catch (err) {
      console.error('Session delete error:', err)
      return res.status(500).json({ error: 'Failed to delete session' })
    }
  }

  if (req.method === 'POST') {
    try {
      const cleaned = await cleanupExpiredSessions()
      return res.status(200).json({ success: true, cleaned })
    } catch (err) {
      console.error('Session cleanup error:', err)
      return res.status(500).json({ error: 'Failed to cleanup sessions' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
