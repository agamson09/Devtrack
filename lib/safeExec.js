import { spawn } from 'child_process'

export function safeExec(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      timeout: options.timeout || 30000,
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
      env: { ...process.env, ...options.env },
      cwd: options.cwd || undefined,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code })
      } else {
        const err = new Error(`Command failed with code ${code}: ${stderr.trim()}`)
        err.code = code
        err.stdout = stdout.trim()
        err.stderr = stderr.trim()
        reject(err)
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}

export function safeExecStream(command, args = [], options = {}) {
  const proc = spawn(command, args, {
    timeout: options.timeout || 30000,
    env: { ...process.env, ...options.env },
    cwd: options.cwd || undefined,
  })
  return proc
}
