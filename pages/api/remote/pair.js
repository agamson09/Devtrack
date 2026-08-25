import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import db from '@/lib/db'

const pool = db.pool
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  let { deviceId, password } = req.body

  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'Device ID is required' })
  }

  // Normalize: strip all spaces so "0050B61CB" matches "005 0B6 1CB"
  const normalizedId = deviceId.trim().replace(/\s+/g, '')

  try {
    // Find the device in database (try exact, then try without spaces)
    let [rows] = await pool.execute(
      'SELECT device_id, name, os, os_version, hostname, ip, device_password_hash, unattended_enabled, last_seen FROM remote_devices WHERE device_id = ?',
      [deviceId.trim()]
    )

    // If not found by exact match, try matching by removing spaces from DB values
    if (rows.length === 0) {
      const [allRows] = await pool.execute(
        'SELECT device_id, name, os, os_version, hostname, ip, device_password_hash, unattended_enabled, last_seen FROM remote_devices'
      )
      rows = allRows.filter(r => r.device_id.replace(/\s+/g, '') === normalizedId)
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Device not found. Make sure the agent is running and registered.' })
    }

    const device = rows[0]

    // Check if device is online
    const httpAgent = global.httpAgents
      ? Array.from(global.httpAgents.values()).find(a => a.deviceId === device.device_id)
      : null

    const isOnline = !!httpAgent

    if (!isOnline) {
      return res.status(503).json({
        error: 'Device is offline',
        device: {
          deviceId: device.device_id,
          name: device.name,
          lastSeen: device.last_seen
        }
      })
    }

    // Check if device has a password set
    const hasPassword = !!device.device_password_hash

    if (hasPassword) {
      // Password required — verify it
      if (!password) {
        return res.status(401).json({
          error: 'Password required',
          requiresPassword: true,
          device: {
            deviceId: device.device_id,
            name: device.name
          }
        })
      }

      const valid = await bcrypt.compare(password, device.device_password_hash)
      if (!valid) {
        return res.status(401).json({
          error: 'Invalid password',
          requiresPassword: true,
          device: {
            deviceId: device.device_id,
            name: device.name
          }
        })
      }

      // Password correct — auto-approve
      console.log(`[pair] Auto-approved connection to ${device.name} (${device.device_id}) by ${user.name}`)

      // Queue start command to agent
      const commands = global.pendingCommands?.get(httpAgent.sessionId) || []
      commands.push({ type: 'start', viewerId: `user-${user.id}` })
      global.pendingCommands?.set(httpAgent.sessionId, commands)

      // Create session
      if (global.remoteSessions) {
        global.remoteSessions.set(`user-${user.id}`, {
          deviceId: httpAgent.sessionId,
          deviceName: device.name,
          userId: user.id,
          startTime: new Date().toISOString(),
          recording: false,
          type: 'http',
          pairingMode: 'unattended'
        })
      }

      return res.status(200).json({
        success: true,
        paired: true,
        mode: 'unattended',
        device: {
          deviceId: device.device_id,
          name: device.name,
          os: device.os,
          osVersion: device.os_version,
          hostname: device.hostname,
          ip: device.ip,
          sessionId: httpAgent.sessionId
        }
      })
    }

    // No password set — require approval from remote user
    // Queue approval request to agent
    const commands = global.pendingCommands?.get(httpAgent.sessionId) || []
    commands.push({
      type: 'approval_request',
      viewerId: `user-${user.id}`,
      viewerName: user.name,
      message: `${user.name} wants to connect to this device. Approve?`
    })
    global.pendingCommands?.set(httpAgent.sessionId, commands)

    console.log(`[pair] Approval requested for ${device.name} (${device.device_id}) from ${user.name}`)

    return res.status(200).json({
      success: true,
      paired: false,
      mode: 'approval_required',
      message: 'Waiting for approval from remote user...',
      device: {
        deviceId: device.device_id,
        name: device.name
      }
    })

  } catch (error) {
    console.error('[pair] Error:', error)
    return res.status(500).json({ error: 'Pairing failed' })
  }
}
