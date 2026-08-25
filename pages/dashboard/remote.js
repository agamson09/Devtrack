import { useState, useEffect, useRef, useCallback } from 'react'
import Layout from '@/components/layout/Layout'
import Loading from '@/components/common/Loading'
import DeviceList from '@/components/remote/DeviceList'
import Viewer from '@/components/remote/Viewer'
import Controls from '@/components/remote/Controls'
import FileTransfer from '@/components/remote/FileTransfer'
import SessionRecorder from '@/components/remote/SessionRecorder'
import ClipboardSync from '@/components/remote/ClipboardSync'
import RemoteAudio from '@/components/remote/RemoteAudio'
import { useCall } from '@/components/call/CallContext'

export default function RemoteDesktopPage() {
  const { socket } = useCall()
  const [devices, setDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [connected, setConnected] = useState(false)
  const [frame, setFrame] = useState(null)
  const [fps, setFps] = useState(0)
  const [latency, setLatency] = useState(0)
  const [recording, setRecording] = useState(false)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [transportMode, setTransportMode] = useState('websocket')
  const [socketError, setSocketError] = useState(null)
  // AnyDesk-style pairing
  const [pairDeviceId, setPairDeviceId] = useState('')
  const [pairPassword, setPairPassword] = useState('')
  const [pairing, setPairing] = useState(false)
  const [pairStatus, setPairStatus] = useState(null) // { type: 'success'|'error'|'approval', message: '' }

  const frameCountRef = useRef(0)
  const fpsIntervalRef = useRef(null)
  const lastFrameTsRef = useRef(0)

  // Use the shared socket from CallContext
  useEffect(() => {
    if (!socket) {
      setLoading(false)
      setSocketError('Socket not available. Please refresh the page.')
      return
    }

    window.__remoteSocket = socket
    
    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setLoading(false)
      console.warn('[Remote] Timeout: device list not received, stopping loading')
    }, 8000)

    let deviceListReceived = false
    
    const onDeviceList = (data) => {
      deviceListReceived = true
      clearTimeout(loadingTimeout)
      setDevices(data.devices || [])
      setLoading(false)
      setSocketError(null)
    }
    const onAgentOnline = (data) => {
      setDevices(prev => {
        const exists = prev.find(d => d.id === data.id)
        if (exists) return prev
        return [...prev, data]
      })
    }
    const onAgentOffline = (data) => {
      setDevices(prev => prev.filter(d => d.id !== data.id))
    }
    const onFrame = (data) => {
      if (!data || !data.frame) return
      frameCountRef.current++
      setFrame(data.frame)
      lastFrameTsRef.current = data.ts
      if (data.size) {
        const diff = Date.now() - data.ts
        setLatency(diff)
      }
    }
    const onError = (data) => {
      setConnected(false)
      setSelectedDevice(null)
    }

    const onDisconnect = (reason) => {
      console.warn('[Remote] Socket disconnected:', reason)
      clearTimeout(loadingTimeout)
      if (!deviceListReceived) {
        setDevices([])
        setLoading(false)
        setSocketError(`Koneksi terputus: ${reason}. Coba refresh halaman.`)
      }
      setConnected(false)
      setFrame(null)
    }

    const onConnectError = (err) => {
      console.error('[Remote] Socket connect error:', err.message)
      clearTimeout(loadingTimeout)
      setLoading(false)
      setSocketError(`Gagal koneksi ke server: ${err.message}. Silakan login ulang.`)
    }

    const onPaired = (data) => {
      setPairing(false)
      if (data.success) {
        setPairStatus({ type: 'success', message: `Connected to ${data.device?.name || 'device'}` })
        setSelectedDevice({ id: data.device?.sessionId, name: data.device?.name, ...data.device })
        setConnected(true)
        setFrame(null)
        frameCountRef.current = 0
      }
    }
    const onPairError = (data) => {
      setPairing(false)
      setPairStatus({ type: 'error', message: data.error || 'Pairing failed' })
    }
    const onApprovalPending = (data) => {
      setPairing(false)
      setPairStatus({ type: 'approval', message: data.message || 'Waiting for approval...' })
    }

    socket.on('remote:device-list', onDeviceList)
    socket.on('remote:agent-online', onAgentOnline)
    socket.on('remote:agent-offline', onAgentOffline)
    socket.on('remote:frame', onFrame)
    socket.on('remote:error', onError)
    socket.on('remote:paired', onPaired)
    socket.on('remote:pair-error', onPairError)
    socket.on('remote:approval-pending', onApprovalPending)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)

    // If socket is already connected, check if it's really connected
    const requestDeviceList = () => {
      if (socket.connected) {
        console.log('[Remote] Socket connected, requesting device list, id:', socket.id)
        socket.emit('remote:device-list')
      }
    }

    if (socket.connected) {
      console.log('[Remote] Socket already connected, id:', socket.id)
      requestDeviceList()
    } else {
      console.log('[Remote] Socket not yet connected, waiting...')
      const onConnect = () => {
        console.log('[Remote] Socket connected, id:', socket.id)
        setSocketError(null)
        requestDeviceList()
      }
      socket.on('connect', onConnect)
      
      // Also try after a short delay in case connection is slow
      setTimeout(requestDeviceList, 1000)
    }

    // Request device list immediately
    socket.emit('remote:device-list')

    fpsIntervalRef.current = setInterval(() => {
      setFps(frameCountRef.current)
      frameCountRef.current = 0
    }, 1000)

    // Also poll via REST API as fallback
    const fetchDevicesFallback = async () => {
      try {
        const res = await fetch('/api/remote/devices')
        if (res.ok) {
          const data = await res.json()
          if (data.devices && !deviceListReceived) {
            clearTimeout(loadingTimeout)
            setDevices(data.devices)
            setLoading(false)
            deviceListReceived = true
          }
        }
      } catch (e) {
        console.error('[Remote] Fallback fetch failed:', e)
      }
    }
    
    // Try fallback after 2 seconds if socket hasn't responded
    const fallbackTimeout = setTimeout(fetchDevicesFallback, 2000)

    return () => {
      clearTimeout(loadingTimeout)
      clearTimeout(fallbackTimeout)
      clearInterval(fpsIntervalRef.current)
      socket.off('remote:device-list', onDeviceList)
      socket.off('remote:agent-online', onAgentOnline)
      socket.off('remote:agent-offline', onAgentOffline)
      socket.off('remote:frame', onFrame)
      socket.off('remote:error', onError)
      socket.off('remote:paired', onPaired)
      socket.off('remote:pair-error', onPairError)
      socket.off('remote:approval-pending', onApprovalPending)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('reconnect')
    }
  }, [socket])

  // Fetch active sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/remote/sessions')
        const data = await res.json()
        setSessions(data.sessions || [])
      } catch {}
    }
    fetchSessions()
    const interval = setInterval(fetchSessions, 5000)
    return () => clearInterval(interval)
  }, [])

  // Handle device selection
  const handleSelectDevice = useCallback((device) => {
    setSelectedDevice(device)
  }, [])

  // Handle connect
  const handleConnect = useCallback(() => {
    if (!selectedDevice || !socket) return
    socket.emit('remote:start', {
      deviceId: selectedDevice.id,
      record: recording
    })
    setConnected(true)
    setFrame(null)
    frameCountRef.current = 0

    // Log session
    fetch('/api/remote/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', deviceId: selectedDevice.id, deviceName: selectedDevice.name, recording })
    })
  }, [selectedDevice, recording])

  // Handle AnyDesk-style pairing
  const handlePair = useCallback(async () => {
    if (!pairDeviceId.trim()) {
      setPairStatus({ type: 'error', message: 'Device ID is required' })
      return
    }
    setPairing(true)
    setPairStatus(null)
    try {
      const res = await fetch('/api/remote/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: pairDeviceId.trim(),
          password: pairPassword || undefined
        })
      })
      const data = await res.json()
      if (data.success && data.paired) {
        // Auto-approved with password
        setPairing(false)
        setPairStatus({ type: 'success', message: `Connected to ${data.device?.name}` })
        setSelectedDevice({ id: data.device?.sessionId, name: data.device?.name, ...data.device })
        setConnected(true)
        setFrame(null)
        frameCountRef.current = 0
      } else if (data.mode === 'approval_required') {
        // Waiting for approval
        setPairStatus({ type: 'approval', message: data.message || 'Waiting for approval from remote user...' })
      } else if (data.error) {
        if (data.requiresPassword) {
          setPairStatus({ type: 'password_required', message: data.error })
        } else {
          setPairing(false)
          setPairStatus({ type: 'error', message: data.error })
        }
      }
    } catch (err) {
      setPairing(false)
      setPairStatus({ type: 'error', message: 'Failed to connect: ' + err.message })
    }
  }, [pairDeviceId, pairPassword])

  // Handle disconnect
  const handleDisconnect = useCallback(() => {
    if (!selectedDevice || !socket) return
    socket.emit('remote:stop', { deviceId: selectedDevice.id })
    setConnected(false)
    setFrame(null)
    setFps(0)
    setLatency(0)

    fetch('/api/remote/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' })
    })
  }, [selectedDevice])

  // Mouse event handlers
  const lastMouseSentRef = useRef(0)
  const handleMouseMove = useCallback((pos) => {
    if (!connected || !selectedDevice || !socket) return
    const now = Date.now()
    if (now - lastMouseSentRef.current < 30) return
    lastMouseSentRef.current = now
    socket.emit('remote:mouse', {
      deviceId: selectedDevice.id,
      ...pos,
      type: 'move'
    })
  }, [connected, selectedDevice])

  const handleMouseDown = useCallback((data) => {
    if (!connected || !selectedDevice || !socket) return
    socket.emit('remote:mouse', {
      deviceId: selectedDevice.id,
      ...data,
      type: 'mousedown'
    })
  }, [connected, selectedDevice])

  const handleMouseUp = useCallback((data) => {
    if (!connected || !selectedDevice || !socket) return
    socket.emit('remote:mouse', {
      deviceId: selectedDevice.id,
      ...data,
      type: 'mouseup'
    })
  }, [connected, selectedDevice])

  const handleWheel = useCallback((data) => {
    if (!connected || !selectedDevice || !socket) return
    socket.emit('remote:mouse', {
      deviceId: selectedDevice.id,
      ...data,
      type: 'scroll'
    })
  }, [connected, selectedDevice])

  // Keyboard event handlers
  const handleKeyDown = useCallback((data) => {
    if (!connected || !selectedDevice || !socket) return
    socket.emit('remote:keyboard', {
      deviceId: selectedDevice.id,
      ...data,
      type: 'keydown'
    })
  }, [connected, selectedDevice])

  const handleKeyUp = useCallback((data) => {
    if (!connected || !selectedDevice || !socket) return
    socket.emit('remote:keyboard', {
      deviceId: selectedDevice.id,
      ...data,
      type: 'keyup'
    })
  }, [connected, selectedDevice])

  // Screenshot
  const handleScreenshot = useCallback(() => {
    if (!frame) return
    const link = document.createElement('a')
    link.download = `screenshot-${selectedDevice?.name || 'remote'}-${Date.now()}.jpg`
    link.href = 'data:image/jpeg;base64,' + frame
    link.click()
  }, [frame, selectedDevice])

  // Toggle record
  const handleToggleRecord = useCallback(() => {
    setRecording(prev => !prev)
  }, [])

  if (loading) return <Layout><Loading /></Layout>

  return (
    <Layout>
      <div className="p-6">
        {socketError && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-xl flex items-center gap-3">
            <i className="fa-solid fa-triangle-exclamation text-red-400 text-lg"></i>
            <div className="flex-1">
              <p className="text-red-300 text-sm">{socketError}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-white text-xs transition-colors"
            >
              <i className="fa-solid fa-refresh mr-1"></i> Reload
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Remote Desktop</h1>
            <p className="text-gray-400 text-sm mt-1">
              {devices.length} device(s) online
              {connected && selectedDevice && (
                <span className="ml-2">
                  <span className="text-green-400">Connected</span> to {selectedDevice.name}
                  <span className="ml-2 text-gray-500">| {fps} FPS | {latency}ms</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    transportMode === 'webrtc' ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'
                  }`}>
                    {transportMode === 'webrtc' ? 'WebRTC' : 'WebSocket'}
                  </span>
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => socket?.emit('remote:device-list')}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
            >
              <i className="fa-solid fa-refresh mr-1"></i> Refresh
            </button>
            {!connected && selectedDevice && (
              <button
                onClick={handleConnect}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium transition-colors"
              >
                <i className="fa-solid fa-play mr-1"></i> Connect
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* AnyDesk-style Quick Connect */}
            {!connected && (
              <div className="bg-gray-800 rounded-xl border border-indigo-500/30 p-4">
                <h3 className="text-white font-semibold text-sm mb-3">
                  <i className="fa-solid fa-link mr-2 text-indigo-400"></i>
                  Quick Connect
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Device ID</label>
                    <input
                      type="text"
                      value={pairDeviceId}
                      onChange={(e) => setPairDeviceId(e.target.value)}
                      placeholder="e.g. A4 B1 C2"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none font-mono tracking-wider"
                      onKeyDown={(e) => e.key === 'Enter' && handlePair()}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Password (optional)</label>
                    <input
                      type="password"
                      value={pairPassword}
                      onChange={(e) => setPairPassword(e.target.value)}
                      placeholder="Unattended access password"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handlePair()}
                    />
                  </div>
                  <button
                    onClick={handlePair}
                    disabled={pairing || !pairDeviceId.trim()}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
                  >
                    {pairing ? (
                      <><i className="fa-solid fa-spinner fa-spin mr-1"></i> Connecting...</>
                    ) : (
                      <><i className="fa-solid fa-plug mr-1"></i> Connect</>
                    )}
                  </button>
                  {pairStatus && (
                    <div className={`p-2 rounded-lg text-xs ${
                      pairStatus.type === 'success' ? 'bg-green-900/30 text-green-400 border border-green-700' :
                      pairStatus.type === 'approval' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700' :
                      pairStatus.type === 'password_required' ? 'bg-blue-900/30 text-blue-400 border border-blue-700' :
                      'bg-red-900/30 text-red-400 border border-red-700'
                    }`}>
                      <i className={`fa-solid mr-1 ${
                        pairStatus.type === 'success' ? 'fa-check-circle' :
                        pairStatus.type === 'approval' ? 'fa-clock' :
                        pairStatus.type === 'password_required' ? 'fa-key' :
                        'fa-exclamation-circle'
                      }`}></i>
                      {pairStatus.message}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-white font-semibold text-sm mb-3">
                <i className="fa-solid fa-desktop mr-2 text-indigo-400"></i>
                Devices
              </h3>
              <DeviceList
                devices={devices}
                selectedDevice={selectedDevice}
                onSelect={handleSelectDevice}
                connected={connected}
              />
            </div>

            <SessionRecorder
              recording={recording}
              sessions={sessions}
              onToggleRecord={handleToggleRecord}
            />

            {connected && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-white font-semibold text-sm mb-3">
                  <i className="fa-solid fa-gear mr-2 text-indigo-400"></i>
                  Settings
                </h3>
                <div className="space-y-3">
                  <ClipboardSync
                    socket={socket}
                    connected={connected}
                    selectedDevice={selectedDevice}
                  />
                  <RemoteAudio
                    socket={socket}
                    connected={connected}
                  />
                </div>
              </div>
            )}

            {connected && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-white font-semibold text-sm mb-3">
                  <i className="fa-solid fa-file mr-2 text-indigo-400"></i>
                  File Transfer
                </h3>
                <FileTransfer
                  deviceId={selectedDevice?.id}
                  connected={connected}
                />
              </div>
            )}
          </div>

          {/* Main viewer */}
          <div className="lg:col-span-3 space-y-4">
            <div id="remote-viewer">
              <Controls
                connected={connected}
                device={selectedDevice}
                onDisconnect={handleDisconnect}
                onScreenshot={handleScreenshot}
                recording={recording}
                onToggleRecord={handleToggleRecord}
              />

              <div className="mt-4">
                <Viewer
                  frame={frame}
                  connected={connected}
                  onMouseMove={handleMouseMove}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onWheel={handleWheel}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

// Skip static pre-rendering (uses client-side socket)
export async function getServerSideProps() {
  return { props: {} }
}
