import { query, queryOne } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import { createSession, createCSRFToken, logSecurityEvent } from '@/lib/session';
import { verifyState, exchangeCode, fetchProfile, PROVIDER_LABELS } from '@/lib/oauth';

const COOKIE_BASE = 'Path=/; HttpOnly; SameSite=Strict';
const MAX_AGE = 86400;

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function fail(res, code) {
  return res.redirect(302, `/login?error=${code}`);
}

// GET /api/auth/oauth/[provider]/callback — finish the OAuth flow:
// validate state -> exchange code -> find/link/create user -> session cookies.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider } = req.query;
  if (!['google', 'github', 'oidc'].includes(provider)) {
    return fail(res, 'sso_unknown');
  }

  const { code, state } = req.query;
  const cookies = parseCookies(req.headers.cookie);

  if (!code || !state || !cookies.oauth_state || !verifyState(provider, state) || cookies.oauth_state !== state) {
    return fail(res, 'sso_state');
  }

  let profile;
  try {
    const accessToken = await exchangeCode(provider, code);
    profile = await fetchProfile(provider, accessToken);
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    return fail(res, 'sso_failed');
  }

  if (!profile.email) return fail(res, 'sso_no_email');
  if (!profile.emailVerified) return fail(res, 'sso_email_unverified');

  try {
    const email = String(profile.email).toLowerCase().trim();

    // 1) Existing OAuth identity -> login
    const identity = await queryOne(
      'SELECT user_id FROM user_oauth_identities WHERE provider = ? AND provider_id = ?',
      [provider, profile.providerId]
    );

    let user;
    if (identity) {
      user = await queryOne('SELECT * FROM users WHERE id = ?', [identity.user_id]);
      if (!user) return fail(res, 'sso_failed');
    } else {
      // 2) Same verified email -> link identity to existing account
      const existing = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
      if (existing) {
        await query(
          'INSERT INTO user_oauth_identities (user_id, provider, provider_id) VALUES (?, ?, ?)',
          [existing.id, provider, profile.providerId]
        );
        await query('UPDATE users SET auth_provider = ?, avatar = COALESCE(avatar, ?) WHERE id = ?', [provider, profile.avatar, existing.id]);
        user = existing;
        await logSecurityEvent(existing.id, 'sso_account_linked', `OAuth identity linked: ${provider}`, req, 'low', { provider, email });
      } else {
        // 3) New account
        const result = await query(
          'INSERT INTO users (name, email, password, role, avatar, auth_provider, provider_id, tenant_id) VALUES (?, ?, NULL, ?, ?, ?, ?, 1)',
          [profile.name, email, 'member', profile.avatar, provider, profile.providerId]
        );
        user = await queryOne('SELECT * FROM users WHERE id = ?', [result.insertId]);
        await logSecurityEvent(user.id, 'sso_account_created', `Account created via ${provider} SSO`, req, 'low', { provider, email });
      }
    }

    // Mirror the local login flow (session + JWT + CSRF), then redirect.
    const session = await createSession(user.id, req, false);
    const jwtToken = generateToken({
      id: user.id,
      tenant_id: user.tenant_id ?? null,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    const csrfToken = await createCSRFToken(user.id);

    await logSecurityEvent(user.id, 'login_success', `SSO login via ${PROVIDER_LABELS[provider] || provider}`, req, 'low', {
      email: user.email,
      provider,
    });

    res.setHeader('Set-Cookie', [
      `devtrack_token=${jwtToken}; ${COOKIE_BASE}; Max-Age=${MAX_AGE}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      `devtrack_session=${session.token}; ${COOKIE_BASE}; Max-Age=${MAX_AGE}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      // Readable (not HttpOnly) so the client can pick it up after the redirect
      `devtrack_csrf=${csrfToken}; Path=/; SameSite=Strict; Max-Age=${MAX_AGE}`,
      // State cookie no longer needed
      `oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    ]);

    return res.redirect(302, '/dashboard');
  } catch (err) {
    console.error('OAuth session error:', err);
    return fail(res, 'sso_failed');
  }
}
