const fs = require('fs')
const path = require('path')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const { IncomingForm } = require('formidable')
const zlib = require('zlib')
const readline = require('readline')

const { logger, socketLogger, apiLogger, authLogger, errorLogger } = require('./lib/logger')

// Load .env.local BEFORE any lib that creates DB pools or reads env vars
try {
  const envPath = path.join(__dirname, '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const idx = trimmed.indexOf('=')
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim()
        const val = trimmed.slice(idx + 1).trim()
        if (!process.env[key]) process.env[key] = val
      }
    })
    logger.info('Loaded .env.local')
  }
} catch (e) {
  logger.warn('Could not load .env.local', { error: e.message })
}

const { sendPushNotification } = require('./lib/push')
const { setSocketIO, markAsRead, markAllAsRead, getUnreadCount } = require('./lib/notifications')
const { socketLimit, terminalLimit } = require('./lib/rateLimit')

// Validate IT_VAULT_KEY for password encryption
if (!process.env.IT_VAULT_KEY) {
  logger.warn('IT_VAULT_KEY not set — using default vault key (set IT_VAULT_KEY in .env.local for production)')
}

let httpModule
try {
  const key = fs.readFileSync('/var/www/devtrack/key.pem')
  const cert = fs.readFileSync('/var/www/devtrack/cert.pem')
  httpModule = require('https')
  logger.info('SSL certificates loaded, running HTTPS')
} catch {
  httpModule = require('http')
  logger.info('No SSL certs found, running HTTP')
}

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT, 10) || 3000

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET is not set in environment variables')
  process.exit(1)
}
const REMOTE_AGENT_PASSWORD = process.env.REMOTE_AGENT_PASSWORD || ''
const COOKIE_NAME = 'devtrack_token'

const userSockets = new Map()
const socketUsers = new Map()
const remoteUserRef = new Map()

const dbPool = require('./lib/db').pool

function parseCookies(cookieHeader) {
  const cookies = {}
  if (!cookieHeader) return cookies
  cookieHeader.split(';').forEach(c => {
    const [key, ...val] = c.split('=')
    cookies[key.trim()] = val.join('=').trim()
  })
  return cookies
}

async function getUserFromSocket(socket) {
  try {
    let token = null

    if (socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token
    }

    if (!token && socket.handshake.headers && socket.handshake.headers.cookie) {
      const cookies = parseCookies(socket.handshake.headers.cookie)
      token = cookies[COOKIE_NAME]
    }

    if (!token && socket.handshake.query && socket.handshake.query.token) {
      token = socket.handshake.query.token
    }

    if (!token) {
      authLogger.debug('No token found for socket', { socketId: socket.id })
      return null
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    const [rows] = await dbPool.execute('SELECT id, name, role, avatar FROM users WHERE id = ?', [decoded.id])
    if (rows.length === 0) {
      authLogger.warn('User not found in DB', { userId: decoded.id, socketId: socket.id })
      return null
    }
    return rows[0]
  } catch (err) {
    authLogger.error('Socket auth error', { socketId: socket.id, error: err.message })
    return null
  }
}

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

const MIME_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.txt': 'text/plain',
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), payment=()')
  res.setHeader('X-DNS-Prefetch-Control', 'on')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://ui-avatars.com https://avatars.githubusercontent.com https://api.dicebear.com https://cdn.simpleicons.org; connect-src 'self' wss: ws: https://api.dicebear.com; frame-ancestors 'none'")
  }
}

function serveStaticFile(req, res) {
  const urlPath = req.url.split('?')[0]
  const publicDir = path.join(__dirname, 'public')
  const filePath = path.join(publicDir, urlPath)
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(path.resolve(publicDir))) return false
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return false
  const ext = path.extname(resolved).toLowerCase()
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'public, max-age=86400',
  })
  fs.createReadStream(resolved).pipe(res)
  return true
}

const UPLOAD_DIR = '/var/backups/mysql/uploads'

async function handleUploadBackup(req, res) {
  const cookieHeader = req.headers.cookie || ''
  const cookies = parseCookies(cookieHeader)
  let token = cookies[COOKIE_NAME]
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace('Bearer ', '')
  }
  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Unauthorized' }))
  }

  let decoded
  try {
    decoded = jwt.verify(token, JWT_SECRET)
  } catch {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Invalid token' }))
  }

  const [rows] = await dbPool.execute('SELECT role FROM users WHERE id = ?', [decoded.id])
  if (!rows.length || rows[0].role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Admin access required' }))
  }

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

  const form = new IncomingForm({
    uploadDir: UPLOAD_DIR,
    keepExtensions: true,
    maxFileSize: 500 * 1024 * 1024,
  })

  try {
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ files })
      })
    })

    const file = files.file?.[0] || files.file
    if (!file) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: 'No file uploaded' }))
    }

    const originalName = file.originalFilename || file.newFilename
    const ext = path.extname(originalName)
    if (ext !== '.sql' && ext !== '.gz') {
      fs.unlinkSync(file.filepath)
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: 'Only .sql and .sql.gz files allowed' }))
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const targetName = `uploaded-${timestamp}-${safeName}`
    const targetPath = path.join(UPLOAD_DIR, targetName)
    fs.renameSync(file.filepath, targetPath)

    const stat = fs.statSync(targetPath)
    const isGz = targetName.endsWith('.gz')

    function createReadStream() {
      if (isGz) {
        return fs.createReadStream(targetPath).pipe(zlib.createGunzip())
      }
      return fs.createReadStream(targetPath)
    }

    const tableNames = []
    const viewNames = []
    const rowsPerTable = {}
    let totalRows = 0
    let dbName = null
    let currentInsertTable = null
    let currentInsertValues = ''
    let quoteCount = 0

    function isStatementEnd(line) {
      if (!line.endsWith(';')) return false
      let count = 0
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "'" && (i === 0 || line[i - 1] !== '\\')) count++
      }
      return count % 2 === 0
    }

    await new Promise((resolve, reject) => {
      const rl = readline.createInterface({ input: createReadStream(), crlfDelay: Infinity })
      rl.on('line', (line) => {
        const dbLineMatch = line.match(/Current Database.*?`(\w+)`/)
        if (dbLineMatch && !dbName) dbName = dbLineMatch[1]

        const hostDbMatch = line.match(/--\s*Host:.*Database:\s*(\S+)/)
        if (hostDbMatch && !dbName) dbName = hostDbMatch[1]

        const useMatch = line.match(/USE\s+`(\w+)`/)
        if (useMatch && !dbName) dbName = useMatch[1]

        const tblMatch = line.match(/CREATE TABLE.*?`(\w+)`/)
        if (tblMatch) tableNames.push(tblMatch[1])

        const viewMatch = line.match(/CREATE.*VIEW.*?`(\w+)`/)
        if (viewMatch) viewNames.push(viewMatch[1])

        const insertMatch = line.match(/INSERT INTO.*?`(\w+)`.*?VALUES\s*\(/)
        if (insertMatch) {
          currentInsertTable = insertMatch[1]
          currentInsertValues = line
          if (isStatementEnd(line)) {
            const cnt = (currentInsertValues.match(/\),\s*\(/g) || []).length + 1
            rowsPerTable[currentInsertTable] = (rowsPerTable[currentInsertTable] || 0) + cnt
            totalRows += cnt
            currentInsertTable = null
            currentInsertValues = ''
          }
        } else if (currentInsertTable) {
          currentInsertValues += '\n' + line
          if (isStatementEnd(line)) {
            const cnt = (currentInsertValues.match(/\),\s*\(/g) || []).length + 1
            rowsPerTable[currentInsertTable] = (rowsPerTable[currentInsertTable] || 0) + cnt
            totalRows += cnt
            currentInsertTable = null
            currentInsertValues = ''
          }
        }
      })
      rl.on('close', resolve)
      rl.on('error', reject)
    })

    let liveTables = []
    if (dbName) {
      try {
        liveTables = await dbPool.execute(
          'SELECT table_name AS name, table_rows AS row_count FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name',
          [dbName]
        )
        liveTables = liveTables[0] || []
      } catch {}
    }

    const comparison = {}
    if (dbName && liveTables.length > 0) {
      const liveMap = {}
      liveTables.forEach(t => { liveMap[t.name] = t.row_count || 0 })
      const allTableNames = [...new Set([...tableNames, ...Object.keys(liveMap)])]
      for (const t of allTableNames) {
        comparison[t] = {
          in_backup: tableNames.includes(t),
          in_live: !!liveMap[t],
          backup_rows: rowsPerTable[t] || 0,
          live_rows: liveMap[t] || 0,
          match: (rowsPerTable[t] || 0) === (liveMap[t] || 0),
        }
      }
    }

    const result = {
      success: true,
      filename: targetName,
      original_name: originalName,
      database: dbName,
      table_count: tableNames.length,
      view_count: viewNames.length,
      total_rows: totalRows,
      rows_per_table: rowsPerTable,
      size_mb: Math.round(stat.size / 1024 / 1024 * 100) / 100,
      tables: tableNames,
      views: viewNames,
      comparison,
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(result))
  } catch (error) {
    apiLogger.error('Upload error', { error: error.message })
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Upload failed: ' + error.message }))
  }
}

app.prepare().then(() => {
  let server
  try {
    const key = fs.readFileSync('/var/www/devtrack/key.pem')
    const cert = fs.readFileSync('/var/www/devtrack/cert.pem')
    server = httpModule.createServer({ key, cert }, async (req, res) => {
      try {
        setSecurityHeaders(res)
        if (req.url.startsWith('/uploads/')) {
          if (serveStaticFile(req, res)) return
        }
        if (req.method === 'POST' && req.url.startsWith('/api/system/upload-backup')) {
          return await handleUploadBackup(req, res)
        }
        const parsedUrl = parse(req.url, true)
        await handle(req, res, parsedUrl)
      } catch (err) {
        apiLogger.error('Error handling request', { url: req.url, error: err.message })
        res.statusCode = 500
        res.end('Internal Server Error')
      }
    })
  } catch {
    server = httpModule.createServer(async (req, res) => {
      try {
        setSecurityHeaders(res)
        if (req.url.startsWith('/uploads/')) {
          if (serveStaticFile(req, res)) return
        }
        if (req.method === 'POST' && req.url.startsWith('/api/system/upload-backup')) {
          return await handleUploadBackup(req, res)
        }
        const parsedUrl = parse(req.url, true)
        await handle(req, res, parsedUrl)
      } catch (err) {
        apiLogger.error('Error handling request', { url: req.url, error: err.message })
        res.statusCode = 500
        res.end('Internal Server Error')
      }
    })
  }

  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  })

  io.on('connection', async (socket) => {
    // Handle agent connections (require password auth)
    if (socket.handshake.auth && socket.handshake.auth.agent) {
      // If REMOTE_AGENT_PASSWORD is set, agents must provide matching password
      // If REMOTE_AGENT_PASSWORD is empty/not set, allow any agent (no password check)
      if (REMOTE_AGENT_PASSWORD && socket.handshake.auth.password !== REMOTE_AGENT_PASSWORD) {
        authLogger.warn('Agent rejected: invalid password', { socketId: socket.id })
        socket.disconnect()
        return
      }
      // Agent will emit remote:register after connecting
      socket.on('disconnect', () => {
        const agent = global.remoteAgents?.get(socket.id)
        if (agent) {
          socketLogger.info('Remote agent disconnected', { agentName: agent.name })
          global.remoteSessions?.delete(socket.id)
          global.remoteAgents.delete(socket.id)
          io.emit('remote:agent-offline', { id: socket.id })
        }
      })
      return
    }

    const user = await getUserFromSocket(socket)
    if (!user) {
      authLogger.warn('Socket auth failed, disconnecting', { socketId: socket.id })
      socket.emit('auth:error', { message: 'Authentication failed' })
      socket.disconnect()
      return
    }

    const userId = user.id
    socketUsers.set(socket.id, userId)
    if (!userSockets.has(userId)) userSockets.set(userId, new Set())
    userSockets.get(userId).add(socket.id)

    socket.join(`user-${userId}`)

    // Online status broadcast
    io.emit('user-online', { userId, online: true })

    // Notifications: mark as read
    socket.on('notification:read', async (data) => {
      try {
        const { notificationId } = data
        if (!notificationId || !Number.isInteger(Number(notificationId))) return
        await markAsRead(Number(notificationId))
        const unread = await getUnreadCount(userId)
        socket.emit('notification:unread-count', { unreadCount: unread })
      } catch (err) {}
    })

    // Notifications: mark all as read
    socket.on('notification:read-all', async () => {
      try {
        await markAllAsRead(userId)
        socket.emit('notification:unread-count', { unreadCount: 0 })
      } catch (err) {
        socketLogger.error('Notification read-all error', { userId, error: err.message })
      }
    })

    // Chat: send message (rate limited)
    socket.on('chat:send', async (data) => {
      try {
        const ip = socket.handshake.address || 'unknown'
        const limit = socketLimit(ip, 'chat:send')
        if (!limit.allowed) {
          socket.emit('error', { message: 'Rate limit exceeded' })
          return
        }

        const { receiverId, message, messageType, mediaUrl, replyTo } = data
        if (!receiverId) return
        const msgType = messageType || 'text'
        const msgContent = (message || '').trim()
        if (msgType === 'text' && !msgContent) return
        if (typeof msgContent !== 'string' || msgContent.length > 5000) return

        const [result] = await dbPool.execute(
          'INSERT INTO messages (sender_id, receiver_id, message, message_type, media_url, reply_to) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, receiverId, msgContent, msgType, mediaUrl || null, replyTo || null]
        )

        const msgRow = await dbPool.execute(
          'SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?',
          [result.insertId]
        )
        const msg = msgRow[0][0]

        const lastMsgDisplay = msgType === 'image' ? '📷 Image' : msgType === 'voice' ? '🎤 Voice' : msgContent

        // Send to sender
        socket.emit('chat:message', msg)
        // Send to receiver
        io.to(`user-${receiverId}`).emit('chat:message', msg)
        // Update conversation list for both
        io.to(`user-${receiverId}`).emit('chat:conversation-update', {
          userId,
          lastMessage: lastMsgDisplay,
          timestamp: msg.created_at,
        })
        // Also update sender's own conversation list
        socket.emit('chat:conversation-update', {
          userId: receiverId,
          lastMessage: lastMsgDisplay,
          timestamp: msg.created_at,
        })

        // Create notification record in DB so Header badge updates
        const senderName = user.name || 'Someone'
        try {
          const [notifResult] = await dbPool.execute(
            'INSERT INTO notifications (user_id, type, title, message, link, source_type, source_id, actor_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())',
            [receiverId, 'chat_message', senderName, lastMsgDisplay.substring(0, 200), '/dashboard/chat', 'chat', null, userId]
          )
          const notifId = notifResult.insertId
          io.to(`user-${receiverId}`).emit('notification:new', {
            id: notifId,
            user_id: receiverId,
            type: 'chat_message',
            title: senderName,
            message: lastMsgDisplay.substring(0, 200),
            link: '/dashboard/chat',
            source_type: 'chat',
            source_id: null,
            actor_id: userId,
            is_read: 0,
            created_at: new Date().toISOString(),
          })
          // Also send updated unread count to receiver
          const [unreadRows] = await dbPool.execute(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [receiverId]
          )
          io.to(`user-${receiverId}`).emit('notification:unread-count', { unreadCount: unreadRows[0].count })
        } catch (e) {
          socketLogger.error('Chat notification record failed', { userId, receiverId, error: e.message })
        }

        // Push notification if receiver offline
        if (!userSockets.has(receiverId)) {
          sendPushNotification(receiverId, {
            title: senderName,
            body: lastMsgDisplay.substring(0, 200),
            url: `/dashboard/chat`,
            tag: `chat-${userId}`,
          }).catch(() => {})
        }
      } catch (err) {
        socket.emit('chat:error', { message: 'Failed to send message' })
      }
    })

    // Chat: typing indicator
    socket.on('chat:typing', (data) => {
      const { receiverId } = data
      if (receiverId) {
        io.to(`user-${receiverId}`).emit('chat:typing', { userId, typing: true })
      }
    })

    socket.on('chat:stop-typing', (data) => {
      const { receiverId } = data
      if (receiverId) {
        io.to(`user-${receiverId}`).emit('chat:typing', { userId, typing: false })
      }
    })

    // Group typing indicator
    socket.on('chat:group-typing', async (data) => {
      const { groupId, typing } = data
      if (!groupId) return
      try {
        const members = await dbPool.execute(
          'SELECT user_id FROM chat_group_members WHERE group_id = ? AND user_id != ?',
          [groupId, userId]
        )
        const rows = members[0] || []
        for (const m of rows) {
          io.to(`user-${m.user_id}`).emit('chat:group-typing', { groupId, userId, typing })
        }
      } catch (err) {
        socketLogger.error('Group typing error', { userId, groupId, error: err.message })
      }
    })

    // Chat: mark messages read
    socket.on('chat:read', async (data) => {
      try {
        const { senderId } = data
        if (!senderId) return
        await dbPool.execute(
          'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
          [senderId, userId]
        )
        // Also mark chat notifications from this sender as read
        await dbPool.execute(
          `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type IN ('chat_message', 'chat_mention') AND actor_id = ? AND is_read = 0`,
          [userId, senderId]
        )
        const [unreadRows] = await dbPool.execute(
          'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
          [userId]
        )
        socket.emit('notification:unread-count', { unreadCount: unreadRows[0].count })
        io.to(`user-${senderId}`).emit('chat:read-confirm', { readerId: userId })
      } catch (err) {
        socketLogger.error('Chat read error', { userId, error: err.message })
      }
    })

    // Chat: mark group notifications as read when opening a group
    socket.on('chat:group-read', async (data) => {
      try {
        const { groupId } = data
        if (!groupId) return
        // Mark group message notifications as read
        await dbPool.execute(
          `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type IN ('group_message', 'group_mention') AND source_id = ? AND is_read = 0`,
          [userId, groupId]
        )
        const [unreadRows] = await dbPool.execute(
          'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
          [userId]
        )
        socket.emit('notification:unread-count', { unreadCount: unreadRows[0].count })
      } catch (err) {
        socketLogger.error('Group read error', { userId, error: err.message })
      }
    })

    // Chat: mark specific message read (for read-by tracking)
    socket.on('chat:mark-read', async (data) => {
      try {
        const { messageId } = data
        if (!messageId) return
        await dbPool.execute(
          'INSERT IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)',
          [messageId, userId]
        )
      } catch (err) {
        socketLogger.error('Mark read error', { userId, messageId, error: err.message })
      }
    })

    // Chat: reaction update broadcast
    socket.on('chat:reaction', (data) => {
      const { messageId, groupId, receiverId, emoji, action, userName } = data
      if (groupId) {
        const members = io.sockets.adapter.rooms.get(`group-${groupId}`)
        if (members) {
          for (const socketId of members) {
            if (socketId !== socket.id) {
              io.to(socketId).emit('chat:reaction', { messageId, emoji, action, userName, userId })
            }
          }
        }
      } else if (receiverId) {
        io.to(`user-${receiverId}`).emit('chat:reaction', { messageId, emoji, action, userName, userId })
      }
    })

    // ==================== CALL SIGNALING ====================

    // Call: invite
    socket.on('call:invite', (data) => {
      const { to, type } = data
      if (!to) return
      remoteUserRef.set(userId, to)
      remoteUserRef.set(to, userId)
      io.to(`user-${to}`).emit('call:invite', {
        from: userId,
        fromName: user.name,
        type: type || 'video',
      })
    })

    // Call: accept
    socket.on('call:accept', (data) => {
      const { to } = data
      if (!to) return
      io.to(`user-${to}`).emit('call:accepted', { from: userId })
    })

    // Call: reject
    socket.on('call:reject', (data) => {
      const { to } = data
      if (!to) return
      remoteUserRef.delete(userId)
      remoteUserRef.delete(to)
      io.to(`user-${to}`).emit('call:rejected', { from: userId })
    })

    // Call: offer (SDP relay)
    socket.on('call:offer', (data) => {
      const { to, offer } = data
      if (!to || !offer) return
      io.to(`user-${to}`).emit('call:offer', { from: userId, offer })
    })

    // Call: answer (SDP relay)
    socket.on('call:answer', (data) => {
      const { to, answer } = data
      if (!to || !answer) return
      io.to(`user-${to}`).emit('call:answer', { from: userId, answer })
    })

    // Call: ICE candidate relay
    socket.on('call:ice-candidate', (data) => {
      const { to, candidate } = data
      if (!to || !candidate) return
      io.to(`user-${to}`).emit('call:ice-candidate', { from: userId, candidate })
    })

    // Call: end
    socket.on('call:end', (data) => {
      const { to } = data
      if (!to) return
      remoteUserRef.delete(userId)
      remoteUserRef.delete(to)
      io.to(`user-${to}`).emit('call:end', { from: userId })
    })

    // Call: screen share notification
    socket.on('call:screen-share', (data) => {
      const { to, sharing } = data
      if (!to) return
      io.to(`user-${to}`).emit('call:screen-share', { from: userId, sharing })
    })

    // ==================== GROUP CALL SIGNALING ====================
    const groupCalls = new Map()

    socket.on('call:group-invite', (data) => {
      const { groupId, groupName, members, memberIds, type } = data
      if (!groupId) return
      const memberList = members || memberIds || []
      const roomId = `group-${groupId}`
      socket.join(roomId)
      groupCalls.set(roomId, { hostId: userId, members: [userId, ...memberList], type: type || 'video' })
      memberList.forEach(memberId => {
        io.to(`user-${memberId}`).emit('call:group-invite', {
          from: userId,
          fromName: user.name,
          groupId,
          groupName: groupName || 'Group Call',
          type: type || 'video',
        })
      })
    })

    socket.on('call:group-join', (data) => {
      const { groupId } = data
      if (!groupId) return
      const roomId = `group-${groupId}`
      socket.join(roomId)
      const room = groupCalls.get(roomId)
      if (room && !room.members.includes(userId)) {
        room.members.push(userId)
      }
      socket.to(roomId).emit('call:group-member-joined', { userId, userName: user.name })
    })

    socket.on('call:group-offer', (data) => {
      const { to, offer, groupId } = data
      if (!to || !offer) return
      io.to(`user-${to}`).emit('call:group-offer', { from: userId, offer, groupId })
    })

    socket.on('call:group-answer', (data) => {
      const { to, answer, groupId } = data
      if (!to || !answer) return
      io.to(`user-${to}`).emit('call:group-answer', { from: userId, answer, groupId })
    })

    socket.on('call:group-ice-candidate', (data) => {
      const { to, candidate, groupId } = data
      if (!to || !candidate) return
      io.to(`user-${to}`).emit('call:group-ice-candidate', { from: userId, candidate, groupId })
    })

    socket.on('call:group-leave', (data) => {
      const { groupId } = data
      if (!groupId) return
      const roomId = `group-${groupId}`
      socket.leave(roomId)
      const room = groupCalls.get(roomId)
      if (room) {
        room.members = room.members.filter(m => m !== userId)
        if (room.members.length === 0) groupCalls.delete(roomId)
      }
      socket.to(roomId).emit('call:group-member-left', { userId, userName: user.name })
    })

    socket.on('call:group-end', (data) => {
      const { groupId } = data
      if (!groupId) return
      const roomId = `group-${groupId}`
      const room = groupCalls.get(roomId)
      if (room && room.hostId === userId) {
        io.to(roomId).emit('call:group-ended', { by: userId })
        groupCalls.delete(roomId)
      }
    })

    // Notify peer on disconnect
    socket.on('disconnect', () => {
      // End any active 1-on-1 call for this user
      if (remoteUserRef.has(userId)) {
        const peerId = remoteUserRef.get(userId)
        io.to(`user-${peerId}`).emit('call:end', { from: userId })
        remoteUserRef.delete(peerId)
        remoteUserRef.delete(userId)
      }

      // Clean up group calls
      for (const [roomId, room] of groupCalls.entries()) {
        if (room.members.includes(userId)) {
          room.members = room.members.filter(m => m !== userId)
          socket.to(roomId).emit('call:group-member-left', { userId, userName: user.name })
          if (room.members.length === 0) groupCalls.delete(roomId)
        }
      }

      const sockets = userSockets.get(userId)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size === 0) {
          userSockets.delete(userId)
          io.emit('user-online', { userId, online: false })
        }
      }
      socketUsers.delete(socket.id)
      socketLogger.info('User disconnected', { userId, socketId: socket.id })
    })
  })

  global.io = io
  setSocketIO(io)

  try {
    const pty = require('node-pty')
    const terminalSessions = {}

    io.on('connection', (socket) => {
      socket.on('terminal:spawn', (data) => {
        const uid = socketUsers.get(socket.id)
        if (!uid) return

        const ip = socket.handshake.address || 'unknown'
        const limit = terminalLimit(ip, 'terminal:spawn')
        if (!limit.allowed) {
          socket.emit('terminal:error', 'Rate limit exceeded')
          return
        }

        dbPool.execute('SELECT role FROM users WHERE id = ?', [uid]).then(([rows]) => {
          if (!rows.length || rows[0].role !== 'admin') return

          const allowedShells = ['bash', 'sh', '/bin/bash', '/bin/sh']
          const shell = allowedShells.includes(data?.shell) ? data.shell : 'bash'
          const cols = Math.min(data?.cols || 120, 300)
          const rows_count = Math.min(data?.rows || 30, 100)
          try {
            const term = pty.spawn(shell, [], {
              name: 'xterm-256color',
              cols,
              rows: rows_count,
              cwd: '/var/www/devtrack',
              env: { TERM: 'xterm-256color', COLORTERM: 'truecolor' },
            })
            terminalSessions[socket.id] = term
            term.onData((data) => { socket.emit('terminal:data', data) })
            term.onExit(() => { socket.emit('terminal:exit'); delete terminalSessions[socket.id] })
            socket.emit('terminal:spawned')
          } catch (err) {
            socket.emit('terminal:error', err.message)
          }
        }).catch(() => {})
      })

      socket.on('terminal:input', (data) => {
        const term = terminalSessions[socket.id]
        if (term) term.write(data)
      })

      socket.on('terminal:resize', (data) => {
        const term = terminalSessions[socket.id]
        if (term && data.cols && data.rows) {
          try { term.resize(data.cols, data.rows) } catch {}
        }
      })

      socket.on('terminal:kill', () => {
        const term = terminalSessions[socket.id]
        if (term) { try { term.kill() } catch {} delete terminalSessions[socket.id] }
      })

      socket.on('disconnect', () => {
        const term = terminalSessions[socket.id]
        if (term) { try { term.kill() } catch {} delete terminalSessions[socket.id] }
      })
    })
  } catch (e) {
    socketLogger.error('Terminal WebSocket failed to start', { error: e.message })
  }

  // ==================== REMOTE DEPLOY (SSH) ====================
  dbPool.execute(`
    CREATE TABLE IF NOT EXISTS remote_deploy_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      host VARCHAR(255) NOT NULL,
      port INT DEFAULT 22,
      username VARCHAR(100) NOT NULL,
      password_enc TEXT NOT NULL,
      project_path VARCHAR(500) DEFAULT '/var/www/devtrack',
      last_connected DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `).then(() => {
    logger.info('remote_deploy_configs table ready')
  }).catch((e) => {
    logger.error('Failed to create remote_deploy_configs table', { error: e.message })
  })

  const sshSessions = new Map()

  io.on('connection', (socket) => {
    const uid = socketUsers.get(socket.id)

    socket.on('remote-deploy:connect', async (data) => {
      const userId = uid || socketUsers.get(socket.id)
      if (!userId) { socket.emit('remote-deploy:error', 'Not authenticated'); return }

      const roleCheck = await dbPool.execute('SELECT role FROM users WHERE id = ?', [userId]).catch(() => null)
      if (!roleCheck || !roleCheck[0]?.length || roleCheck[0][0].role !== 'admin') {
        socket.emit('remote-deploy:error', 'Admin access required'); return
      }

      try {
        const { Client } = require('ssh2')
        const conn = new Client()

        // Resolve credentials: saved config id (preferred) or direct payload
        let sshTarget = { host: data.host, port: data.port, username: data.username, password: data.password }
        if (data.configId) {
          const [cfgRows] = await dbPool.execute(
            'SELECT host, port, username, password_enc, project_path FROM remote_deploy_configs WHERE id = ?',
            [data.configId]
          )
          if (!cfgRows?.length) {
            socket.emit('remote-deploy:error', 'Deploy config not found')
            return
          }
          const cfg = cfgRows[0]
          let decrypted = null
          try {
            const crypto = require('crypto')
            const ENCRYPTION_KEY = process.env.DEPLOY_ENCRYPTION_KEY || process.env.JWT_SECRET || 'devtrack-deploy-default-key-32c'
            const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
            const [ivHex, encrypted] = String(cfg.password_enc).split(':')
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivHex)
            decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8')
          } catch (e) {
            socket.emit('remote-deploy:error', 'Failed to decrypt stored password')
            return
          }
          sshTarget = { host: cfg.host, port: cfg.port, username: cfg.username, password: decrypted, project_path: cfg.project_path }
          await dbPool.execute('UPDATE remote_deploy_configs SET last_connected = NOW() WHERE id = ?', [data.configId]).catch(() => {})
        }

        const sshConfig = {
          host: sshTarget.host,
          port: parseInt(sshTarget.port) || 22,
          username: sshTarget.username,
          password: sshTarget.password,
          readyTimeout: 10000,
        }

        conn.on('ready', () => {
          socketLogger.info('SSH connected', { socketId: socket.id, host: sshTarget.host })
          sshSessions.set(socket.id, { conn, host: sshTarget.host })
          socket.emit('remote-deploy:connected', { host: sshTarget.host })

          const connectPath = data.configId ? sshTarget.project_path : data.projectPath
          conn.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, stream) => {
            if (err) { socket.emit('remote-deploy:error', 'Shell error: ' + err.message); return }

            stream.on('data', (data) => {
              socket.emit('remote-deploy:data', data.toString('utf8'))
            })
            stream.stderr.on('data', (data) => {
              socket.emit('remote-deploy:data', data.toString('utf8'))
            })
            stream.on('close', () => {
              socket.emit('remote-deploy:disconnected', { reason: 'stream closed' })
              sshSessions.delete(socket.id)
            })

            sshSessions.get(socket.id).stream = stream

            if (connectPath) {
              stream.write(`cd ${connectPath} && echo "=== Connected to ${sshTarget.host}:${connectPath} ==="\n`)
            } else {
              stream.write(`echo "=== Connected to ${sshTarget.host} ==="\n`)
            }
          })
        })

        conn.on('error', (err) => {
          socketLogger.error('SSH error', { socketId: socket.id, error: err.message })
          socket.emit('remote-deploy:error', 'SSH error: ' + err.message)
        })

        conn.on('close', () => {
          sshSessions.delete(socket.id)
          socket.emit('remote-deploy:disconnected', { reason: 'connection closed' })
        })

        conn.connect(sshConfig)
      } catch (err) {
        socket.emit('remote-deploy:error', 'Failed: ' + err.message)
      }
    })

    socket.on('remote-deploy:input', (data) => {
      const session = sshSessions.get(socket.id)
      if (session && session.stream) {
        session.stream.write(data)
      }
    })

    socket.on('remote-deploy:execute', async (data) => {
      const userId = uid || socketUsers.get(socket.id)
      if (!userId) return

      const session = sshSessions.get(socket.id)
      if (!session || !session.stream) {
        socket.emit('remote-deploy:error', 'Not connected')
        return
      }

      const { command } = data
      if (!command) return

      session.stream.write(command + '\n')
    })

    socket.on('remote-deploy:disconnect', () => {
      const session = sshSessions.get(socket.id)
      if (session) {
        try { session.stream?.close() } catch {}
        try { session.conn?.end() } catch {}
        sshSessions.delete(socket.id)
        socket.emit('remote-deploy:disconnected', { reason: 'user disconnected' })
      }
    })

    socket.on('disconnect', () => {
      const session = sshSessions.get(socket.id)
      if (session) {
        try { session.stream?.close() } catch {}
        try { session.conn?.end() } catch {}
        sshSessions.delete(socket.id)
      }
    })
  })

  // ==================== REMOTE DESKTOP ====================
  if (!global.remoteAgents) global.remoteAgents = new Map()
  if (!global.remoteSessions) global.remoteSessions = new Map()

  // Periodic check: session timeout (8h) + stale agent cleanup + stale HTTP agent cleanup
  setInterval(() => {
    const now = Date.now()
    const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000 // 8 hours
    const STALE_AGENT_MS = 30000 // 30 seconds no heartbeat = offline

    // 1. Cleanup stale HTTP agents (no heartbeat)
    if (global.httpAgents) {
      for (const [id, agent] of global.httpAgents) {
        const lastBeat = new Date(agent.lastHeartbeat).getTime()
        if (now - lastBeat > STALE_AGENT_MS) {
          global.httpAgents.delete(id)
          if (global.pendingCommands) global.pendingCommands.delete(id)
          socketLogger.info('Stale HTTP agent removed', { id, name: agent.name })
        }
      }
    }

    // 2. Cleanup disconnected WebSocket agents
    for (const [id, agent] of global.remoteAgents) {
      if (!agent.socket || !agent.socket.connected) {
        global.remoteAgents.delete(id)
        io.emit('remote:agent-offline', { id })
      }
    }

    // 3. Session timeout + orphan cleanup
    if (global.remoteSessions.size === 0) return
    for (const [viewerId, session] of global.remoteSessions.entries()) {
      const viewerSocket = io.sockets.sockets.get(viewerId)
      const agentExists = global.remoteAgents.has(session.deviceId) || global.httpAgents?.has(session.deviceId)
      const sessionAge = now - new Date(session.startTime).getTime()
      const timedOut = sessionAge > SESSION_TIMEOUT_MS

      if (!viewerSocket || !agentExists || timedOut) {
        if (timedOut) {
          socketLogger.info('Remote session timed out', { viewerId, deviceId: session.deviceId, ageHours: Math.round(sessionAge / 3600000) })
        }
        // Notify viewer if still connected
        if (viewerSocket && viewerSocket.connected) {
          viewerSocket.emit('remote:error', { message: timedOut ? 'Session timed out (8h limit)' : 'Agent disconnected' })
        }
        global.remoteSessions.delete(viewerId)
      }
    }
  }, 10000)

  io.on('connection', (socket) => {
    // Agent registration
    socket.on('remote:register', (data) => {
      const { name, os, osVersion, ip, hostname, resolution, agentVersion, password } = data
      global.remoteAgents.set(socket.id, {
        socketId: socket.id,
        name: name || hostname,
        os,
        osVersion,
        ip,
        hostname,
        resolution,
        agentVersion,
        socket,
        connectedAt: new Date().toISOString()
      })
      io.emit('remote:agent-online', { id: socket.id, name: name || hostname, os, ip })
    })

    socket.on('remote:unregister', () => {
      const agent = global.remoteAgents.get(socket.id)
      if (agent) {
        global.remoteAgents.delete(socket.id)
        io.emit('remote:agent-offline', { id: socket.id })
      }
    })

    // Viewer requests device list
    socket.on('remote:device-list', () => {
      const devices = []
      const seen = new Map() // deduplicate by name

      // HTTP agents (C# agent) - prefer these
      if (global.httpAgents) {
        for (const [id, a] of global.httpAgents) {
          const lastHeartbeat = new Date(a.lastHeartbeat).getTime()
          const isAlive = (Date.now() - lastHeartbeat) < 15000
          devices.push({
            id: a.sessionId,
            name: a.name,
            os: a.os,
            osVersion: a.osVersion,
            ip: a.ip,
            hostname: a.hostname,
            resolution: a.resolution,
            online: isAlive,
            type: 'http'
          })
          seen.set(a.name, true)
        }
      }

      // WebSocket agents - skip if same name already listed as HTTP
      for (const a of global.remoteAgents.values()) {
        if (seen.has(a.name)) continue
        devices.push({
          id: a.socketId,
          name: a.name,
          os: a.os,
          osVersion: a.osVersion,
          ip: a.ip,
          hostname: a.hostname,
          resolution: a.resolution,
          online: a.socket?.connected || false,
          type: 'websocket'
        })
        seen.set(a.name, true)
      }

      socket.emit('remote:device-list', { devices })
    })

    // Audit log helper
    const auditLog = (action, data) => {
      const userId = socketUsers.get(socket.id) || null
      const ip = socket.handshake.address || 'unknown'
      console.log(`[audit] ${action} | user=${userId || 'unknown'} ip=${ip} ${JSON.stringify(data)}`)
      // Write to DB (non-blocking) — use dbPool already loaded at top
      dbPool.execute(
        'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, CAST(? AS JSON))',
        [userId, action, JSON.stringify({ ...data, ip })]
      ).catch(err => {
        // Fallback: try without CAST if column is TEXT/VARCHAR
        dbPool.execute(
          'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
          [userId, action, JSON.stringify({ ...data, ip })]
        ).catch(() => {})
      })
    }

    // Rate limit state per socket for mouse/keyboard
    const rateLimits = new Map() // socketId -> { mouse: { count, reset }, keyboard: { count, reset } }
    const checkRateLimit = (socketId, type, maxPerSec) => {
      const now = Date.now()
      let rl = rateLimits.get(socketId)
      if (!rl) { rl = { mouse: { count: 0, reset: now }, keyboard: { count: 0, reset: now } }; rateLimits.set(socketId, rl) }
      const bucket = rl[type]
      if (now - bucket.reset > 1000) { bucket.count = 0; bucket.reset = now }
      bucket.count++
      return bucket.count <= maxPerSec
    }

    // Viewer starts remote session
    socket.on('remote:start', (data) => {
      const { deviceId, record } = data
      const agent = global.remoteAgents.get(deviceId)
      if (agent) {
        // WebSocket agent
        const viewerUserId = socketUsers.get(socket.id)
        if (!viewerUserId) return
        agent.socket.emit('remote:start', { viewerId: socket.id })
        global.remoteSessions.set(socket.id, {
          deviceId,
          deviceName: agent.name,
          userId: viewerUserId,
          startTime: new Date().toISOString(),
          recording: record || false
        })
        auditLog('remote_connect', { deviceId, deviceName: agent.name })
        return
      }

      // HTTP agent (C# agent) - queue start command
      const httpAgent = global.httpAgents?.get(deviceId)
      if (httpAgent) {
        const viewerUserId = socketUsers.get(socket.id)
        if (!viewerUserId) return
        const commands = global.pendingCommands?.get(deviceId) || []
        commands.push({ type: 'start', viewerId: socket.id })
        global.pendingCommands?.set(deviceId, commands)
        httpAgent.streaming = true
        httpAgent.activeViewerId = socket.id
        global.remoteSessions.set(socket.id, {
          deviceId,
          deviceName: httpAgent.name,
          userId: viewerUserId,
          startTime: new Date().toISOString(),
          recording: record || false,
          type: 'http'
        })
        auditLog('remote_connect_http', { deviceId, deviceName: httpAgent.name })
        return
      }

      socket.emit('remote:error', { message: 'Device not found' })
    })

    // Viewer stops remote session
    socket.on('remote:stop', (data) => {
      const { deviceId } = data
      const session = global.remoteSessions?.get(socket.id)
      const agent = global.remoteAgents.get(deviceId)
      if (agent) {
        agent.socket.emit('remote:stop', { viewerId: socket.id })
        auditLog('remote_disconnect', { deviceId, deviceName: agent.name })
      } else {
        // HTTP agent - queue stop command
        const httpAgent = global.httpAgents?.get(deviceId)
        if (httpAgent) {
          const commands = global.pendingCommands?.get(deviceId) || []
          commands.push({ type: 'stop', viewerId: socket.id })
          global.pendingCommands?.set(deviceId, commands)
          httpAgent.streaming = false
          httpAgent.activeViewerId = null
        }
      }
      global.remoteSessions.delete(socket.id)
      socketLogger.info('Remote session stopped', { viewerId: socket.id })
    })

    // Frame from agent -> forward to viewer
    socket.on('remote:frame', (data) => {
      if (!data || !data.viewerId) return
      const viewerSocket = io.sockets.sockets.get(data.viewerId)
      if (!viewerSocket || !viewerSocket.connected) {
        // Viewer is gone or not a live socket - drop silently, but log once in a while
        const now = Date.now()
        if (!global.__frameDropLog || now - global.__frameDropLog > 5000) {
          global.__frameDropLog = now
      }
        return
      }
      viewerSocket.emit('remote:frame', { frame: data.frame, ts: data.ts, size: data.size })
      global.__frameRelayCount = (global.__frameRelayCount || 0) + 1
      if (global.__frameRelayCount % 300 === 0) {
        socketLogger.debug('Frames relayed', { count: global.__frameRelayCount, viewerId: data.viewerId })
      }
      // Test ping: every 300 frames, also send a test event to verify delivery
      if (global.__frameRelayCount % 300 === 1) {
        viewerSocket.emit('remote:test-ping', { msg: 'delivery check', count: global.__frameRelayCount, viewerSocketId: data.viewerId })
      }
    })

    // Mouse event from viewer -> forward to agent
    socket.on('remote:mouse', (data) => {
      // Rate limit: max 60 mouse events per second per socket
      if (!checkRateLimit(socket.id, 'mouse', 60)) return
      const { deviceId, x, y, button, type, scroll } = data
      // Validate inputs
      if (typeof deviceId !== 'string' || !deviceId) return
      if (typeof x !== 'number' || x < 0 || x > 10000) return
      if (typeof y !== 'number' || y < 0 || y > 10000) return
      if (button && !['left', 'right', 'middle'].includes(button)) return
      if (type && !['move', 'click', 'mousedown', 'mouseup', 'scroll'].includes(type)) return
      if (scroll !== undefined && (typeof scroll !== 'number' || Math.abs(scroll) > 10)) return
      
      const agent = global.remoteAgents.get(deviceId)
      if (agent) {
        // Sanitize data - only forward allowed fields
        const sanitized = { deviceId, x, y, type }
        if (button) sanitized.button = button
        if (scroll !== undefined) sanitized.scroll = scroll
        agent.socket.emit('remote:mouse', sanitized)
      } else {
        // HTTP agent - translate and queue mouse command
        const httpAgent = global.httpAgents?.get(deviceId)
        if (httpAgent) {
          // Translate web event type to C# agent action
          // Pass mousedown/mouseup as separate actions for drag support
          let action = type || 'move'
          if (action === 'mousedown') {
            action = button === 'right' ? 'rightclick' : 'click'
          }
          // mouseup: send as 'release' so C# agent can release mouse button
          if (action === 'mouseup') {
            action = button === 'right' ? 'rightclick-release' : 'release'
          }
          const cmd = { type: 'mouse', x, y, action }
          if (action === 'scroll') cmd.delta = scroll ? scroll * 120 : 120
          const commands = global.pendingCommands?.get(deviceId) || []
          // Mouse move coalescing: if last command is also a move, replace it
          if (action === 'move' && commands.length > 0) {
            const last = commands[commands.length - 1]
            if (last.type === 'mouse' && last.action === 'move') {
              commands[commands.length - 1] = cmd // replace, don't append
              global.pendingCommands?.set(deviceId, commands)
              return
            }
          }
          if (commands.length < 50) {
            commands.push(cmd)
            global.pendingCommands?.set(deviceId, commands)
          }
        }
      }
    })

    // Keyboard event from viewer -> forward to agent
    socket.on('remote:keyboard', (data) => {
      // Rate limit: max 30 keyboard events per second per socket
      if (!checkRateLimit(socket.id, 'keyboard', 30)) return
      const { deviceId, key, combo, type } = data
      // Validate inputs
      if (typeof deviceId !== 'string' || !deviceId) return
      if (typeof key !== 'string' || key.length > 50) return
      if (combo && (typeof combo !== 'string' || combo.length > 100)) return
      if (type && !['keydown', 'keyup'].includes(type)) return
      
      const agent = global.remoteAgents.get(deviceId)
      if (agent) {
        // Sanitize data - only forward allowed fields
        const sanitized = { deviceId, key, type }
        if (combo) sanitized.combo = combo
        agent.socket.emit('remote:keyboard', sanitized)
      } else {
        // HTTP agent - translate and queue keyboard command
        const httpAgent = global.httpAgents?.get(deviceId)
        if (httpAgent && type === 'keydown') {
          // Map shifted characters to their base keys
          const shiftedToBase = {
            '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
            '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
            '~': '`', '_': '-', '+': '=', '{': '[', '}': ']',
            '|': '\\', ':': ";", '"': "'", '<': ',', '>': '.',
            '?': '/'
          }
          // Only queue on keydown (not keyup) to match C# agent behavior
          const cmd = { type: 'keyboard', key }
          if (combo) {
            // Parse combo string like 'ctrl+c' -> set ctrl, key=c
            const parts = combo.toLowerCase().split('+')
            cmd.ctrl = parts.includes('ctrl')
            cmd.alt = parts.includes('alt')
            cmd.shift = parts.includes('shift')
            // Use the last non-modifier key
            const mainKey = parts.find(p => !['ctrl', 'alt', 'shift', 'meta'].includes(p))
            if (mainKey) {
              // If the key is a shifted char (like @), map to base key (2) + shift
              if (shiftedToBase[mainKey]) {
                cmd.key = shiftedToBase[mainKey]
                cmd.shift = true
              } else {
                cmd.key = mainKey
              }
            }
          }
          const commands = global.pendingCommands?.get(deviceId) || []
          if (commands.length < 50) {
            commands.push(cmd)
            global.pendingCommands?.set(deviceId, commands)
          }
        }
      }
    })

    // File transfer: viewer uploads -> forward to agent
    socket.on('remote:file-upload', (data) => {
      const { deviceId, filename, data: fileData, chunkSize } = data
      if (!deviceId || !filename || !fileData) return
      if (typeof filename !== 'string' || filename.length > 255) return
      const MAX_FILE_SIZE = 50 * 1024 * 1024
      if (fileData.length > MAX_FILE_SIZE) {
        socket.emit('remote:error', { message: 'File too large (max 50MB)' })
        return
      }

      const chunkSizeKB = chunkSize || 512
      const chunkBytes = chunkSizeKB * 1024
      const totalChunks = Math.ceil(fileData.length / chunkBytes)
      const chunkId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      // WebSocket agent
      const agent = global.remoteAgents?.get(deviceId)
      if (agent) {
        for (let i = 0; i < totalChunks; i++) {
          const chunk = fileData.slice(i * chunkBytes, (i + 1) * chunkBytes)
          agent.socket.emit('remote:file-chunk', {
            chunkId, filename, chunk, total: totalChunks, index: i
          })
        }
        return
      }

      // HTTP agent - queue file chunks as commands
      const httpAgent = global.httpAgents?.get(deviceId)
      if (httpAgent) {
        const commands = global.pendingCommands?.get(deviceId) || []
        for (let i = 0; i < totalChunks; i++) {
          const chunk = fileData.slice(i * chunkBytes, (i + 1) * chunkBytes)
          commands.push({
            type: 'file-chunk', chunkId, filename,
            chunk: chunk.toString('base64'),
            total: totalChunks, index: i
          })
        }
        global.pendingCommands?.set(deviceId, commands)
        return
      }
    })

    // Agent confirms file saved
    socket.on('remote:file-saved', (data) => {})

    // ==================== WEBRTC SIGNALING ====================
    // Viewer sends offer to agent
    socket.on('remote:webrtc-offer', (data) => {
      const { deviceId, offer } = data
      if (!deviceId || !offer) return
      const agent = global.remoteAgents.get(deviceId)
      if (agent) {
        agent.socket.emit('remote:webrtc-offer', {
          viewerId: socket.id,
          offer
        })
      }
    })

    // Agent sends answer to viewer
    socket.on('remote:webrtc-answer', (data) => {
      const { viewerId, answer } = data
      if (!viewerId || !answer) return
      const viewerSocket = io.sockets.sockets.get(viewerId)
      if (viewerSocket) {
        viewerSocket.emit('remote:webrtc-answer', {
          from: socket.id,
          answer
        })
      }
    })

    // ICE candidate relay (bidirectional)
    socket.on('remote:webrtc-ice-candidate', (data) => {
      const { candidate, deviceId, viewerId } = data
      if (!candidate) return

      if (deviceId) {
        // From viewer to agent
        const agent = global.remoteAgents.get(deviceId)
        if (agent) {
          agent.socket.emit('remote:webrtc-ice-candidate', {
            viewerId: socket.id,
            candidate
          })
        }
      } else if (viewerId) {
        // From agent to viewer
        const viewerSocket = io.sockets.sockets.get(viewerId)
        if (viewerSocket) {
          viewerSocket.emit('remote:webrtc-ice-candidate', {
            from: socket.id,
            candidate
          })
        }
      }
    })

    // Clipboard sync relay
    socket.on('remote:clipboard-set', (data) => {
      const { deviceId, text } = data
      if (!deviceId || text === undefined || typeof text !== 'string') return
      if (text.length > 100000) return

      // WebSocket agent
      const agent = global.remoteAgents?.get(deviceId)
      if (agent) {
        agent.socket.emit('remote:clipboard-set', { viewerId: socket.id, text })
        return
      }

      // HTTP agent - queue clipboard command
      const httpAgent = global.httpAgents?.get(deviceId)
      if (httpAgent) {
        const commands = global.pendingCommands?.get(deviceId) || []
        commands.push({ type: 'clipboard-set', text })
        global.pendingCommands?.set(deviceId, commands)
      }
    })

    socket.on('remote:clipboard', (data) => {
      const { viewerId, text } = data
      if (!viewerId || text === undefined) return
      const viewerSocket = io.sockets.sockets.get(viewerId)
      if (viewerSocket) {
        viewerSocket.emit('remote:clipboard', {
          text
        })
      }
    })

    // Audio relay (agent -> viewer)
    socket.on('remote:audio', (data) => {
      const { viewerId, data: audioData } = data
      if (!viewerId || !audioData) return
      const viewerSocket = io.sockets.sockets.get(viewerId)
      if (viewerSocket) {
        viewerSocket.emit('remote:audio', { data: audioData })
      }
    })

    // Cleanup viewer on disconnect
    socket.on('disconnect', () => {
      const session = global.remoteSessions?.get(socket.id)
      if (session) {
        const agent = global.remoteAgents?.get(session.deviceId)
        if (agent) {
          agent.socket.emit('remote:stop', { viewerId: socket.id })
        }
        global.remoteSessions.delete(socket.id)
      }
    })
  })

  let watcher = null
  try {
    const chokidar = require('chokidar')
    const DEV_DIR = process.env.DEPLOY_DEV_DIR || '/var/www/html/app-dev'
    watcher = chokidar.watch(`${DEV_DIR}/Application/**/*.php`, {
      ignoreInitial: true,
      ignored: /node_modules/,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 }
    })
    watcher.on('change', (filePath) => {
      const rel = filePath.replace(DEV_DIR + '/', '')
      io.emit('deploy:file-changed', { file: rel, action: 'modified' })
    })
    watcher.on('add', (filePath) => {
      const rel = filePath.replace(DEV_DIR + '/', '')
      io.emit('deploy:file-changed', { file: rel, action: 'created' })
    })
    watcher.on('unlink', (filePath) => {
      const rel = filePath.replace(DEV_DIR + '/', '')
      io.emit('deploy:file-changed', { file: rel, action: 'deleted' })
    })
    logger.info('File watcher active', { path: `${DEV_DIR}/Application/**/*.php` })
  } catch (e) {
    logger.error('File watcher failed to start', { error: e.message })
  }

  setInterval(async () => {
    try {
      const { query } = require('./lib/db')
      const expired = await query('SELECT * FROM deploy_backups WHERE expires_at < NOW()')
      let deleted = 0
      for (const backup of expired) {
        try {
          if (fs.existsSync(backup.backup_path)) fs.unlinkSync(backup.backup_path)
          deleted++
        } catch {}
      }
      if (deleted > 0) {
        await query('DELETE FROM deploy_backups WHERE expires_at < NOW()')
        logger.info('Auto-cleanup: removed expired backups', { count: deleted })
      }
    } catch {}
  }, 24 * 60 * 60 * 1000)

  // Boot-time DB health check (non-blocking) — points to /setup when DB is missing
  ;(async () => {
    try {
      const mysql = require('mysql2/promise')
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        connectTimeout: 5000,
      })
      const dbName = process.env.DB_NAME || 'devtrack'
      const [dbs] = await conn.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [dbName])
      if (!dbs.length) {
        logger.warn(`Database "${dbName}" not found — open /setup in the browser to run the first-run wizard`)
      } else {
        logger.info(`MySQL reachable (database "${dbName}" exists)`)
      }
      await conn.end()
    } catch (e) {
      logger.warn(`MySQL not reachable (${e.code || e.message}) — check DB_* vars in .env.local, then open /setup`)
    }
  })()

  // Uptime monitor sweep — checks due external URL monitors every 30s
  setInterval(() => {
    require('./lib/uptimeMonitor').checkDueMonitors().catch(() => {});
  }, 30000);
  setTimeout(() => {
    require('./lib/uptimeMonitor').checkDueMonitors().catch(() => {});
  }, 5000);

  server.listen(port, hostname, () => {
    const protocol = fs.existsSync('/var/www/devtrack/cert.pem') ? 'https' : 'http'
    logger.info('Server ready', { protocol, hostname, port })
  })

  async function gracefulShutdown(signal) {
    logger.info('Shutting down gracefully', { signal })
    if (watcher) try { watcher.close() } catch {}
    io.emit('server:shutdown', { reason: signal })
    io.close()
    server.close(() => {
      logger.info('HTTP server closed')
      dbPool.end().then(() => {
        logger.info('DB pool closed')
        process.exit(0)
      }).catch(() => process.exit(0))
    })
    setTimeout(() => {
      logger.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10000)
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
})
