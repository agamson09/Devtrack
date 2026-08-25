import { getEnabledProviders } from '@/lib/oauth';

// GET /api/auth/oauth/providers — which SSO providers are configured.
// Public: only returns provider names, no secrets.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({ providers: getEnabledProviders() });
}
