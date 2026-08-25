import { isProviderEnabled, getAuthorizationUrl, signState } from '@/lib/oauth';

// GET /api/auth/oauth/[provider] — start the OAuth flow.
// Sets a signed, short-lived state cookie then redirects to the provider.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider } = req.query;
  if (!['google', 'github', 'oidc'].includes(provider)) {
    return res.status(400).json({ error: 'Unknown provider' });
  }
  if (!isProviderEnabled(provider)) {
    return res.redirect(302, '/login?error=sso_not_configured');
  }

  try {
    const state = signState(provider);
    res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
    const url = await getAuthorizationUrl(provider, state);
    return res.redirect(302, url);
  } catch (err) {
    console.error('OAuth start error:', err.message);
    return res.redirect(302, '/login?error=sso_config');
  }
}
