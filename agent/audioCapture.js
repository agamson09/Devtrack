const { spawn } = require('child_process')
const os = require('os')

class AudioCapture {
  constructor(ffmpegPath) {
    this.platform = os.platform()
    this.ffmpegPath = ffmpegPath || 'ffmpeg'
    this.captureProcess = null
    this.audioCallback = null
    this.isCapturing = false
    this.sampleRate = 48000
    this.channels = 2
  }

  startCapture(callback) {
    this.audioCallback = callback
    this.isCapturing = true

    let args = []

    if (this.platform === 'win32') {
      args = [
        '-f', 'dshow',
        '-i', 'audio=virtual-audio-capturer',
        '-ac', String(this.channels),
        '-ar', String(this.sampleRate),
        '-f', 'opus',
        '-b:a', '64k',
        '-vbr', 'on',
        'pipe:1'
      ]
    } else if (this.platform === 'darwin') {
      args = [
        '-f', 'avfoundation',
        '-i', ':0',
        '-ac', String(this.channels),
        '-ar', String(this.sampleRate),
        '-f', 'opus',
        '-b:a', '64k',
        'pipe:1'
      ]
    } else {
      args = [
        '-f', 'pulse',
        '-i', 'default',
        '-ac', String(this.channels),
        '-ar', String(this.sampleRate),
        '-f', 'opus',
        '-b:a', '64k',
        'pipe:1'
      ]
    }

    this.captureProcess = spawn(this.ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let buffer = Buffer.alloc(0)
    this.captureProcess.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      if (this.audioCallback && buffer.length > 100) {
        this.audioCallback(buffer)
        buffer = Buffer.alloc(0)
      }
    })

    this.captureProcess.on('exit', () => {
      this.isCapturing = false
    })

    this.captureProcess.on('error', (err) => {
      console.error('[Audio] Capture error:', err.message)
      this.isCapturing = false
    })
  }

  stopCapture() {
    if (this.captureProcess) {
      this.captureProcess.kill('SIGTERM')
      this.captureProcess = null
    }
    this.isCapturing = false
  }
}

module.exports = { AudioCapture }
