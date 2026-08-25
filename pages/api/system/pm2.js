import { getAuthUser } from '@/lib/auth'
import { execSync } from 'child_process'

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const result = execSync(
      `pm2 jlist 2>/dev/null || echo "[]"`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim()

    const processes = JSON.parse(result)
    const apps = processes.map(p => ({
      name: p.name,
      pid: p.pid,
      status: p.pm2_env?.status || 'unknown',
      cpu: p.monit?.cpu || 0,
      memory: p.monit?.memory || 0,
      uptime: p.pm2_env?.pm_uptime || 0,
      restarts: p.pm2_env?.restart_time || 0,
      namespace: p.pm2_env?.namespace || 'default',
    }))

    return res.status(200).json({ processes: apps })
  } catch (error) {
    console.error('PM2 status error:', error)
    return res.status(500).json({ error: 'Failed to get PM2 status' })
  }
}
