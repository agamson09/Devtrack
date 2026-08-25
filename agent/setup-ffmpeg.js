const { execSync } = require('child_process')
const os = require('os')
const fs = require('fs')
const path = require('path')

class FFmpegInstaller {
  constructor() {
    this.platform = os.platform()
    this.binDir = path.join(__dirname, 'bin')
    this.ffmpegPath = null
  }

  async install() {
    console.log('[FFmpeg] Checking installation...')

    if (this._checkSystemFFmpeg()) {
      console.log('[FFmpeg] Using system ffmpeg')
      this.ffmpegPath = this.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
      return true
    }

    const localPath = path.join(this.binDir, this.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
    if (fs.existsSync(localPath)) {
      console.log('[FFmpeg] Using local ffmpeg')
      this.ffmpegPath = localPath
      return true
    }

    console.log('[FFmpeg] Not found in system PATH')
    console.log('[FFmpeg] Please install ffmpeg manually:')
    console.log('[FFmpeg]   Windows: https://www.gyan.dev/ffmpeg/builds/')
    console.log('[FFmpeg]   macOS: brew install ffmpeg')
    console.log('[FFmpeg]   Linux: sudo apt install ffmpeg')
    console.log('[FFmpeg] Falling back to screenshot-desktop')
    return false
  }

  _checkSystemFFmpeg() {
    try {
      const cmd = this.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg'
      execSync(cmd, { stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  }

  get path() {
    return this.ffmpegPath || 'ffmpeg'
  }
}

module.exports = { FFmpegInstaller }
