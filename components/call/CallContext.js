import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '@/components/AuthContext'
import { ICE_SERVERS, getLocalMedia, createPeerConnection } from '@/lib/webrtc'

const CallContext = createContext(null)

export function useCall() {
  return useContext(CallContext)
}

export function CallProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)
  const [callState, setCallState] = useState('idle')
  const [callType, setCallType] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [remoteUserId, setRemoteUserId] = useState(null)
  const [remoteUserName, setRemoteUserName] = useState('')
  const [incomingCall, setIncomingCall] = useState(null)
  const [isMinimized, setIsMinimized] = useState(false)

  // Group call state
  const [groupCallState, setGroupCallState] = useState('idle')
  const [groupCallType, setGroupCallType] = useState(null)
  const [groupCallGroupId, setGroupCallGroupId] = useState(null)
  const [groupCallGroupName, setGroupCallGroupName] = useState('')
  const [groupCallMembers, setGroupCallMembers] = useState([])
  const [incomingGroupCall, setIncomingGroupCall] = useState(null)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const screenTrackRef = useRef(null)
  const durationIntervalRef = useRef(null)
  const callStartTimeRef = useRef(null)
  const remoteUserRef = useRef({ id: null, name: '' })
  const pendingOfferRef = useRef(null)
  const pendingIceRef = useRef([])
  const connectTimeoutRef = useRef(null)
  const callStateRef = useRef(callState)
  callStateRef.current = callState

  // Group call refs
  const groupPcsRef = useRef({}) // { userId: RTCPeerConnection }
  const groupLocalStreamRef = useRef(null)
  const groupCallStateRef = useRef(groupCallState)
  groupCallStateRef.current = groupCallState
  const groupCallGroupIdRef = useRef(groupCallGroupId)
  groupCallGroupIdRef.current = groupCallGroupId

  useEffect(() => {
    if (!user) return
    const s = io({ transports: ['websocket', 'polling'], withCredentials: true, auth: { token: localStorage.getItem('devtrack_socket_token') } })
    s.on('connect', () => {
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission() } catch {}
    })
    s.on('connect_error', (err) => {
      console.error('[CallSocket] Connection error:', err.message)
    })
    s.on('auth:error', (data) => {
      console.error('[CallSocket] Auth error from server:', data.message)
      localStorage.removeItem('devtrack_socket_token')
    })
    s.on('disconnect', (reason) => {
      console.warn('[CallSocket] Disconnected:', reason)
    })
    setSocket(s)
    return () => { s.disconnect(); setSocket(null) }
  }, [user])

  const cleanup = useCallback(() => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null }
    if (screenTrackRef.current) { screenTrackRef.current.getTracks().forEach(t => t.stop()); screenTrackRef.current = null }
    if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null }
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null }
    pendingOfferRef.current = null
    pendingIceRef.current = []
    setLocalStream(null)
    setRemoteStream(null)
    setCallState('idle')
    setCallType(null)
    setIsMuted(false)
    setIsCameraOff(false)
    setIsScreenSharing(false)
    setCallDuration(0)
    setRemoteUserId(null)
    setRemoteUserName('')
    setIncomingCall(null)
    setIsMinimized(false)
    remoteUserRef.current = { id: null, name: '' }
  }, [])

  const cleanupGroupCall = useCallback(() => {
    Object.values(groupPcsRef.current).forEach(pc => { try { pc.close() } catch {} })
    groupPcsRef.current = {}
    if (groupLocalStreamRef.current) { groupLocalStreamRef.current.getTracks().forEach(t => t.stop()); groupLocalStreamRef.current = null }
    setGroupCallState('idle')
    setGroupCallType(null)
    setGroupCallGroupId(null)
    setGroupCallGroupName('')
    setGroupCallMembers([])
    setIncomingGroupCall(null)
  }, [])

  const drainPendingIce = useCallback((pc) => {
    pendingIceRef.current.forEach(async (candidate) => {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
    })
    pendingIceRef.current = []
  }, [])

  const setupPeerConnection = useCallback((stream, targetUserId) => {
    const pc = createPeerConnection()
    pcRef.current = pc

    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) setRemoteStream(event.streams[0])
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:ice-candidate', { to: targetUserId, candidate: event.candidate })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (callStateRef.current === 'connecting') {
          setCallState('connected')
          callStartTimeRef.current = Date.now()
          durationIntervalRef.current = setInterval(() => {
            setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000))
          }, 1000)
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanup()
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') cleanup()
    }

    return pc
  }, [socket, cleanup])

  const startCall = useCallback(async (targetUserId, targetUserName, type = 'video') => {
    if (callState !== 'idle' || !socket) return
    if (!navigator.mediaDevices?.getUserMedia) { alert('Camera/microphone access requires HTTPS.'); return }

    try {
      const stream = await getLocalMedia(type === 'voice' ? { audio: true } : { audio: true, video: true })
      localStreamRef.current = stream
      setLocalStream(stream)
      setCallType(type)
      setCallState('calling')
      setRemoteUserId(targetUserId)
      setRemoteUserName(targetUserName)
      remoteUserRef.current = { id: targetUserId, name: targetUserName }

      const pc = setupPeerConnection(stream, targetUserId)
      socket.emit('call:invite', { to: targetUserId, from: user.id, fromName: user.name, type })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('call:offer', { to: targetUserId, offer })

      connectTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling' || callStateRef.current === 'connecting') cleanup()
      }, 30000)
    } catch (err) {
      console.error('Failed to start call:', err)
      cleanup()
    }
  }, [callState, socket, user, setupPeerConnection, cleanup])

  const acceptCall = useCallback(async (callData) => {
    if (!callData || !socket) return
    if (!navigator.mediaDevices?.getUserMedia) { alert('Camera/microphone access requires HTTPS.'); return }

    try {
      const stream = await getLocalMedia(callData.type === 'voice' ? { audio: true } : { audio: true, video: true })
      localStreamRef.current = stream
      setLocalStream(stream)
      setCallType(callData.type)
      setCallState('connecting')
      setRemoteUserId(callData.from)
      setRemoteUserName(callData.fromName || 'User')
      remoteUserRef.current = { id: callData.from, name: callData.fromName || 'User' }
      setIncomingCall(null)

      socket.emit('call:accept', { to: callData.from })
      const pc = setupPeerConnection(stream, callData.from)

      const offer = pendingOfferRef.current
      if (offer) {
        pendingOfferRef.current = null
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        drainPendingIce(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('call:answer', { to: callData.from, answer })
      }
    } catch (err) {
      console.error('Failed to accept call:', err)
      cleanup()
    }
  }, [socket, setupPeerConnection, cleanup, drainPendingIce])

  const rejectCall = useCallback(() => {
    if (incomingCall && socket) {
      socket.emit('call:reject', { to: incomingCall.from })
      pendingOfferRef.current = null
      pendingIceRef.current = []
      setIncomingCall(null)
      setCallState('idle')
    }
  }, [incomingCall, socket])

  const endCall = useCallback(() => {
    if ((remoteUserId || remoteUserRef.current.id) && socket) {
      socket.emit('call:end', { to: remoteUserId || remoteUserRef.current.id })
    }
    cleanup()
  }, [remoteUserId, socket, cleanup])

  const startGroupCall = useCallback(async (groupId, groupName, type = 'video', memberIds = []) => {
    if (groupCallStateRef.current !== 'idle' || !socket || !user) return
    if (!navigator.mediaDevices?.getUserMedia) { alert('Camera/microphone access requires HTTPS.'); return }

    try {
      const stream = await getLocalMedia(type === 'voice' ? { audio: true } : { audio: true, video: true })
      groupLocalStreamRef.current = stream
      setGroupCallType(type)
      setGroupCallState('ringing')
      setGroupCallGroupId(groupId)
      setGroupCallGroupName(groupName)
      setGroupCallMembers([{ id: user.id, name: user.name, stream, isSelf: true }])

      socket.emit('call:group-invite', { groupId, groupName, type, from: user.id, fromName: user.name, memberIds })

      connectTimeoutRef.current = setTimeout(() => {
        if (groupCallStateRef.current === 'ringing' || groupCallStateRef.current === 'connecting') cleanupGroupCall()
      }, 30000)
    } catch (err) {
      console.error('Failed to start group call:', err)
      cleanupGroupCall()
    }
  }, [socket, user, cleanupGroupCall])

  const acceptGroupCall = useCallback(async (callData) => {
    if (!callData || !socket || !user) return
    if (!navigator.mediaDevices?.getUserMedia) { alert('Camera/microphone access requires HTTPS.'); return }

    try {
      const stream = await getLocalMedia(callData.type === 'voice' ? { audio: true } : { audio: true, video: true })
      groupLocalStreamRef.current = stream
      setGroupCallType(callData.type)
      setGroupCallState('connecting')
      setGroupCallGroupId(callData.groupId)
      setGroupCallGroupName(callData.groupName)
      setGroupCallMembers([{ id: user.id, name: user.name, stream, isSelf: true }])
      setIncomingGroupCall(null)

      socket.emit('call:group-join', { groupId: callData.groupId, from: user.id, fromName: user.name, type: callData.type })
    } catch (err) {
      console.error('Failed to accept group call:', err)
      cleanupGroupCall()
    }
  }, [socket, user, cleanupGroupCall])

  const endGroupCall = useCallback(() => {
    if (groupCallGroupId && socket) {
      socket.emit('call:group-leave', { groupId: groupCallGroupId })
    }
    cleanupGroupCall()
  }, [groupCallGroupId, socket, cleanupGroupCall])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current || groupLocalStreamRef.current
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setIsMuted(!audioTrack.enabled) }
    }
  }, [])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current || groupLocalStreamRef.current
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) { videoTrack.enabled = !videoTrack.enabled; setIsCameraOff(!videoTrack.enabled) }
    }
  }, [])

  const toggleScreenShare = useCallback(async () => {
    const activePc = pcRef.current || Object.values(groupPcsRef.current)[0]
    const activeStream = localStreamRef.current || groupLocalStreamRef.current
    if (!activePc || !activeStream) return
    if (isScreenSharing) {
      const videoTrack = activeStream.getVideoTracks()[0]
      if (videoTrack && screenTrackRef.current) {
        const sender = activePc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(videoTrack)
        screenTrackRef.current.getTracks().forEach(t => t.stop())
        screenTrackRef.current = null
        setIsScreenSharing(false)
      }
    } else {
      try {
        const { getScreenMedia } = await import('@/lib/webrtc')
        const screenStream = await getScreenMedia()
        const screenTrack = screenStream.getVideoTracks()[0]
        screenTrackRef.current = screenStream
        screenTrack.onended = () => toggleScreenShare()

        if (groupCallStateRef.current !== 'idle' && Object.keys(groupPcsRef.current).length > 0) {
          for (const [peerId, pc] of Object.entries(groupPcsRef.current)) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video')
            if (sender) await sender.replaceTrack(screenTrack)
          }
        } else if (pcRef.current) {
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video')
          if (sender) await sender.replaceTrack(screenTrack)
        }
        setIsScreenSharing(true)
      } catch {}
    }
  }, [isScreenSharing])

  useEffect(() => {
    if (!socket) return

    const handleCallInvite = (data) => {
      pendingOfferRef.current = null
      pendingIceRef.current = []
      setIncomingCall(data)
      setCallState('ringing')
      setCallType(data.type)
      setRemoteUserId(data.from)
      setRemoteUserName(data.fromName || 'User')
      remoteUserRef.current = { id: data.from, name: data.fromName || 'User' }

      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const notif = new Notification(`Incoming ${data.type || 'video'} call`, {
            body: `${data.fromName || 'Someone'} is calling you...`,
            icon: '/favicon-white.webp',
            tag: `call-${data.from}`,
            requireInteraction: true,
          })
          notif.onclick = () => { window.focus(); notif.close() }
        }
      } catch {}
    }

    const handleCallOffer = async (data) => {
      if (pcRef.current && (callStateRef.current === 'connected' || callStateRef.current === 'connecting')) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer))
          const answer = await pcRef.current.createAnswer()
          await pcRef.current.setLocalDescription(answer)
          socket.emit('call:answer', { to: data.from, answer })
        } catch {}
      } else {
        pendingOfferRef.current = data.offer
      }
    }

    const handleCallAnswer = async (data) => {
      if (pcRef.current) {
        try { await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer)) } catch {}
      }
    }

    const handleCallAccepted = () => {
      if (callStateRef.current === 'calling') {
        setCallState('connected')
        callStartTimeRef.current = Date.now()
        durationIntervalRef.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000))
        }, 1000)
      }
    }

    const handleCallIceCandidate = async (data) => {
      if (pcRef.current && data.candidate) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)) } catch {}
      } else if (data.candidate) {
        pendingIceRef.current.push(data.candidate)
      }
    }

    socket.on('call:invite', handleCallInvite)
    socket.on('call:offer', handleCallOffer)
    socket.on('call:answer', handleCallAnswer)
    socket.on('call:accepted', handleCallAccepted)
    socket.on('call:ice-candidate', handleCallIceCandidate)
    socket.on('call:end', cleanup)
    socket.on('call:rejected', cleanup)

    // Group call events - store handlers for proper cleanup
    const handleGroupInvite = (data) => {
      pendingOfferRef.current = null
      pendingIceRef.current = []
      setIncomingGroupCall(data)
      setGroupCallState('ringing')
      setGroupCallType(data.type)
      setGroupCallGroupId(data.groupId)
      setGroupCallGroupName(data.groupName)

      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const notif = new Notification(`Incoming group ${data.type || 'video'} call`, {
            body: `${data.fromName || 'Someone'} is calling you in ${data.groupName || 'group'}...`,
            icon: '/favicon-white.webp',
            tag: `group-call-${data.groupId}`,
            requireInteraction: true,
          })
          notif.onclick = () => { window.focus(); notif.close() }
        }
      } catch {}
    }

    const handleGroupMemberJoined = async (data) => {
      if (!groupLocalStreamRef.current || !socket) return
      const peerId = data.userId
      if (peerId === user?.id) return

      const pc = createPeerConnection()
      groupPcsRef.current[peerId] = pc
      groupLocalStreamRef.current.getTracks().forEach(track => pc.addTrack(track, groupLocalStreamRef.current))

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setGroupCallMembers(prev => {
            const exists = prev.find(m => m.id === peerId)
            if (exists) return prev.map(m => m.id === peerId ? { ...m, stream: event.streams[0] } : m)
            return [...prev, { id: peerId, name: data.userName, stream: event.streams[0] }]
          })
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) socket.emit('call:group-ice-candidate', { groupId: groupCallGroupIdRef.current, to: peerId, candidate: event.candidate })
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setGroupCallState('connected')
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setGroupCallMembers(prev => prev.filter(m => m.id !== peerId))
          delete groupPcsRef.current[peerId]
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('call:group-offer', { groupId: groupCallGroupIdRef.current, to: peerId, from: user.id, fromName: user.name, offer })
    }

    const handleGroupOffer = async (data) => {
      if (!groupLocalStreamRef.current || !socket) return
      const peerId = data.from

      const pc = createPeerConnection()
      groupPcsRef.current[peerId] = pc
      groupLocalStreamRef.current.getTracks().forEach(track => pc.addTrack(track, groupLocalStreamRef.current))

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setGroupCallMembers(prev => {
            const exists = prev.find(m => m.id === peerId)
            if (exists) return prev.map(m => m.id === peerId ? { ...m, stream: event.streams[0] } : m)
            return [...prev, { id: peerId, name: data.fromName, stream: event.streams[0] }]
          })
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) socket.emit('call:group-ice-candidate', { groupId: data.groupId, to: peerId, candidate: event.candidate })
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setGroupCallState('connected')
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setGroupCallMembers(prev => prev.filter(m => m.id !== peerId))
          delete groupPcsRef.current[peerId]
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('call:group-answer', { groupId: data.groupId, to: peerId, from: user.id, answer })
    }

    const handleGroupAnswer = async (data) => {
      const pc = groupPcsRef.current[data.from]
      if (pc) try { await pc.setRemoteDescription(new RTCSessionDescription(data.answer)) } catch {}
    }

    const handleGroupIceCandidate = async (data) => {
      const pc = groupPcsRef.current[data.from]
      if (pc && data.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)) } catch {}
      } else if (data.candidate) {
        pendingIceRef.current.push(data.candidate)
      }
    }

    const handleGroupMemberLeft = (data) => {
      const pc = groupPcsRef.current[data.userId]
      if (pc) { try { pc.close() } catch {} delete groupPcsRef.current[data.userId] }
      setGroupCallMembers(prev => prev.filter(m => m.id !== data.userId))
    }

    socket.on('call:group-invite', handleGroupInvite)
    socket.on('call:group-member-joined', handleGroupMemberJoined)
    socket.on('call:group-offer', handleGroupOffer)
    socket.on('call:group-answer', handleGroupAnswer)
    socket.on('call:group-ice-candidate', handleGroupIceCandidate)
    socket.on('call:group-member-left', handleGroupMemberLeft)
    socket.on('call:group-end', cleanupGroupCall)

    return () => {
      socket.off('call:invite', handleCallInvite)
      socket.off('call:offer', handleCallOffer)
      socket.off('call:answer', handleCallAnswer)
      socket.off('call:accepted', handleCallAccepted)
      socket.off('call:ice-candidate', handleCallIceCandidate)
      socket.off('call:end', cleanup)
      socket.off('call:rejected', cleanup)
      socket.off('call:group-invite', handleGroupInvite)
      socket.off('call:group-member-joined', handleGroupMemberJoined)
      socket.off('call:group-offer', handleGroupOffer)
      socket.off('call:group-answer', handleGroupAnswer)
      socket.off('call:group-ice-candidate', handleGroupIceCandidate)
      socket.off('call:group-member-left', handleGroupMemberLeft)
      socket.off('call:group-end', cleanupGroupCall)
    }
  }, [socket, cleanup, cleanupGroupCall, user])

  useEffect(() => () => cleanup(), [cleanup])

  const value = {
    socket,
    callState, callType, localStream, remoteStream,
    isMuted, isCameraOff, isScreenSharing, callDuration,
    remoteUserId, remoteUserName, incomingCall, isMinimized,
    setIsMinimized,
    startCall, acceptCall, rejectCall, endCall,
    toggleMute, toggleCamera, toggleScreenShare,
    groupCallState, groupCallType, groupCallGroupId, groupCallGroupName, groupCallMembers, incomingGroupCall,
    startGroupCall, acceptGroupCall, endGroupCall, cleanupGroupCall,
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}
