import { validateCSRFToken } from '@/lib/session'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function requireCSRF(req, res) {
  if (SAFE_METHODS.has(req.method)) return true

  const token = req.headers['x-csrf-token'] || req.cookies?.devtrack_csrf
  if (!token) {
    res.status(403).json({ error: 'CSRF token missing' })
    return false
  }

  const user = req.authUser || null
  const valid = await validateCSRFToken(token, user?.id)
  if (!valid) {
    res.status(403).json({ error: 'Invalid or expired CSRF token' })
    return false
  }

  return true
}
