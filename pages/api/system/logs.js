import { getAuthUser } from '@/lib/auth'
import fs from 'fs'
import { safeExec } from '@/lib/safeExec'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { type = 'out', lines = 200, search } = req.query
    const logDir = '/root/.pm2/logs'

    let logFile
    if (type === 'error') {
      logFile = `${logDir}/devtrack-error.log`
    } else {
      logFile = `${logDir}/devtrack-out.log`
    }

    if (!fs.existsSync(logFile)) {
      return res.status(200).json({ logs: [], total: 0 })
    }

    let logs
    if (search) {
      const safeSearch = search.replace(/[^a-zA-Z0-9\s._-]/g, '')
      if (!safeSearch) {
        return res.status(400).json({ error: 'Invalid search term' })
      }
      const result = await safeExec('grep', ['-i', safeSearch, logFile], { timeout: 10000 })
      const lines_arr = result.stdout.split('\n').slice(-parseInt(lines) || -200)
      logs = lines_arr.filter(Boolean)
    } else {
      const result = await safeExec('tail', [`-${lines}`, logFile], { timeout: 10000 })
      logs = result.stdout ? result.stdout.split('\n') : []
    }

    const totalResult = await safeExec('wc', ['-l', logFile], { timeout: 5000 })

    return res.status(200).json({
      logs,
      total: parseInt(totalResult.stdout) || 0,
      file: logFile,
      type,
    })
  } catch (error) {
    console.error('Logs error:', error)
    return res.status(500).json({ error: 'Failed to read logs' })
  }
}
