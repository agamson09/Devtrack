import { query } from '@/lib/db'
import crypto from 'crypto'

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function parseUserAgent(ua) {
  if (!ua) return 'Unknown Device'
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac OS/.test(ua)) return 'Mac'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown Device'
}

export async function createSession(userId, req, isRemembered = false) {
  const token = generateSessionToken()
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const userAgent = req.headers['user-agent'] || ''
  const device = parseUserAgent(userAgent)

  const expiryDays = isRemembered ? 30 : 1
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiryDays)

  await query(
    'INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, device_info, is_remembered, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, token, ip, userAgent, device, isRemembered ? 1 : 0, expiresAt]
  )

  await query(
    'INSERT INTO security_logs (user_id, event_type, description, ip_address, user_agent, severity) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, 'login', `Login from ${device}`, ip, userAgent, 'low']
  )

  return { token, expiresAt }
}

export async function validateSession(token) {
  if (!token) return null

  const sessions = await query(
    'SELECT s.*, u.id as uid, u.name, u.email, u.role, u.avatar FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.expires_at > NOW()',
    [token]
  )

  if (sessions.length === 0) return null

  const session = sessions[0]

  await query('UPDATE user_sessions SET last_activity = NOW() WHERE id = ?', [session.id])

  return {
    session,
    user: { id: session.uid, name: session.name, email: session.email, role: session.role, avatar: session.avatar }
  }
}

export async function destroySession(token) {
  if (!token) return

  const sessions = await query('SELECT * FROM user_sessions WHERE session_token = ?', [token])
  if (sessions.length > 0) {
    await query(
      'INSERT INTO security_logs (user_id, event_type, description, ip_address, severity) VALUES (?, ?, ?, ?, ?)',
      [sessions[0].user_id, 'logout', 'Session destroyed', sessions[0].ip_address, 'low']
    )
  }

  await query('DELETE FROM user_sessions WHERE session_token = ?', [token])
}

export async function destroyAllUserSessions(userId, exceptToken = null) {
  if (exceptToken) {
    await query('DELETE FROM user_sessions WHERE user_id = ? AND session_token != ?', [userId, exceptToken])
  } else {
    await query('DELETE FROM user_sessions WHERE user_id = ?', [userId])
  }
}

export async function getActiveSessions(userId = null) {
  let sql = `SELECT s.*, u.name, u.email, u.role FROM user_sessions s 
             JOIN users u ON s.user_id = u.id WHERE s.expires_at > NOW()`
  const params = []

  if (userId) {
    sql += ' AND s.user_id = ?'
    params.push(userId)
  }

  sql += ' ORDER BY s.last_activity DESC'
  return await query(sql, params)
}

export async function cleanupExpiredSessions() {
  const result = await query('DELETE FROM user_sessions WHERE expires_at < NOW()')
  const csrfResult = await query('DELETE FROM csrf_tokens WHERE expires_at < NOW()')
  return (result.affectedRows || 0) + (csrfResult.affectedRows || 0)
}

export async function logSecurityEvent(userId, eventType, description, req, severity = 'medium', metadata = null) {
  const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || 'unknown'
  const userAgent = req?.headers?.['user-agent'] || ''

  await query(
    'INSERT INTO security_logs (user_id, event_type, description, ip_address, user_agent, metadata, severity) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, eventType, description, ip, userAgent, metadata ? JSON.stringify(metadata) : null, severity]
  )
}

export async function createCSRFToken(userId = null) {
  const token = generateCSRFToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24)

  await query(
    'INSERT INTO csrf_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  )

  return token
}

export async function validateCSRFToken(token, userId = null) {
  if (!token) return false

  const tokens = await query(
    'SELECT * FROM csrf_tokens WHERE token = ? AND expires_at > NOW()',
    [token]
  )

  return tokens.length > 0
}
