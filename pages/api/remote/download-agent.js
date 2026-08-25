import { createReadStream, existsSync } from 'fs'
import { join } from 'path'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const agentPath = join(process.cwd(), 'agent', 'devtrack-agent', 'DevTrackAgent.exe')

    if (!existsSync(agentPath)) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', 'attachment; filename="DevTrackAgent.exe"')

    const stream = createReadStream(agentPath)
    stream.pipe(res)
  } catch (error) {
    console.error('[download] Error:', error)
    res.status(500).json({ error: 'Download failed' })
  }
}
