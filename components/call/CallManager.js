import { useCall } from '@/components/call/CallContext'
import { useRef, useEffect } from 'react'

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function VideoTile({ stream, name, isLocal, isMuted: muted, className }) {
  const videoRef = useRef(null)
  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream }, [stream])
  return (
    <div className={`relative rounded-xl overflow-hidden bg-gray-900 ${className || ''}`}>
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }} />
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        {muted && <div className="bg-red-500/80 rounded-full p-1"><i className="fa-solid fa-microphone-slash text-white text-xs"></i></div>}
        <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">{name}</span>
      </div>
    </div>
  )
}

function RemoteAudio({ stream }) {
  const audioRef = useRef(null)
  useEffect(() => { if (audioRef.current && stream) audioRef.current.srcObject = stream }, [stream])
  return <audio ref={audioRef} autoPlay playsInline className="hidden" />
}

function IncomingRingtone({ stop }) {
  const ctxRef = useRef(null)
  const intervalRef = useRef(null)
  const stopRef = useRef(stop)
  stopRef.current = stop

  useEffect(() => {
    if (stop) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      if (ctxRef.current && ctxRef.current.state !== 'closed') { ctxRef.current.close().catch(() => {}); ctxRef.current = null }
      return
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ctx
      const playRing = () => {
        if (stopRef.current || ctx.state === 'closed') return
        const o1 = ctx.createOscillator(); const o2 = ctx.createOscillator()
        const gain = ctx.createGain()
        o1.type = 'sine'; o1.frequency.value = 440; o2.type = 'sine'; o2.frequency.value = 480
        gain.gain.setValueAtTime(0.4, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        o1.connect(gain); o2.connect(gain); gain.connect(ctx.destination)
        o1.start(ctx.currentTime); o2.start(ctx.currentTime)
        o1.stop(ctx.currentTime + 0.5); o2.stop(ctx.currentTime + 0.5)
      }
      playRing()
      intervalRef.current = setInterval(playRing, 2000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {})
      }
    } catch {}
  }, [stop])
  return null
}

export default function CallManager() {
  const {
    callState, callType, localStream, remoteStream,
    isMuted, isCameraOff, isScreenSharing, callDuration,
    remoteUserName, incomingCall, isMinimized,
    setIsMinimized, acceptCall, rejectCall, endCall,
    toggleMute, toggleCamera, toggleScreenShare,
    groupCallState, groupCallType, groupCallGroupId, groupCallGroupName,
    groupCallMembers, incomingGroupCall,
    acceptGroupCall, endGroupCall,
  } = useCall()

  const showIncoming1on1 = callState === 'ringing' && !!incomingCall
  const showIncomingGroup = groupCallState === 'ringing' && !!incomingGroupCall
  const showCall1on1 = callState !== 'idle' && callState !== 'ringing' && !isMinimized
  const showCall1on1Mini = callState !== 'idle' && callState !== 'ringing' && isMinimized
  const showCallGroup = groupCallState !== 'idle' && !(groupCallState === 'ringing' && incomingGroupCall)

  if (!showCall1on1 && !showCall1on1Mini && !showCallGroup && !showIncoming1on1 && !showIncomingGroup) return null

  return (
    <>
      <RemoteAudio stream={remoteStream} />
      <IncomingRingtone stop={!showIncoming1on1 && !showIncomingGroup} />

      {/* === INCOMING 1-ON-1 CALL === */}
      {showIncoming1on1 && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]">
          <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm border border-gray-700 text-center shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 animate-pulse">
              {incomingCall.fromName ? incomingCall.fromName.charAt(0).toUpperCase() : '?'}
            </div>
            <h3 className="text-white text-xl font-bold mb-1">{incomingCall.fromName || 'Unknown'}</h3>
            <p className="text-gray-400 text-sm mb-1">Incoming {incomingCall.type || 'video'} call...</p>
            <div className="flex items-center justify-center gap-1 mb-8">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <div className="flex gap-4 justify-center">
              <button onClick={rejectCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg">
                <i className="fa-solid fa-phone-slash text-white text-xl"></i>
              </button>
              <button onClick={() => acceptCall(incomingCall)} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg animate-pulse">
                <i className="fa-solid fa-phone text-white text-xl"></i>
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-4">{callType === 'voice' ? 'Voice' : 'Video'} Call</p>
          </div>
        </div>
      )}

      {/* === 1-ON-1 CALL FULL VIEW === */}
      {showCall1on1 && (
        <div className="fixed inset-0 bg-gray-900 flex flex-col" style={{ zIndex: 60 }}>
          <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                {remoteUserName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-white font-medium">{remoteUserName}</p>
                <p className="text-gray-400 text-xs">
                  {callState === 'calling' && 'Calling...'}
                  {callState === 'connecting' && 'Connecting...'}
                  {callState === 'connected' && formatDuration(callDuration)}
                </p>
              </div>
            </div>
            <button onClick={() => setIsMinimized(true)} className="text-gray-400 hover:text-white p-2">
              <i className="fa-solid fa-minus"></i>
            </button>
          </div>

          <div className="flex-1 min-h-0 relative p-4">
            {callType === 'video' ? (
              <div className="w-full h-full relative">
                <VideoTile stream={remoteStream} name={remoteUserName} className="w-full h-full" />
                <div className="absolute bottom-4 right-4 w-36 h-24 md:w-52 md:h-36 rounded-xl overflow-hidden border-2 border-gray-700">
                  <VideoTile stream={localStream} name="You" isLocal isMuted={isMuted} className="w-full h-full" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-28 h-28 rounded-full bg-indigo-600 flex items-center justify-center text-white text-5xl font-bold mb-4">
                  {remoteUserName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <p className="text-white text-2xl font-bold mb-1">{remoteUserName}</p>
                <p className="text-indigo-400 text-sm">{formatDuration(callDuration)}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 p-4 border-t border-gray-700 flex-shrink-0">
            <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-white`}></i>
            </button>
            {callType === 'video' && (
              <button onClick={toggleCamera} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCameraOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                <i className={`fa-solid ${isCameraOff ? 'fa-video-slash' : 'fa-video'} text-white`}></i>
              </button>
            )}
            {callType === 'video' && (
              <button onClick={toggleScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                <i className="fa-solid fa-desktop text-white"></i>
              </button>
            )}
            <button onClick={endCall} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors">
              <i className="fa-solid fa-phone-slash text-white text-lg"></i>
            </button>
          </div>
        </div>
      )}

      {/* === 1-ON-1 CALL MINIMIZED (PiP) === */}
      {showCall1on1Mini && (
        <div className="fixed bottom-4 right-4 bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden" style={{ width: 280, zIndex: 59 }}>
          <div className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0">
              {remoteUserName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-medium truncate">{remoteUserName}</p>
              <p className="text-indigo-400 text-xs">{callState === 'connected' ? formatDuration(callDuration) : callState}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={toggleMute} className={`w-8 h-8 rounded-full flex items-center justify-center ${isMuted ? 'bg-red-500' : 'bg-gray-700'}`}>
                <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-white text-xs`}></i>
              </button>
              <button onClick={() => setIsMinimized(false)} className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <i className="fa-solid fa-expand text-white text-xs"></i>
              </button>
              <button onClick={endCall} className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                <i className="fa-solid fa-phone-slash text-white text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === INCOMING GROUP CALL === */}
      {showIncomingGroup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center" style={{ zIndex: 70 }}>
          <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm border border-gray-700 text-center shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 animate-pulse">
              <i className="fa-solid fa-users"></i>
            </div>
            <h3 className="text-white text-xl font-bold mb-1">{incomingGroupCall.groupName || 'Group Call'}</h3>
            <p className="text-gray-400 text-sm mb-1">{incomingGroupCall.fromName} is calling...</p>
            <p className="text-gray-500 text-xs mb-6">Group {incomingGroupCall.type || 'video'} call</p>
            <div className="flex gap-4 justify-center">
              <button onClick={endGroupCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg">
                <i className="fa-solid fa-phone-slash text-white text-xl"></i>
              </button>
              <button onClick={() => acceptGroupCall(incomingGroupCall)} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg animate-pulse">
                <i className="fa-solid fa-phone text-white text-xl"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === ACTIVE GROUP CALL === */}
      {showCallGroup && (
        <div className="fixed inset-0 bg-gray-900 flex flex-col" style={{ zIndex: 60 }}>
          <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white">
                <i className="fa-solid fa-users text-sm"></i>
              </div>
              <div>
                <p className="text-white font-medium">{groupCallGroupName}</p>
                <p className="text-gray-400 text-xs">
                  {groupCallState === 'ringing' && 'Calling...'}
                  {groupCallState === 'connecting' && 'Connecting...'}
                  {groupCallState === 'connected' && `${groupCallMembers.length} participant(s)`}
                </p>
              </div>
            </div>
            <button onClick={endGroupCall} className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm transition-colors">
              Leave Call
            </button>
          </div>

          <div className="flex-1 min-h-0 p-4 overflow-auto">
            <div className={`grid gap-3 h-full ${groupCallMembers.length <= 2 ? 'grid-cols-1 md:grid-cols-2' : groupCallMembers.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
              {groupCallMembers.map((member) => (
                <VideoTile key={member.id} stream={member.stream} name={member.name || 'User'} isLocal={member.isSelf} className="min-h-[150px]" />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 p-4 border-t border-gray-700 flex-shrink-0">
            <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`} title={isMuted ? 'Unmute' : 'Mute'}>
              <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-white`}></i>
            </button>
            {groupCallType === 'video' && (
              <button onClick={toggleCamera} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCameraOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`} title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}>
                <i className={`fa-solid ${isCameraOff ? 'fa-video-slash' : 'fa-video'} text-white`}></i>
              </button>
            )}
            {groupCallType === 'video' && (
              <button onClick={toggleScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`} title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
                <i className="fa-solid fa-desktop text-white"></i>
              </button>
            )}
            <button onClick={endGroupCall} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors" title="Leave call">
              <i className="fa-solid fa-phone-slash text-white text-lg"></i>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
