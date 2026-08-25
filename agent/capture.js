const os = require('os')
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

let nodeScreenshots = null
let nodeScreenshotsFailed = false
try {
  nodeScreenshots = require('node-screenshots')
} catch (e) {
  console.log('[capture] node-screenshots not available')
}

let screenshotDesktop = null
try {
  screenshotDesktop = require('screenshot-desktop')
} catch (e) {
  console.log('[capture] screenshot-desktop not available')
}

let koffiUser32, koffiGdi32
let koffiSetProcessDPIAware, koffiGetSystemMetrics
let koffiFindWindow, koffiGetDC, koffiReleaseDC
let koffiCreateCompatibleDC, koffiCreateCompatibleBitmap
let koffiSelectObject, koffiBitBlt, koffiPrintWindow
let koffiDeleteDC, koffiDeleteObject, koffiGetDIBits
let koffiGetDesktopWindow, koffiGetWindowRect

try {
  const koffi = require('koffi')
  koffiUser32 = koffi.load('user32.dll')
  koffiGdi32 = koffi.load('gdi32.dll')

  koffiSetProcessDPIAware = koffiUser32.func('SetProcessDPIAware', 'bool', [])
  koffiGetSystemMetrics = koffiUser32.func('GetSystemMetrics', 'int', ['int'])
  koffiGetDesktopWindow = koffiUser32.func('GetDesktopWindow', 'void*', [])
  koffiFindWindow = koffiUser32.func('FindWindowA', 'void*', ['str', 'str'])
  koffiGetDC = koffiUser32.func('GetDC', 'void*', ['void*'])
  koffiReleaseDC = koffiUser32.func('ReleaseDC', 'int', ['void*', 'void*'])
  koffiPrintWindow = koffiUser32.func('PrintWindow', 'bool', ['void*', 'void*', 'uint32'])
  koffiGetWindowRect = koffiUser32.func('GetWindowRect', 'bool', ['void*', 'void*'])

  koffiCreateCompatibleDC = koffiGdi32.func('CreateCompatibleDC', 'void*', ['void*'])
  koffiCreateCompatibleBitmap = koffiGdi32.func('CreateCompatibleBitmap', 'void*', ['void*', 'int', 'int'])
  koffiSelectObject = koffiGdi32.func('SelectObject', 'void*', ['void*', 'void*'])
  koffiBitBlt = koffiGdi32.func('BitBlt', 'bool', ['void*', 'int', 'int', 'int', 'int', 'void*', 'int', 'int', 'uint32'])
  koffiDeleteDC = koffiGdi32.func('DeleteDC', 'bool', ['void*'])
  koffiDeleteObject = koffiGdi32.func('DeleteObject', 'bool', ['void*'])
  koffiGetDIBits = koffiGdi32.func('GetDIBits', 'int', ['void*', 'void*', 'uint32', 'uint32', 'void*', 'void*', 'uint32'])

  koffiSetProcessDPIAware()
  console.log('[capture] koffi loaded (DPI aware)')
} catch (e) {
  console.log('[capture] koffi not available:', e.message)
}

function runPS(script) {
  const psPath = path.join(os.tmpdir(), `dt-${Date.now()}-${Math.random().toString(36).slice(2,6)}.ps1`)
  try {
    fs.writeFileSync(psPath, script, 'utf8')
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${psPath}"`,
      { timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim()
    return result
  } finally {
    try { fs.unlinkSync(psPath) } catch {}
  }
}

function detectHeadless() {
  if (os.platform() !== 'win32') return false
  try {
    const count = runPS(`Add-Type -AssemblyName System.Windows.Forms; Write-Output ([System.Windows.Forms.Screen]::AllScreens.Length)`)
    const n = parseInt(count, 10)
    if (n <= 0) {
      console.log('[capture] ========================================')
      console.log('[capture] HEADLESS detected - no monitor/virtual display')
      console.log('[capture] Install Virtual Display Driver:')
      console.log('[capture]   1. Download from: https://github.com/VirtualDrivers/Virtual-Display-Driver/releases')
      console.log('[capture]   2. Run install-vdd.bat as Administrator')
      console.log('[capture]   3. Restart this agent')
      console.log('[capture] Or use: HDMI dummy plug (~$3)')
      console.log('[capture] ========================================')
      return true
    }
    console.log('[capture] Displays:', n)
    return false
  } catch {
    return false
  }
}

async function captureScreen() {
  if (os.platform() === 'win32') return captureWindows()
  if (os.platform() === 'darwin') return captureMac()
  throw new Error('Unsupported platform')
}

// Track if we're running on a virtual/headless display
let VIRTUAL_DISPLAY = null
let HEADLESS_MODE = false

// Auto-detect on first capture
function detectVirtualDisplay() {
  if (VIRTUAL_DISPLAY !== null) return VIRTUAL_DISPLAY
  try {
    const count = runPS(`Add-Type -AssemblyName System.Windows.Forms; Write-Output ([System.Windows.Forms.Screen]::AllScreens.Length)`)
    const n = parseInt(count, 10)
    HEADLESS_MODE = (n <= 0)
    // Check if any display has a non-standard name (virtual driver)
    const displayInfo = runPS(`Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name`)
    VIRTUAL_DISPLAY = displayInfo && (
      displayInfo.toLowerCase().includes('iddsample') ||
      displayInfo.toLowerCase().includes('virtual')
    )
    console.log(`[capture] Display detection: ${n} displays, virtual=${VIRTUAL_DISPLAY}, headless=${HEADLESS_MODE}`)
  } catch {
    VIRTUAL_DISPLAY = false
    HEADLESS_MODE = false
  }
  return VIRTUAL_DISPLAY
}

async function captureWindows() {
  detectVirtualDisplay()
  const isHeadless = VIRTUAL_DISPLAY || HEADLESS_MODE

  // For virtual display mode, use higher quality (70 vs 60 default)
  const defaultQuality = isHeadless ? 70 : 60

  // Method 1: screenshot-desktop npm package (best compatibility)
  if (screenshotDesktop) {
    try {
      const buf = await screenshotDesktop({ format: 'jpg', quality: defaultQuality })
      if (buf && buf.length > 100) return buf
    } catch (e) {
      console.log('[capture] screenshot-desktop failed:', e.message)
    }
  }

  // Method 2: koffi PrintWindow (captures DWM composition)
  if (koffiPrintWindow) {
    try {
      const buf = captureViaPrintWindow()
      if (buf && buf.length > 100) return buf
    } catch (e) {
      console.log('[capture] PrintWindow failed:', e.message)
    }
  }

  // Method 3: node-screenshots (DXGI) - skip if previously failed
  if (nodeScreenshots && !nodeScreenshotsFailed) {
    try {
      const monitors = nodeScreenshots.Monitor.all()
      const primary = monitors.find(m => m.isPrimary()) || monitors[0]
      if (primary) {
        const image = primary.captureImageSync()
        const buf = image.toJpegSync(60)
        if (buf && buf.length > 100) return buf
      }
    } catch (e) {
      nodeScreenshotsFailed = true
      console.log('[capture] node-screenshots disabled:', e.message)
    }
  }

  // Method 4: Native C# EXE (no PowerShell, no antivirus issues)
  try {
    return captureWin32Native()
  } catch (e) {
    console.log('[capture] Native capture failed:', e.message)
  }

  // Method 5: PowerShell fallback (may be blocked by antivirus)
  try {
    return captureWin32PS()
  } catch (e) {
    console.log('[capture] Win32 PS failed:', e.message)
  }

  throw new Error('All capture methods failed')
}

function captureViaPrintWindow() {
  const PW_RENDERFULLCONTENT = 0x00000002

  const w = koffiGetSystemMetrics(0)
  const h = koffiGetSystemMetrics(1)
  if (w <= 0 || h <= 0) throw new Error(`Invalid metrics: ${w}x${h}`)

  const hwnd = koffiGetDesktopWindow()
  if (!hwnd) throw new Error('GetDesktopWindow failed')

  const hdcScreen = koffiGetDC(hwnd)
  if (!hdcScreen) throw new Error('GetDC failed')

  const hdcMem = koffiCreateCompatibleDC(hdcScreen)
  const hBmp = koffiCreateCompatibleBitmap(hdcScreen, w, h)
  const hOld = koffiSelectObject(hdcMem, hBmp)

  const ok = koffiPrintWindow(hwnd, hdcMem, PW_RENDERFULLCONTENT)

  if (!ok) {
    koffiSelectObject(hdcMem, hOld)
    koffiDeleteObject(hBmp)
    koffiDeleteDC(hdcMem)
    koffiReleaseDC(hwnd, hdcScreen)
    throw new Error('PrintWindow returned false')
  }

  koffiSelectObject(hdcMem, hOld)

  const BITMAPINFOHEADER_SIZE = 40
  const biBuf = Buffer.alloc(BITMAPINFOHEADER_SIZE)
  biBuf.writeUInt32LE(BITMAPINFOHEADER_SIZE, 0)
  biBuf.writeInt32LE(w, 4)
  biBuf.writeInt32LE(-h, 8)
  biBuf.writeUInt16LE(1, 12)
  biBuf.writeUInt16LE(32, 14)
  biBuf.writeUInt32LE(0, 16)

  const rowSize = Math.ceil((w * 4) / 4) * 4
  const imgSize = rowSize * h
  const pixelBuf = Buffer.alloc(imgSize)

  koffiGetDIBits(hdcScreen, hBmp, 0, h, pixelBuf, biBuf, 0)

  koffiDeleteObject(hBmp)
  koffiDeleteDC(hdcMem)
  koffiReleaseDC(hwnd, hdcScreen)

  if (pixelBuf.every(b => b === 0)) throw new Error('PrintWindow returned black pixels')

  const bmpFile = path.join(os.tmpdir(), `dt-pw-${Date.now()}.bmp`)
  const jpgFile = path.join(os.tmpdir(), `dt-pw-${Date.now()}.jpg`)

  const bmpHeader = Buffer.alloc(54)
  bmpHeader.write('BM', 0)
  bmpHeader.writeUInt32LE(54 + imgSize, 2)
  bmpHeader.writeUInt32LE(54, 10)
  bmpHeader.writeUInt32LE(BITMAPINFOHEADER_SIZE, 14)
  bmpHeader.writeInt32LE(w, 18)
  bmpHeader.writeInt32LE(h, 22)
  bmpHeader.writeUInt16LE(1, 26)
  bmpHeader.writeUInt16LE(32, 28)
  bmpHeader.writeUInt32LE(imgSize, 34)

  fs.writeFileSync(bmpFile, Buffer.concat([bmpHeader, pixelBuf]))

  try {
    runPS(`
Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
$b = [System.Drawing.Bitmap]::FromFile('${bmpFile.replace(/\\/g, '\\\\')}')
$ep = New-Object System.Drawing.Imaging.ImageCodecParameter([System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()[1], 60L)
$p = New-Object System.Drawing.Imaging.EncoderParameters(1)
$p.Param[0] = $ep
$b.Save('${jpgFile.replace(/\\/g, '\\\\')}', $p)
$b.Dispose()
`)
  } finally {
    try { fs.unlinkSync(bmpFile) } catch {}
  }

  if (fs.existsSync(jpgFile)) {
    const buf = fs.readFileSync(jpgFile)
    try { fs.unlinkSync(jpgFile) } catch {}
    return buf
  }
  throw new Error('BMP to JPEG conversion failed')
}

function captureWin32Native() {
  // Use compiled C# EXE for screen capture (avoids PowerShell/antivirus issues)
  const exePath = path.join(__dirname, 'capture-native', 'capture.exe')
  
  if (!fs.existsSync(exePath)) {
    console.log('[capture] capture.exe not found, falling back to PowerShell')
    return captureWin32PS()
  }
  
  const tmpFile = path.join(os.tmpdir(), `dt-ss-${Date.now()}.jpg`)
  
  try {
    const result = execSync(
      `"${exePath}" "${tmpFile}" 60`,
      { timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim()
    
    // Result should be the output file path
    const outputFile = result || tmpFile
    
    if (fs.existsSync(outputFile)) {
      const buf = fs.readFileSync(outputFile)
      try { fs.unlinkSync(outputFile) } catch {}
      if (buf.length > 100) return buf
    }
  } catch (e) {
    console.log('[capture] capture.exe failed:', e.message)
  }
  
  throw new Error('Native capture failed')
}

function captureWin32PS() {
  // Fallback: PowerShell script (may be blocked by antivirus)
  const script = `
Add-Type -AssemblyName System.Drawing -ErrorAction Stop
Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$w = $screen.Width; $h = $screen.Height
if ($w -le 0) { $w = 1920 }
if ($h -le 0) { $h = 1080 }

$bitmap = New-Object System.Drawing.Bitmap($w, $h)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen(0, 0, 0, 0, $bitmap.Size)

$f = [IO.Path]::Combine([IO.Path]::GetTempPath(), "dt-ss.jpg")
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParam = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParam.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]60)
$bitmap.Save($f, $encoder, $encoderParam)

$graphics.Dispose()
$bitmap.Dispose()

Write-Output $f
`
  const result = runPS(script)
  const tmpFile = result || path.join(os.tmpdir(), 'dt-ss.jpg')
  if (fs.existsSync(tmpFile)) {
    const buf = fs.readFileSync(tmpFile)
    try { fs.unlinkSync(tmpFile) } catch {}
    if (buf.length > 100) return buf
  }
  throw new Error('Win32 PS capture empty')
}

function captureMac() {
  const tmpPath = path.join(os.tmpdir(), 'devtrack-ss.jpg')
  execSync(`screencapture -x -t jpg "${tmpPath}"`, { timeout: 5000, stdio: 'pipe' })
  const buf = fs.readFileSync(tmpPath)
  try { fs.unlinkSync(tmpPath) } catch {}
  return buf
}

function getScreenResolution() {
  try {
    if (os.platform() === 'win32') {
      if (koffiGetSystemMetrics) {
        const w = koffiGetSystemMetrics(0)
        const h = koffiGetSystemMetrics(1)
        if (w > 0 && h > 0) return { width: w, height: h }
      }
      if (nodeScreenshots) {
        const monitors = nodeScreenshots.Monitor.all()
        const primary = monitors.find(m => m.isPrimary()) || monitors[0]
        if (primary) return { width: primary.width, height: primary.height }
      }
      const result = runPS(`Add-Type -AssemblyName System.Windows.Forms; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; Write-Output "$($b.Width)x$($b.Height)"`)
      const match = result.match(/(\d+)x(\d+)/)
      return { width: match ? parseInt(match[1]) : 1920, height: match ? parseInt(match[2]) : 1080 }
    }
  } catch (e) {
    console.log('[capture] Resolution detection failed:', e.message)
  }
  return { width: 1920, height: 1080 }
}

module.exports = { captureScreen, getScreenResolution, detectHeadless }
