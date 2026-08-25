import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import db from '@/lib/db'

const pool = db.pool

// In-memory store for HTTP agents
const httpAgents = new Map()
const pendingCommands = new Map()
const agentApiKeys = new Map() // sessionId -> apiKey
const registrationAttempts = new Map() // IP -> { count, lastReset }

// Always update global refs (fixes Next.js hot-reload issues)
global.httpAgents = httpAgents
global.pendingCommands = pendingCommands
global.agentApiKeys = agentApiKeys

// Create persistent devices table on startup
const DEVICES_TABLE = `
  CREATE TABLE IF NOT EXISTS remote_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    os VARCHAR(50),
    os_version VARCHAR(100),
    hostname VARCHAR(100),
    ip VARCHAR(50),
    device_password_hash VARCHAR(255),
    unattended_enabled TINYINT(1) DEFAULT 1,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_id (device_id)
  )
`
pool.execute(DEVICES_TABLE).catch(e => console.error('[remote] Devices table error:', e.message))

// Sanitize string to prevent XSS
function sanitize(str, maxLen = 100) {
  if (typeof str !== 'string') return 'Unknown'
  return str.replace(/[<>&"']/g, '').substring(0, maxLen)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Rate limit: max 5 registrations per IP per 5 minutes
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    const now = Date.now()
    const attempts = registrationAttempts.get(clientIP) || { count: 0, lastReset: now }
    if (now - attempts.lastReset > 300000) {
      attempts.count = 0
      attempts.lastReset = now
    }
    attempts.count++
    registrationAttempts.set(clientIP, attempts)
    if (attempts.count > 5) {
      console.warn(`[remote] Rate limit exceeded for registration from ${clientIP}`)
      return res.status(429).json({ error: 'Too many registration attempts. Try again later.' })
    }

    const { name, os, osVersion, ip, hostname, resolution, agentVersion, password, apiKey, features, deviceId, devicePassword } = req.body

    // Validate password if set (skip if agent has deviceId — device uses its own password)
    if (!deviceId) {
      const agentPassword = process.env.REMOTE_AGENT_PASSWORD
      if (agentPassword && agentPassword !== '' && password !== agentPassword) {
        console.warn(`[remote] Invalid password from ${clientIP} for agent: ${name}`)
        return res.status(401).json({ error: 'Invalid agent password' })
      }
    }

    // Validate API key if set (new agents must provide it)
    const requiredApiKey = process.env.REMOTE_AGENT_API_KEY
    if (requiredApiKey && requiredApiKey !== '' && apiKey !== requiredApiKey) {
      console.warn(`[remote] Invalid API key from ${clientIP} for agent: ${name}`)
      return res.status(401).json({ error: 'Invalid agent API key' })
    }

    // Generate secure session ID using crypto
    const sessionId = crypto.randomBytes(24).toString('base64url')

    // Generate unique API key for this agent session
    const sessionApiKey = crypto.randomBytes(32).toString('base64url')

    // Sanitize inputs
    const safeName = sanitize(name, 50)
    const safeOs = sanitize(os, 20)
    const safeOsVersion = sanitize(osVersion, 50)
    const safeHostname = sanitize(hostname, 50)
    const safeDeviceId = deviceId ? sanitize(deviceId, 50) : null

    // Store agent info
    const agentData = {
      sessionId,
      deviceId: safeDeviceId,
      name: safeName,
      os: safeOs,
      osVersion: safeOsVersion,
      ip: ip || '127.0.0.1',
      hostname: safeHostname,
      resolution: resolution || { width: 1920, height: 1080 },
      agentVersion: agentVersion || '4.0.0',
      features: features || [],
      type: 'http-agent',
      connectedAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      status: 'online',
      registeredFrom: clientIP
    }

    httpAgents.set(sessionId, agentData)
    pendingCommands.set(sessionId, [])
    agentApiKeys.set(sessionId, sessionApiKey)

    // Store/update device in persistent database
    if (safeDeviceId) {
      try {
        // Hash device password if provided (fallback to password field for backward compat)
        let passwordHash = null
        const pwToHash = devicePassword || (deviceId ? password : null)
        if (pwToHash) {
          passwordHash = await bcrypt.hash(pwToHash, 10)
        }

        // Check if device exists to preserve existing password hash
        const [existing] = await pool.execute('SELECT device_password_hash FROM remote_devices WHERE device_id = ?', [safeDeviceId])
        const existingHash = existing.length > 0 ? existing[0].device_password_hash : null
        const finalHash = passwordHash || existingHash

        await pool.execute(
          `INSERT INTO remote_devices (device_id, name, os, os_version, hostname, ip, device_password_hash, unattended_enabled, last_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
           ON DUPLICATE KEY UPDATE name=?, os=?, os_version=?, hostname=?, ip=?, device_password_hash=COALESCE(?, device_password_hash), last_seen=NOW()`,
          [safeDeviceId, safeName, safeOs, safeOsVersion, safeHostname, ip || '127.0.0.1', finalHash, safeName, safeOs, safeOsVersion, safeHostname, ip || '127.0.0.1', passwordHash]
        )
      } catch (e) {
        console.error('[remote] Device save error:', e.message)
      }
    }

    console.log(`[remote] HTTP Agent registered: ${safeName} (${sessionId}) deviceId=${safeDeviceId} from ${clientIP}`)

    // Get unattended status
    let unattendedEnabled = true
    if (safeDeviceId) {
      try {
        const [dev] = await pool.execute('SELECT unattended_enabled FROM remote_devices WHERE device_id = ?', [safeDeviceId])
        if (dev.length > 0) unattendedEnabled = !!dev[0].unattended_enabled
      } catch {}
    }

    console.log(`[remote] HTTP Agent registered: ${safeName} (${sessionId}) deviceId=${safeDeviceId} unattended=${unattendedEnabled} from ${clientIP}`)

    res.status(200).json({
      success: true,
      sessionId,
      deviceId: safeDeviceId,
      apiKey: sessionApiKey,
      unattended: unattendedEnabled,
      message: 'Agent registered successfully'
    })
  } catch (error) {
    console.error('[remote] Registration error:', error)
    res.status(500).json({ error: 'Registration failed' })
  }
}
