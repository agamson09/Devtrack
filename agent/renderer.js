const os = require('os')
const fs = require('fs')
const path = require('path')
const { io } = require('socket.io-client')
const { ipcRenderer } = require('electron')
const { simulateMouse, simulateKeyboard } = require('./input')
const { captureScreen } = require('./capture')

const args = process.argv
function getArg(name, fallback) {
  const idx = args.indexOf('--' + name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}

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

try {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    server: SERVER_URL, name: DEVICE_NAME, password: DEVICE_PASSWORD,
    maxFPS: MAX_FPS, captureQuality: QUALITY, autoReconnect: true
  }, null, 2))
} catch (e) {
  console.log('Could not save config (running from packaged app)')
}

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
console.log('  DevTrack Agent v3.2 (Electron)')
console.log('========================================')
console.log('Server:', SERVER_URL)
console.log('Device:', DEVICE_NAME)
console.log('IP:', localIP)
console.log('========================================')

let socket = null
let peerConnection = null
let localStream = null
let activeViewerId = null
let captureInterval = null

async function getDesktopStream() {
  if (localStream) return localStream;
  const sources = await ipcRenderer.invoke('GET_SOURCES', { types: ['screen'] })
  let targetSource = sources.find(s => s.name === 'Entire Screen' || s.name === 'Screen 1') || sources[0]
  
  if (targetSource) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: targetSource.id,
            minFrameRate: MAX_FPS,
            maxFrameRate: 60
          }
        }
      })
      localStream = stream;
      return stream
    } catch (e) {
      console.error('Failed to get desktop stream:', e)
    }
  }
  return null;
}

function connect() {
  socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: true,
    auth: { agent: true, password: DEVICE_PASSWORD }
  })

  socket.on('connect', () => {
    console.log('Connected to server:', socket.id)
    socket.emit('remote:register', {
      name: DEVICE_NAME, os: platform, osVersion: os.release(),
      ip: localIP, hostname, resolution: { width: 1920, height: 1080 }, // Example resolution
      agentVersion: '3.2.0-electron'
    })
  })

  socket.on('disconnect', () => {
    console.log('Disconnected')
    stopFallbackCapture()
    if (peerConnection) {
      peerConnection.close()
      peerConnection = null
    }
  })

  // === WebRTC SIGNALING ===
  socket.on('remote:webrtc-offer', async (data) => {
    const { viewerId, offer } = data
    console.log(`Received WebRTC offer from viewer ${viewerId}`)
    activeViewerId = viewerId

    const stream = await getDesktopStream()
    
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    if (stream) {
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))
    }

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('remote:webrtc-ice-candidate', {
          viewerId,
          deviceId: socket.id,
          candidate: event.candidate
        })
      }
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    socket.emit('remote:webrtc-answer', {
      viewerId,
      answer
    })
  })

  socket.on('remote:webrtc-ice-candidate', (data) => {
    const { candidate } = data
    if (peerConnection) {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e))
    }
  })

  // === FALLBACK: JPEG over Socket (For old clients) ===
  socket.on('remote:start', async (data) => {
    if (peerConnection) return; // WebRTC in use
    activeViewerId = data.viewerId
    startFallbackCapture()
  })

  socket.on('remote:stop', () => {
    activeViewerId = null
    stopFallbackCapture()
    if (peerConnection) {
      peerConnection.close()
      peerConnection = null
    }
  })

  // === INPUT SIMULATION ===
  socket.on('remote:mouse', (data) => {
    try { simulateMouse(data) } catch(e){}
  })

  socket.on('remote:keyboard', (data) => {
    try { simulateKeyboard(data) } catch(e){}
  })
}

// Fallback logic using HTML Canvas
async function startFallbackCapture() {
  if (captureInterval) return;
  const stream = await getDesktopStream()
  if (!stream) return;
  
  const video = document.getElementById('video-stream')
  const canvas = document.getElementById('capture-canvas')
  const ctx = canvas.getContext('2d', { alpha: false })
  
  video.srcObject = stream
  video.play()
  
  video.onloadedmetadata = () => {
    console.log(`Video metadata loaded: ${video.videoWidth}x${video.videoHeight}`);
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
  }

  const intervalMs = 1000 / MAX_FPS
  let lastTime = 0
  let isCapturingNative = false;

  captureInterval = setInterval(async () => {
    if (!socket?.connected || !activeViewerId) return;
    const now = Date.now()
    if (now - lastTime < intervalMs) return;
    lastTime = now;

    // Failsafe: if canvas dimensions are missing but video has frames
    if (canvas.width === 300 || canvas.width === 0) {
      if (video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }

    let frameBase64 = null;
    let isBlackFrame = false;

    if (canvas.width > 0 && canvas.height > 0) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      frameBase64 = canvas.toDataURL('image/jpeg', QUALITY / 100).split(',')[1]
      if (frameBase64.length < 2000) isBlackFrame = true;
    } else {
      isBlackFrame = true;
    }

    // IF Chromium WebRTC returns black screen (RDP Lock/Headless), fallback to Native GDI!
    if (isBlackFrame && !isCapturingNative) {
      isCapturingNative = true;
      try {
        const buf = await captureScreen();
        if (buf && buf.length > 1000) {
          socket.emit('remote:frame', {
            viewerId: activeViewerId,
            frame: buf.toString('base64'),
            ts: now,
            size: buf.length
          });
        }
      } catch (e) {
        // ignore
      }
      isCapturingNative = false;
      return;
    }

    if (frameBase64 && !isBlackFrame) {
      socket.emit('remote:frame', {
        viewerId: activeViewerId,
        frame: frameBase64,
        ts: now,
        size: frameBase64.length
      })
    }
  }, 16)
}

function stopFallbackCapture() {
  if (captureInterval) {
    clearInterval(captureInterval)
    captureInterval = null
  }
}

connect()
