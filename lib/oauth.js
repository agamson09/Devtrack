// OAuth2 / OIDC provider integrations — Google, GitHub, and any generic
// OIDC issuer (Azure AD, Keycloak, Authentik, ...). Zero new dependencies:
// uses global fetch + existing jsonwebtoken for state signing.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const PROVIDER_LABELS = { google: 'Google', github: 'GitHub', oidc: 'SSO' };
const VALID_PROVIDERS = ['google', 'github', 'oidc'];

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function callbackUrl(provider) {
  return `${appUrl()}/api/auth/oauth/${provider}/callback`;
}

function getEnabledProviders() {
  const enabled = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) enabled.push('google');
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) enabled.push('github');
  if (process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET) enabled.push('oidc');
  return enabled;
}

function isProviderEnabled(provider) {
  return getEnabledProviders().includes(provider);
}

// ---- OIDC discovery (cached 1 hour) ---------------------------------------
let oidcCache = null;
async function getOidcConfig() {
  const issuer = (process.env.OIDC_ISSUER || '').replace(/\/$/, '');
  if (oidcCache && oidcCache.issuer === issuer && Date.now() - oidcCache.at < 3600e3) {
    return oidcCache.data;
  }
  const res = await fetch(issuer + '/.well-known/openid-configuration');
  if (!res.ok) throw new Error(`OIDC discovery failed (HTTP ${res.status})`);
  const data = await res.json();
  oidcCache = { issuer, at: Date.now(), data };
  return data;
}

// ---- Authorization URL ------------------------------------------------------
async function getAuthorizationUrl(provider, state) {
  const redirectUri = callbackUrl(provider);
  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
  }
  if (provider === 'github') {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read:user user:email',
      state,
    });
    return 'https://github.com/login/oauth/authorize?' + params;
  }
  if (provider === 'oidc') {
    const cfg = await getOidcConfig();
    const params = new URLSearchParams({
      client_id: process.env.OIDC_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: process.env.OIDC_SCOPE || 'openid email profile',
      state,
    });
    return cfg.authorization_endpoint + '?' + params;
  }
  throw new Error('Unknown provider: ' + provider);
}

// ---- Code -> access token ----------------------------------------------------
async function exchangeCode(provider, code) {
  const redirectUri = callbackUrl(provider);
  let tokenUrl;
  const body = { code, redirect_uri: redirectUri, grant_type: 'authorization_code' };
  if (provider === 'google') {
    tokenUrl = 'https://oauth2.googleapis.com/token';
    body.client_id = process.env.GOOGLE_CLIENT_ID;
    body.client_secret = process.env.GOOGLE_CLIENT_SECRET;
  } else if (provider === 'github') {
    tokenUrl = 'https://github.com/login/oauth/access_token';
    body.client_id = process.env.GITHUB_CLIENT_ID;
    body.client_secret = process.env.GITHUB_CLIENT_SECRET;
  } else if (provider === 'oidc') {
    const cfg = await getOidcConfig();
    tokenUrl = cfg.token_endpoint;
    body.client_id = process.env.OIDC_CLIENT_ID;
    body.client_secret = process.env.OIDC_CLIENT_SECRET;
  } else {
    throw new Error('Unknown provider: ' + provider);
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error('Token exchange failed: ' + (data.error_description || data.error || `HTTP ${res.status}`));
  }
  return data.access_token;
}

// ---- Access token -> normalized profile --------------------------------------
async function fetchProfile(provider, accessToken) {
  if (provider === 'google') {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (!res.ok) throw new Error('Failed to fetch Google profile (HTTP ' + res.status + ')');
    const p = await res.json();
    return {
      providerId: String(p.sub),
      email: p.email,
      emailVerified: p.email_verified === true,
      name: p.name || p.email,
      avatar: p.picture || null,
    };
  }

  if (provider === 'github') {
    const headers = { Authorization: 'Bearer ' + accessToken, Accept: 'application/vnd.github+json', 'User-Agent': 'DevTrack-SSO' };
    const res = await fetch('https://api.github.com/user', { headers });
    if (!res.ok) throw new Error('Failed to fetch GitHub profile (HTTP ' + res.status + ')');
    const p = await res.json();
    let email = p.email || null;
    let emailVerified = false;
    try {
      const resE = await fetch('https://api.github.com/user/emails', { headers });
      if (resE.ok) {
        const emails = await resE.json();
        const primary = emails.find((e) => e.primary) || emails.find((e) => e.verified) || emails[0];
        if (primary) { email = primary.email; emailVerified = primary.verified; }
      }
    } catch {}
    return {
      providerId: String(p.id),
      email,
      emailVerified,
      name: p.name || p.login,
      avatar: p.avatar_url || null,
    };
  }

  if (provider === 'oidc') {
    const cfg = await getOidcConfig();
    const res = await fetch(cfg.userinfo_endpoint, { headers: { Authorization: 'Bearer ' + accessToken } });
    if (!res.ok) throw new Error('Failed to fetch OIDC profile (HTTP ' + res.status + ')');
    const p = await res.json();
    return {
      providerId: String(p.sub),
      email: p.email || null,
      emailVerified: p.email_verified !== false && p.email != null,
      name: p.name || p.preferred_username || p.email,
      avatar: p.picture || null,
    };
  }

  throw new Error('Unknown provider: ' + provider);
}

// ---- CSRF state (signed JWT, 10 minutes) --------------------------------------
function signState(provider) {
  return jwt.sign(
    { provider, nonce: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

function verifyState(provider, state) {
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    return decoded.provider === provider;
  } catch {
    return false;
  }
}

module.exports = {
  PROVIDER_LABELS,
  VALID_PROVIDERS,
  getEnabledProviders,
  isProviderEnabled,
  getAuthorizationUrl,
  exchangeCode,
  fetchProfile,
  signState,
  verifyState,
};
