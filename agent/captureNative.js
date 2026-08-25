const { execSync, spawn } = require('child_process')
const os = require('os')
const path = require('path')
const fs = require('fs')

class NativeCapture {
  constructor(ffmpegPath) {
    this.platform = os.platform()
    this.ffmpegPath = ffmpegPath || 'ffmpeg'
    this.captureProcess = null
    this.frameCallback = null
    this.isCapturing = false
  }

  async captureFrameJPEG(quality = 60) {
    if (this.platform === 'win32') {
      return this._captureWindowsJPEG(quality)
    } else if (this.platform === 'darwin') {
      return this._captureMacJPEG(quality)
    } else if (this.platform === 'linux') {
      return this._captureLinuxJPEG(quality)
    }
    throw new Error('Unsupported platform')
  }

  _captureWindowsJPEG(quality) {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$s = [System.Windows.Forms.Screen]::PrimaryScreen
$b = New-Object System.Drawing.Bitmap($s.Bounds.Width, $s.Bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($b)
$g.CopyFromScreen($s.Bounds.Location, [System.Drawing.Point]::Empty, $s.Bounds.Size)
$stream = New-Object System.IO.MemoryStream
$b.Save($stream, [System.Drawing.Imaging.ImageFormat]::Jpeg)
[Convert]::ToBase64String($stream.ToArray())
$stream.Dispose(); $g.Dispose(); $b.Dispose()`

    const psPath = path.join(os.tmpdir(), 'devtrack-capture.ps1')
    fs.writeFileSync(psPath, psScript, 'utf8')

    try {
      const result = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${psPath}"`,
        { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString().trim()
      return Buffer.from(result, 'base64')
    } finally {
      try { fs.unlinkSync(psPath) } catch {}
    }
  }

  _captureMacJPEG(quality) {
    const tmpPath = path.join(os.tmpdir(), 'devtrack-ss.jpg')
    execSync(`screencapture -x -t jpg "${tmpPath}"`, { timeout: 5000, stdio: 'pipe' })
    const buf = fs.readFileSync(tmpPath)
    try { fs.unlinkSync(tmpPath) } catch {}
    return buf
  }

  _captureLinuxJPEG(quality) {
    const tmpPath = path.join(os.tmpdir(), 'devtrack-ss.jpg')
    execSync(`import -window root "${tmpPath}"`, { timeout: 5000, stdio: 'pipe' })
    const buf = fs.readFileSync(tmpPath)
    try { fs.unlinkSync(tmpPath) } catch {}
    return buf
  }

  startH264Capture(callback, options = {}) {
    const fps = options.fps || 30
    const quality = options.quality || 23

    let args = []

    if (this.platform === 'win32') {
      args = [
        '-f', 'gdigrab',
        '-framerate', String(fps),
        '-i', 'desktop',
        '-vcodec', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-crf', String(quality),
        '-pix_fmt', 'yuv420p',
        '-f', 'mpegts',
        'pipe:1'
      ]
    } else if (this.platform === 'darwin') {
      args = [
        '-f', 'avfoundation',
        '-framerate', String(fps),
        '-i', '1',
        '-vcodec', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-crf', String(quality),
        '-pix_fmt', 'yuv420p',
        '-f', 'mpegts',
        'pipe:1'
      ]
    } else if (this.platform === 'linux') {
      const display = process.env.DISPLAY || ':0'
      args = [
        '-f', 'x11grab',
        '-framerate', String(fps),
        '-i', display,
        '-vcodec', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-crf', String(quality),
        '-pix_fmt', 'yuv420p',
        '-f', 'mpegts',
        'pipe:1'
      ]
    }

    this.captureProcess = spawn(this.ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.frameCallback = callback
    this.isCapturing = true

    let buffer = Buffer.alloc(0)

    this.captureProcess.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])

      let lastStart = -1
      for (let i = 0; i < buffer.length - 3; i++) {
        if (buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0 && buffer[i + 3] === 1) {
          if (lastStart >= 0) {
            const nalUnit = buffer.slice(lastStart, i)
            if (this.frameCallback) {
              this.frameCallback(nalUnit)
            }
          }
          lastStart = i
        }
      }
      if (lastStart >= 0) {
        buffer = buffer.slice(lastStart)
      }
    })

    this.captureProcess.on('exit', () => {
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

module.exports = { NativeCapture }
