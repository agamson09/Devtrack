import { getAuthUser } from '@/lib/auth'
import db from '@/lib/db'

const pool = db.pool

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  try {
    // Get all known devices from database
    const [rows] = await pool.execute(
      'SELECT device_id, name, os, os_version, hostname, ip, last_seen, created_at FROM remote_devices ORDER BY last_seen DESC'
    )

    // Check which ones are currently online
    const devices = rows.map(device => {
      const httpAgent = global.httpAgents
        ? Array.from(global.httpAgents.values()).find(a => a.deviceId === device.device_id)
        : null

      const wsAgent = global.remoteAgents
        ? Array.from(global.remoteAgents.values()).find(a => a.name === device.name)
        : null

      const isOnline = !!(httpAgent || wsAgent)
      const lastSeen = httpAgent?.lastHeartbeat || wsAgent?.connectedAt || device.last_seen

      return {
        deviceId: device.device_id,
        name: device.name,
        os: device.os,
        osVersion: device.os_version,
        hostname: device.hostname,
        ip: device.ip,
        online: isOnline,
        lastSeen: lastSeen,
        createdAt: device.created_at,
        sessionId: httpAgent?.sessionId || null
      }
    })

    // Also add any online devices not in DB yet
    if (global.httpAgents) {
      for (const [id, agent] of global.httpAgents) {
        if (agent.deviceId && !devices.find(d => d.deviceId === agent.deviceId)) {
          const lastHeartbeat = new Date(agent.lastHeartbeat).getTime()
          const isAlive = (Date.now() - lastHeartbeat) < 15000
          devices.push({
            deviceId: agent.deviceId,
            name: agent.name,
            os: agent.os,
            osVersion: agent.osVersion,
            hostname: agent.hostname,
            ip: agent.ip,
            online: isAlive,
            lastSeen: agent.lastHeartbeat,
            createdAt: agent.connectedAt,
            sessionId: agent.sessionId
          })
        }
      }
    }

    return res.status(200).json({ devices })
  } catch (error) {
    console.error('[remote] Devices API error:', error)
    return res.status(500).json({ error: 'Failed to fetch devices' })
  }
}
