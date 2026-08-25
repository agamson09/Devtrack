#!/usr/bin/env node

const os = require('os')
const fs = require('fs')
const path = require('path')
const { io } = require('socket.io-client')
const { captureScreen, getScreenResolution, detectHeadless } = require('./capture')
const { simulateMouse, simulateKeyboard } = require('./input')

const args = process.argv.slice(2)
function getArg(name, fallback) {
  const idx = args.indexOf('--' + name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}

const VIRTUAL_DISPLAY = getArg('virtual-display', false)
const CONFIG_PATH = path.join(__dirname, 'agent-config.json')
let config = {}
if (fs.existsSync(CONFIG_PATH)) {
  try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } catch {}
}

const SERVER_URL = getArg('server', config.server || 'http://localhost:3000')
const DEVICE_NAME = getArg('name', config.name || os.hostname())
const DEVICE_PASSWORD = getArg('password', config.password || '')
const MAX_FPS = parseInt(getArg('maxfps', config.maxFPS || '15'), 10)
const QUALITY = parseInt(getArg('quality', config.captureQuality || '50'), 10)
const HEADLESS_MODE = getArg('headless', config.headless || false)

fs.writeFileSync(CONFIG_PATH, JSON.stringify({
  server: SERVER_URL, name: DEVICE_NAME, password: DEVICE_PASSWORD,
  maxFPS: MAX_FPS, captureQuality: QUALITY, headless: HEADLESS_MODE, virtualDisplay: VIRTUAL_DISPLAY, autoReconnect: true
}, null, 2))

const platform = os.platform()
const hostname = os.hostname()
const interfaces = os.networkInterfaces()
let localIP = '127.0.0.1'
for (const n of Object.keys(interfaces)) {
  for (const iface of interfaces[n]) {
    if (iface.family === 'IPv4' && !iface.internal) { localIP = iface.address; break }
  }
}

console.log('========================================')
console.log('  DevTrack Remote Desktop Agent v3.1')
console.log('========================================')
console.log('Server:', SERVER_URL)
console.log('Device:', DEVICE_NAME)
console.log('OS:', platform, os.release())
console.log('IP:', localIP)
console.log('FPS:', MAX_FPS, '| Quality:', QUALITY)
console.log('========================================')

// Detect Windows session
if (platform === 'win32') {
  try {
    const { execSync } = require('child_process')
    const sessionInfo = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO LIST', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    console.log('[session] node processes:')
    console.log(sessionInfo.trim())
    const myPid = process.pid
    const pidInfo = execSync(`wmic process where ProcessId=${myPid} get SessionId /value`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    console.log('[session] Current PID:', myPid)
    console.log(pidInfo.trim())
  } catch (e) {
    console.log('[session] Session info:', e.message)
  }
}

let socket = null
let captureInterval = null
let isCapturing = false
let lastFrameTime = 0
let activeViewerId = null
const FRAME_INTERVAL = 1000 / MAX_FPS

// Detect headless on Windows
if (platform === 'win32') {
  detectHeadless()
}

// If virtual display mode, adjust capture settings
if (VIRTUAL_DISPLAY || HEADLESS_MODE) {
  console.log('[config] Virtual display mode enabled')
  console.log('[config] Using enhanced capture with quality:', QUALITY, 'FPS:', MAX_FPS)
  // Note: For virtual display / headless, quality 70+ recommended for best results
}

function connect() {
  socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: Infinity,
    auth: { agent: true, password: DEVICE_PASSWORD }
  })

  socket.on('connect', () => {
    console.log('Connected to server:', socket.id)
    const resolution = getScreenResolution()
    socket.emit('remote:register', {
      name: DEVICE_NAME, os: platform, osVersion: os.release(),
      ip: localIP, hostname, resolution,
      agentVersion: '3.1.0', features: ['clipboard']
    })
  })

  socket.on('connect_error', (err) => {
    console.log('Connection error:', err.message)
  })

  socket.on('remote:start', (data) => {
    if (isCapturing) return
    console.log('Stream started by:', data.viewerId)
    activeViewerId = data.viewerId
    isCapturing = true
    startCapture()
  })

  socket.on('remote:stop', () => {
    console.log('Stream stopped')
    isCapturing = false
    activeViewerId = null
    stopCapture()
  })

  socket.on('remote:mouse', (data) => {
    try { simulateMouse(data) } catch (e) { console.error('Mouse error:', e.message) }
  })

  socket.on('remote:keyboard', (data) => {
    try { simulateKeyboard(data) } catch (e) { console.error('Keyboard error:', e.message) }
  })

  socket.on('remote:clipboard-set', (data) => {
    if (data.text) {
      try {
        const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText('${data.text.replace(/'/g, "''")}')`
        require('child_process').execSync(`powershell -Command "${ps.replace(/"/g, '\\"')}"`, { timeout: 3000, stdio: 'pipe' })
      } catch {}
    }
  })

  socket.on('remote:file-chunk', (data) => {
    handleFileChunk(data)
  })

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason)
    isCapturing = false
    stopCapture()
  })
}

async function startCapture() {
  if (captureInterval) return
  const minInterval = Math.max(FRAME_INTERVAL, 50)
  let frameNum = 0

  console.log('[capture] Starting, max FPS:', MAX_FPS)

  captureInterval = setInterval(async () => {
    if (!isCapturing || !socket?.connected) return
    const now = Date.now()
    if (now - lastFrameTime < minInterval) return
    lastFrameTime = now

    try {
      const buf = await captureScreen()
      if (buf && buf.length > 100) {
        const base64 = Buffer.isBuffer(buf) ? buf.toString('base64') : buf
        socket.emit('remote:frame', {
          viewerId: activeViewerId,
          frame: base64,
          ts: now,
          size: buf.length
        })
        frameNum++
        if (frameNum % 100 === 1) {
          console.log(`[capture] Frame #${frameNum}, ${(buf.length / 1024).toFixed(0)}KB`)
        }
      }
    } catch (e) {
      if (frameNum % 50 === 0) {
        console.error('[capture] Error:', e.message)
      }
    }
  }, 16)
}

function stopCapture() {
  if (captureInterval) {
    clearInterval(captureInterval)
    captureInterval = null
  }
}

const fileChunks = new Map()
function handleFileChunk(data) {
  const { chunkId, filename, chunk, total, index } = data
  if (!fileChunks.has(chunkId)) {
    fileChunks.set(chunkId, { filename, chunks: [], total })
  }
  const file = fileChunks.get(chunkId)
  file.chunks[index] = chunk
  const received = file.chunks.filter(c => c !== undefined).length
  if (received === file.total) {
    try {
      const buffer = Buffer.concat(file.chunks.map(c => Buffer.from(c, 'base64')))
      const filePath = path.join(os.homedir(), 'Downloads', filename)
      fs.writeFileSync(filePath, buffer)
      console.log('File saved:', filePath)
      socket.emit('remote:file-saved', { filename, path: filePath, size: buffer.length })
    } catch (err) {
      console.error('File save error:', err.message)
    }
    fileChunks.delete(chunkId)
  }
}

function shutdown() {
  console.log('\nShutting down...')
  stopCapture()
  if (socket) {
    socket.emit('remote:unregister')
    socket.disconnect()
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

connect()
