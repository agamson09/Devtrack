import { useState, useRef, useCallback, useEffect } from 'react'
import { ICE_SERVERS, getLocalMedia, getScreenMedia, createPeerConnection } from '@/lib/webrtc'

export default function useWebRTC(socket, localUserId) {
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

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const screenTrackRef = useRef(null)
  const durationIntervalRef = useRef(null)
  const callStartTimeRef = useRef(null)
  const remoteUserRef = useRef({ id: null, name: '' })
  const pendingOfferRef = useRef(null)
  const pendingIceRef = useRef([])
  const socketRef = useRef(socket)
  socketRef.current = socket
  const connectTimeoutRef = useRef(null)

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.getTracks().forEach(t => t.stop())
      screenTrackRef.current = null
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
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
    remoteUserRef.current = { id: null, name: '' }
  }, [])

  const drainPendingIce = useCallback((pc) => {
    if (pendingIceRef.current.length > 0) {
      pendingIceRef.current.forEach(async (candidate) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error('Buffered ICE candidate error:', err)
        }
      })
      pendingIceRef.current = []
    }
  }, [])

  const setupPeerConnection = useCallback((stream, targetUserId, targetUserName) => {
    const pc = createPeerConnection()
    pcRef.current = pc

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream)
    })

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0])
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('call:ice-candidate', {
          to: targetUserId,
          candidate: event.candidate,
        })
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] connectionState:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        setCallState('connected')
        callStartTimeRef.current = Date.now()
        durationIntervalRef.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000))
        }, 1000)
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanup()
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] iceConnectionState:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        cleanup()
      }
    }

    pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] iceGatheringState:', pc.iceGatheringState)
    }

    pc.onsignalingstatechange = () => {
      console.log('[WebRTC] signalingState:', pc.signalingState)
    }

    return pc
  }, [cleanup])

  const startCall = useCallback(async (targetUserId, targetUserName, type = 'video') => {
    if (callState !== 'idle') return

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera/microphone access requires HTTPS.')
      return
    }

    try {
      const stream = await getLocalMedia(
        type === 'voice'
          ? { audio: true }
          : { audio: true, video: true }
      )
      localStreamRef.current = stream
      setLocalStream(stream)
      setCallType(type)
      setCallState('calling')
      setRemoteUserId(targetUserId)
      setRemoteUserName(targetUserName)
      remoteUserRef.current = { id: targetUserId, name: targetUserName }

      const pc = setupPeerConnection(stream, targetUserId, targetUserName)

      socket.emit('call:invite', {
        to: targetUserId,
        from: localUserId,
        type,
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('call:offer', { to: targetUserId, offer })

      connectTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling' || callStateRef.current === 'connecting') {
          console.warn('[WebRTC] Connection timeout after 30s')
          cleanup()
        }
      }, 30000)
    } catch (err) {
      console.error('Failed to start call:', err)
      cleanup()
    }
  }, [callState, localUserId, socket, setupPeerConnection, cleanup])

  const acceptCall = useCallback(async (callData) => {
    if (!callData) return
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera/microphone access requires HTTPS.')
      return
    }

    try {
      const stream = await getLocalMedia(
        callData.type === 'voice'
          ? { audio: true }
          : { audio: true, video: true }
      )
      localStreamRef.current = stream
      setLocalStream(stream)
      setCallType(callData.type)
      setCallState('connecting')
      setRemoteUserId(callData.from)
      setRemoteUserName(callData.fromName || 'User')
      remoteUserRef.current = { id: callData.from, name: callData.fromName || 'User' }
      setIncomingCall(null)

      socket.emit('call:accept', { to: callData.from })

      const pc = setupPeerConnection(stream, callData.from, callData.fromName || 'User')

      const offer = pendingOfferRef.current
      if (offer) {
        pendingOfferRef.current = null
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        drainPendingIce(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('call:answer', { to: callData.from, answer })
      } else {
        console.error('No pending offer to accept')
      }
    } catch (err) {
      console.error('Failed to accept call:', err)
      cleanup()
    }
  }, [socket, setupPeerConnection, cleanup])

  const rejectCall = useCallback(() => {
    if (incomingCall) {
      socket.emit('call:reject', { to: incomingCall.from })
      pendingOfferRef.current = null
      pendingIceRef.current = []
      setIncomingCall(null)
      setCallState('idle')
    }
  }, [incomingCall, socket])

  const endCall = useCallback(() => {
    if (remoteUserId || remoteUserRef.current.id) {
      socket.emit('call:end', { to: remoteUserId || remoteUserRef.current.id })
    }
    cleanup()
  }, [remoteUserId, socket, cleanup])

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }, [])

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsCameraOff(!videoTrack.enabled)
      }
    }
  }, [])

  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current || !localStreamRef.current) return

    if (isScreenSharing) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack && screenTrackRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video')
        if (sender) {
          await sender.replaceTrack(videoTrack)
        }
        screenTrackRef.current.getTracks().forEach(t => t.stop())
        screenTrackRef.current = null
        setIsScreenSharing(false)
        if (remoteUserRef.current.id) {
          socket.emit('call:screen-share', { to: remoteUserRef.current.id, sharing: false })
        }
      }
    } else {
      try {
        const screenStream = await getScreenMedia()
        const screenTrack = screenStream.getVideoTracks()[0]
        screenTrackRef.current = screenStream

        screenTrack.onended = () => {
          toggleScreenShare()
        }

        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video')
        if (sender) {
          await sender.replaceTrack(screenTrack)
        }
        setIsScreenSharing(true)
        if (remoteUserRef.current.id) {
          socket.emit('call:screen-share', { to: remoteUserRef.current.id, sharing: true })
        }
      } catch (err) {
        console.error('Screen share failed:', err)
      }
    }
  }, [isScreenSharing, socket])

  const callStateRef = useRef(callState)
  callStateRef.current = callState

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
    }

    const handleCallOffer = async (data) => {
      if (pcRef.current && (callStateRef.current === 'connected' || callStateRef.current === 'connecting')) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer))
          const answer = await pcRef.current.createAnswer()
          await pcRef.current.setLocalDescription(answer)
          socket.emit('call:answer', { to: data.from, answer })
        } catch (err) {
          console.error('Handle renegotiation offer error:', err)
        }
      } else {
        pendingOfferRef.current = data.offer
      }
    }

    const handleCallAnswer = async (data) => {
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
        } catch (err) {
          console.error('Handle answer error:', err)
        }
      }
    }

    const handleCallAccepted = (data) => {
      if (callStateRef.current === 'calling') {
        setCallState('connecting')
      }
    }

    const handleCallIceCandidate = async (data) => {
      if (pcRef.current && data.candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
        } catch (err) {
          console.error('ICE candidate error:', err)
        }
      } else if (data.candidate) {
        pendingIceRef.current.push(data.candidate)
      }
    }

    const handleCallEnd = () => {
      cleanup()
    }

    const handleCallRejected = () => {
      cleanup()
    }

    const handleCallScreenShare = (data) => {
      if (data.sharing) {
        console.log(`${remoteUserRef.current.name} started screen sharing`)
      } else {
        console.log(`${remoteUserRef.current.name} stopped screen sharing`)
      }
    }

    socket.on('call:invite', handleCallInvite)
    socket.on('call:offer', handleCallOffer)
    socket.on('call:answer', handleCallAnswer)
    socket.on('call:accepted', handleCallAccepted)
    socket.on('call:ice-candidate', handleCallIceCandidate)
    socket.on('call:end', handleCallEnd)
    socket.on('call:rejected', handleCallRejected)
    socket.on('call:screen-share', handleCallScreenShare)

    return () => {
      socket.off('call:invite', handleCallInvite)
      socket.off('call:offer', handleCallOffer)
      socket.off('call:answer', handleCallAnswer)
      socket.off('call:accepted', handleCallAccepted)
      socket.off('call:ice-candidate', handleCallIceCandidate)
      socket.off('call:end', handleCallEnd)
      socket.off('call:rejected', handleCallRejected)
      socket.off('call:screen-share', handleCallScreenShare)
    }
  }, [socket, cleanup])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    callState,
    callType,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    isScreenSharing,
    callDuration,
    remoteUserId,
    remoteUserName,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  }
}
