import { useRef, useEffect, useState, useCallback } from 'react'

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function VideoTile({ stream, name, isLocal, isMuted, isCameraOff, className }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  if (isCameraOff && !isLocal) {
    return (
      <div className={`bg-gray-800 rounded-xl flex flex-col items-center justify-center ${className}`}>
        <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold mb-2">
          {name ? name.charAt(0).toUpperCase() : '?'}
        </div>
        <p className="text-white text-sm font-medium">{name}</p>
        <p className="text-gray-400 text-xs mt-1">Camera off</p>
      </div>
    )
  }

  return (
    <div className={`relative rounded-xl overflow-hidden bg-gray-900 ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
        style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        {isMuted && (
          <div className="bg-red-500/80 rounded-full p-1">
            <i className="fa-solid fa-microphone-slash text-white text-xs"></i>
          </div>
        )}
        <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">{name}</span>
      </div>
    </div>
  )
}

function Ringtone({ enabled }) {
  const ctxRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ctx
      function playRing() {
        if (ctx.state === 'closed') return
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        osc1.type = 'sine'; osc1.frequency.value = 440
        osc2.type = 'sine'; osc2.frequency.value = 480
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
        osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination)
        osc1.start(ctx.currentTime); osc2.start(ctx.currentTime)
        osc1.stop(ctx.currentTime + 0.4); osc2.stop(ctx.currentTime + 0.4)
      }
      playRing()
      intervalRef.current = setInterval(playRing, 2000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        if (ctxRef.current && ctxRef.current.state !== 'closed') ctxRef.current.close().catch(() => {})
      }
    } catch (e) {}
  }, [enabled])

  return null
}

function IncomingRingtone() {
  const ctxRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ctx
      function playRing() {
        if (ctx.state === 'closed') return
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        osc1.type = 'sine'; osc1.frequency.value = 440
        osc2.type = 'sine'; osc2.frequency.value = 480
        gain.gain.setValueAtTime(0.4, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination)
        osc1.start(ctx.currentTime); osc2.start(ctx.currentTime)
        osc1.stop(ctx.currentTime + 0.5); osc2.stop(ctx.currentTime + 0.5)
      }
      playRing()
      intervalRef.current = setInterval(playRing, 2000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        if (ctxRef.current && ctxRef.current.state !== 'closed') ctxRef.current.close().catch(() => {})
      }
    } catch (e) {}
  }, [])

  return null
}

function IncomingCallModal({ callData, onAccept, onReject }) {
  const [isRinging, setIsRinging] = useState(true)
  useEffect(() => { return () => setIsRinging(false) }, [])
  if (!callData) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]">
      <IncomingRingtone />
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm border border-gray-700 text-center shadow-2xl">
        <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 animate-pulse">
          {callData.fromName ? callData.fromName.charAt(0).toUpperCase() : '?'}
        </div>
        <h3 className="text-white text-xl font-bold mb-1">{callData.fromName || 'Unknown'}</h3>
        <p className="text-gray-400 text-sm mb-1">Incoming {callData.type || 'video'} call...</p>
        <div className="flex items-center justify-center gap-1 mb-8">
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
        <div className="flex gap-4 justify-center">
          <button onClick={onReject} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg">
            <i className="fa-solid fa-phone-slash text-white text-xl"></i>
          </button>
          <button onClick={onAccept} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg animate-pulse">
            <i className="fa-solid fa-phone text-white text-xl"></i>
          </button>
        </div>
        <p className="text-gray-500 text-xs mt-4">{callData.type === 'voice' ? 'Voice' : 'Video'} Call</p>
      </div>
    </div>
  )
}

function CallControls({ isMuted, isCameraOff, isScreenSharing, callType, onToggleMute, onToggleCamera, onToggleScreenShare, onEndCall, onMinimize }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onToggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`} title={isMuted ? 'Unmute' : 'Mute'}>
        <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-white`}></i>
      </button>
      {callType === 'video' && (
        <button onClick={onToggleCamera} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCameraOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`} title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}>
          <i className={`fa-solid ${isCameraOff ? 'fa-video-slash' : 'fa-video'} text-white`}></i>
        </button>
      )}
      {callType === 'video' && (
        <button onClick={onToggleScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`} title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
          <i className="fa-solid fa-desktop text-white"></i>
        </button>
      )}
      <button onClick={onMinimize} className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors" title="Minimize">
        <i className="fa-solid fa-minus text-white"></i>
      </button>
      <button onClick={onEndCall} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors" title="End call">
        <i className="fa-solid fa-phone-slash text-white text-lg"></i>
      </button>
    </div>
  )
}

function CallingAnimation({ name }) {
  return (
    <div className="text-center">
      <div className="relative w-28 h-28 mx-auto mb-4">
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"></div>
        <div className="absolute inset-2 rounded-full bg-indigo-500/30 animate-ping" style={{ animationDelay: '0.5s' }}></div>
        <div className="relative w-28 h-28 rounded-full bg-indigo-600 flex items-center justify-center text-white text-5xl font-bold">
          {name ? name.charAt(0).toUpperCase() : '?'}
        </div>
      </div>
      <h3 className="text-white text-2xl font-bold mb-2">{name}</h3>
      <p className="text-indigo-400 text-sm animate-pulse">Calling...</p>
      <div className="flex items-center justify-center gap-1 mt-3">
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></span>
      </div>
    </div>
  )
}

function ConnectingAnimation({ name }) {
  return (
    <div className="text-center">
      <div className="relative w-28 h-28 mx-auto mb-4">
        <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse"></div>
        <div className="relative w-28 h-28 rounded-full bg-indigo-600 flex items-center justify-center text-white text-5xl font-bold">
          {name ? name.charAt(0).toUpperCase() : '?'}
        </div>
      </div>
      <h3 className="text-white text-2xl font-bold mb-2">{name}</h3>
      <p className="text-green-400 text-sm">Connecting...</p>
    </div>
  )
}

function MiniCallPlayer({ callState, callType, callDuration, remoteUserName, localStream, remoteStream, isMuted, isCameraOff, onRestore, onEndCall }) {
  const [position, setPosition] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 300 : 0, y: typeof window !== 'undefined' ? window.innerHeight - 200 : 0 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const miniVideoRef = useRef(null)
  const miniAudioRef = useRef(null)

  useEffect(() => {
    if (miniVideoRef.current && remoteStream && callType === 'video') {
      miniVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream, callType])

  useEffect(() => {
    if (miniAudioRef.current && remoteStream) {
      miniAudioRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  const getClientPos = (e) => {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    return { x: e.clientX, y: e.clientY }
  }

  const handleStart = useCallback((e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    const pos = getClientPos(e)
    setDragging(true)
    dragOffset.current = { x: pos.x - position.x, y: pos.y - position.y }
  }, [position])

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e) => {
      const pos = getClientPos(e)
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 280, pos.x - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 120, pos.y - dragOffset.current.y)),
      })
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [dragging])

  return (
    <div
      className="fixed z-[59] shadow-2xl border border-gray-600 rounded-xl overflow-hidden bg-gray-900 select-none"
      style={{ left: position.x, top: position.y, width: 280, cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      <audio ref={miniAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Video or avatar */}
      <div className="relative w-full h-48 bg-gray-900">
        {callType === 'video' ? (
          <video ref={miniVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
              {remoteUserName ? remoteUserName.charAt(0).toUpperCase() : '?'}
            </div>
          </div>
        )}

        {/* Overlay info */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
          <span className="text-white text-[10px] font-medium bg-black/50 px-1.5 py-0.5 rounded">{formatDuration(callDuration)}</span>
        </div>

        {/* Name label */}
        <div className="absolute bottom-2 left-2">
          <span className="text-white text-xs bg-black/50 px-2 py-0.5 rounded-full">{remoteUserName}</span>
        </div>
      </div>

      {/* Mini controls */}
      <div className="flex items-center justify-center gap-2 py-2 px-3 bg-gray-800 border-t border-gray-700">
        <button onClick={onEndCall} className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors" title="End call">
          <i className="fa-solid fa-phone-slash text-white text-xs"></i>
        </button>
        <button onClick={onRestore} className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors" title="Restore">
          <i className="fa-solid fa-expand text-white text-xs"></i>
        </button>
      </div>
    </div>
  )
}

export default function CallModal({
  callState,
  callType,
  localStream,
  remoteStream,
  remoteUserName,
  isMuted,
  isCameraOff,
  isScreenSharing,
  callDuration,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
}) {
  const remoteAudioRef = useRef(null)
  const [minimized, setMinimized] = useState(false)
  const showRinging = callState === 'calling'

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  if (callState === 'idle') {
    if (minimized) setMinimized(false)
    return null
  }

  const showConnecting = callState === 'connecting'
  const showConnected = callState === 'connected'

  if (minimized) {
    return (
      <MiniCallPlayer
        callState={callState}
        callType={callType}
        callDuration={callDuration}
        remoteUserName={remoteUserName}
        localStream={localStream}
        remoteStream={remoteStream}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        onRestore={() => setMinimized(false)}
        onEndCall={onEndCall}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-950 z-[60] flex flex-col">
      <Ringtone enabled={showRinging} />
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
            {remoteUserName ? remoteUserName.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <p className="text-white font-semibold">{remoteUserName}</p>
            <p className="text-gray-400 text-xs">
              {callState === 'calling' && 'Calling...'}
              {callState === 'connecting' && 'Connecting...'}
              {callState === 'ringing' && 'Incoming call...'}
              {callState === 'connected' && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                  Connected - {formatDuration(callDuration)}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {callType === 'voice' && (
            <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-1 rounded-full">
              <i className="fa-solid fa-phone mr-1"></i>Voice
            </span>
          )}
          {callType === 'video' && (
            <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-1 rounded-full">
              <i className="fa-solid fa-video mr-1"></i>Video
            </span>
          )}
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center p-2 md:p-4 overflow-hidden min-h-0">
        {callType === 'video' ? (
          <div className="w-full h-full max-w-full relative">
            {showConnected ? (
              <>
                <VideoTile stream={remoteStream} name={remoteUserName} isLocal={false} className="w-full h-full" />
                <div className="absolute bottom-3 right-3 w-36 h-24 md:w-52 md:h-36 shadow-xl border border-gray-700">
                  <VideoTile stream={localStream} name="You" isLocal={true} isMuted={isMuted} isCameraOff={isCameraOff} className="w-full h-full" />
                </div>
              </>
            ) : (
              <>
                <VideoTile stream={localStream} name="You" isLocal={true} isMuted={isMuted} isCameraOff={isCameraOff} className="w-full h-full opacity-30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {showRinging && <CallingAnimation name={remoteUserName} />}
                  {showConnecting && <ConnectingAnimation name={remoteUserName} />}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center">
            {showRinging && <CallingAnimation name={remoteUserName} />}
            {showConnecting && <ConnectingAnimation name={remoteUserName} />}
            {showConnected && (
              <>
                <div className="w-28 h-28 rounded-full bg-indigo-600 flex items-center justify-center text-white text-5xl font-bold mx-auto mb-4">
                  {remoteUserName ? remoteUserName.charAt(0).toUpperCase() : '?'}
                </div>
                <h3 className="text-white text-2xl font-bold mb-2">{remoteUserName}</h3>
                <p className="text-gray-400">{formatDuration(callDuration)}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="text-green-400 text-sm">Connected</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center py-6 border-t border-gray-800 flex-shrink-0">
        <CallControls
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isScreenSharing={isScreenSharing}
          callType={callType}
          onToggleMute={onToggleMute}
          onToggleCamera={onToggleCamera}
          onToggleScreenShare={onToggleScreenShare}
          onEndCall={onEndCall}
          onMinimize={() => setMinimized(true)}
        />
      </div>
    </div>
  )
}

export { IncomingCallModal }
