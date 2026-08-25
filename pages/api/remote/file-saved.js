export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionId, filename, size, path } = req.body

  if (!sessionId || !filename) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Validate the session exists
    const httpAgent = global.httpAgents?.get(sessionId)
    if (!httpAgent) {
      return res.status(404).json({ error: 'Agent session not found' })
    }

    console.log(`[file] Agent saved: ${filename} (${size} bytes) at ${path}`)

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[file] Save notification error:', error)
    return res.status(500).json({ error: 'Notification failed' })
  }
}
