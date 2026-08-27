import bcrypt from 'bcryptjs'
import { queryOne, query } from '@/lib/db'
import { generateToken } from '@/lib/auth'
import { createSession, createCSRFToken, logSecurityEvent } from '@/lib/session'
import { loginRateLimit } from '@/lib/rateLimit'
import { notifyLoginNewDevice, notifyBruteForceAttempt } from '@/lib/notifications'
import * as otplib from 'otplib'

// Whitelist of safe user fields for login responses (must include avatar
// customization so the UI renders the saved avatar immediately after login).
function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    avatar_style: user.avatar_style,
    avatar_seed: user.avatar_seed,
    avatar_options: user.avatar_options,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const blocked = await loginRateLimit(req, res)
  if (blocked) return

  const { email, password, rememberMe, twoFactorToken, pendingTwoFactor } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'

  try {
    const recentAttempts = await query(
      'SELECT COUNT(*) as cnt FROM login_attempts WHERE email = ? AND ip_address = ? AND success = 0 AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)',
      [email, ip]
    )

    if (recentAttempts[0]?.cnt >= 10) {
      await logSecurityEvent(null, 'brute_force_blocked', `Brute force attempt blocked for ${email}`, req, 'high',
        { email, ip, attempts: recentAttempts[0].cnt })

      try {
        await notifyBruteForceAttempt(ip, recentAttempts[0].cnt)
      } catch (e) { console.error('Brute force notification error:', e) }

      return res.status(429).json({ error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.' })
    }

    const user = await queryOne('SELECT * FROM users WHERE email = ?', [email])

    if (!user) {
      await query('INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, 0)', [email, ip])
      await logSecurityEvent(null, 'login_failed', `Failed login for non-existent user: ${email}`, req, 'medium', { email })
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    if (user.is_approved === 0) {
      await logSecurityEvent(user.id, 'login_failed', `Unapproved user attempted login: ${email}`, req, 'low', { email });
      return res.status(403).json({ error: 'Account pending admin approval. Please wait for an administrator to approve your registration.' });
    }

    // SSO-only account (no local password set)
    if (!user.password) {
      const providerLabel = { google: 'Google', github: 'GitHub', oidc: 'SSO' }[user.auth_provider] || 'SSO'
      await logSecurityEvent(user.id, 'login_failed', `Password login attempted on SSO account (${user.auth_provider})`, req, 'low', { email })
      return res.status(401).json({ error: `Akun ini menggunakan login ${providerLabel}. Silakan masuk lewat tombol ${providerLabel} di bawah.` })
    }

    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
      await query('INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, 0)', [email, ip])
      await logSecurityEvent(user.id, 'login_failed', `Failed login attempt`, req, 'medium', { email })
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // 2FA: If user has 2FA enabled and this is not a 2FA verification step
    if (user.two_factor_enabled && !pendingTwoFactor) {
      const tempToken = generateToken({ id: user.id, name: user.name, email: user.email, role: user.role, twoFactorPending: true }, '10m')
      return res.status(200).json({
        requiresTwoFactor: true,
        tempToken,
        user: sanitizeUser(user),
      })
    }

    // 2FA: If pending two-factor, verify the TOTP token
    if (pendingTwoFactor) {
      if (!twoFactorToken) {
        return res.status(400).json({ error: '2FA token is required' })
      }

      const userData = await queryOne('SELECT two_factor_secret FROM users WHERE id = ?', [user.id])
      if (!userData?.two_factor_secret) {
        return res.status(400).json({ error: '2FA is not configured' })
      }

      const result = otplib.verifySync({ token: twoFactorToken.trim(), secret: userData.two_factor_secret })
      const isValid = result && result.valid
      if (!isValid) {
        await logSecurityEvent(user.id, 'login_2fa_failed', 'Failed 2FA verification', req, 'medium', { email })
        return res.status(401).json({ error: 'Invalid 2FA token' })
      }
    }

    await query('INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, 1)', [email, ip])

    const isRemembered = rememberMe === true || rememberMe === 'true'
    const session = await createSession(user.id, req, isRemembered)
    // Minimal JWT payload — NEVER embed the full user row (it would leak the
    // password hash and other sensitive columns into the readable token body).
    const jwtToken = generateToken({
      id: user.id,
      tenant_id: user.tenant_id ?? null,
      name: user.name,
      email: user.email,
      role: user.role,
    })

    await logSecurityEvent(user.id, 'login_success', `Login successful from ${session.deviceInfo || 'unknown device'}`, req, 'low',
      { email: user.email, device: session.deviceInfo, rememberMe: isRemembered })

    try {
      const recentSessions = await query(
        'SELECT COUNT(*) as cnt FROM user_sessions WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)',
        [user.id]
      )
      if (recentSessions[0]?.cnt <= 1) {
        await notifyLoginNewDevice(user.id, { ip, browser: session.deviceInfo })
      }
    } catch (e) { console.error('Login notification error:', e) }

    res.setHeader('Set-Cookie', [
      `devtrack_token=${jwtToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${isRemembered ? 2592000 : 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      `devtrack_session=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${isRemembered ? 2592000 : 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    ])

    const csrfToken = await createCSRFToken(user.id)

    return res.status(200).json({
      user: sanitizeUser(user),
      token: jwtToken,
      csrfToken,
      session: { token: session.token, expiresAt: session.expiresAt }
    })
  } catch (error) {
    console.error('Login error:', error)
    try {
      await logSecurityEvent(null, 'login_error', `Login error: ${error.message}`, req, 'high')
    } catch (e) {}
    return res.status(500).json({ error: 'Internal server error' })
  }
}
