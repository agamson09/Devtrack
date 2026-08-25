import { getVAPIDPublicKey } from '@/lib/push'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const publicKey = getVAPIDPublicKey()
  if (!publicKey) {
    return res.status(500).json({ error: 'Push notifications not configured' })
  }

  return res.status(200).json({ publicKey })
}
