const { execSync, spawn } = require('child_process')
const os = require('os')
const crypto = require('crypto')

class ClipboardMonitor {
  constructor() {
    this.platform = os.platform()
    this.lastHash = null
    this.pollInterval = null
    this.onChange = null
    this.maxSize = 1024 * 1024
    this.isMonitoring = false
  }

  start(callback, intervalMs = 500) {
    this.onChange = callback
    this.isMonitoring = true

    this.pollInterval = setInterval(() => {
      if (!this.isMonitoring) return

      const content = this._read()
      if (content && content.hash !== this.lastHash) {
        this.lastHash = content.hash
        if (this.onChange) {
          this.onChange({
            text: content.text,
            type: 'text',
            length: content.text.length
          })
        }
      }
    }, intervalMs)
  }

  stop() {
    this.isMonitoring = false
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  _read() {
    try {
      let text = ''

      if (this.platform === 'win32') {
        text = execSync(
          'powershell -NoProfile -Command "Get-Clipboard -Format Text"',
          { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString().trim()
      } else if (this.platform === 'darwin') {
        text = execSync('pbpaste', { timeout: 3000, stdio: 'pipe' }).toString()
      } else if (this.platform === 'linux') {
        text = execSync('xclip -selection clipboard -o', { timeout: 3000, stdio: 'pipe' }).toString()
      }

      if (text.length > this.maxSize) {
        return { text: '[Content too large]', hash: 'large' }
      }

      return { text, hash: this._hash(text) }
    } catch {
      return null
    }
  }

  write(text) {
    try {
      if (this.platform === 'win32') {
        const escaped = text.replace(/'/g, "''")
        execSync(
          `powershell -NoProfile -Command "Set-Clipboard -Value '${escaped}'"`,
          { timeout: 3000, stdio: 'pipe' }
        )
      } else if (this.platform === 'darwin') {
        const proc = spawn('pbcopy', [], { stdio: ['pipe', 'ignore', 'ignore'] })
        proc.stdin.write(text)
        proc.stdin.end()
      } else if (this.platform === 'linux') {
        const proc = spawn('xclip', ['-selection', 'clipboard'], {
          stdio: ['pipe', 'ignore', 'ignore']
        })
        proc.stdin.write(text)
        proc.stdin.end()
      }
      this.lastHash = this._hash(text)
    } catch (e) {
      console.error('[Clipboard] Write failed:', e.message)
    }
  }

  _hash(str) {
    return crypto.createHash('md5').update(str).digest('hex')
  }
}

module.exports = { ClipboardMonitor }
