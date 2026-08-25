import { getAuthUser } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const RECORDINGS_DIR = '/var/www/devtrack/recordings'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'GET') {
    try {
      if (!fs.existsSync(RECORDINGS_DIR)) {
        return res.status(200).json({ recordings: [] })
      }

      const dirs = fs.readdirSync(RECORDINGS_DIR).filter(d => d.startsWith('session-'))
      const recordings = dirs.map(dir => {
        const metaPath = path.join(RECORDINGS_DIR, dir, 'meta.json')
        let meta = {}
        try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}
        const framesDir = path.join(RECORDINGS_DIR, dir, 'frames')
        let frameCount = 0
        try { frameCount = fs.readdirSync(framesDir).length } catch {}
        return { ...meta, dirName: dir, frameCount }
      }).sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0))

      return res.status(200).json({ recordings })
    } catch (error) {
      console.error('Recordings API error:', error)
      return res.status(500).json({ error: 'Failed to fetch recordings' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
