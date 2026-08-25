const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
}

const MSG_TYPES = {
  FRAME: 0x01,
  CLIPBOARD: 0x02,
  INPUT: 0x03,
  AUDIO: 0x04,
  CONTROL: 0x05
}

class RemoteDataChannel {
  constructor(socket, config = {}) {
    this.socket = socket
    this.pc = null
    this.dc = null
    this.mode = 'websocket'
    this.deviceId = null
    this.viewerId = null

    this.onFrame = config.onFrame || (() => {})
    this.onInput = config.onInput || (() => {})
    this.onClipboard = config.onClipboard || (() => {})
    this.onAudio = config.onAudio || (() => {})
    this.onControl = config.onControl || (() => {})
    this.onConnectionChange = config.onConnectionChange || (() => {})

    this.maxBufferedAmount = 5 * 1024 * 1024
    this.bufferedAmountLowThreshold = 65536

    this._handleOffer = this._handleOffer.bind(this)
    this._handleAnswer = this._handleAnswer.bind(this)
    this._handleIceCandidate = this._handleIceCandidate.bind(this)
  }

  attachSocket() {
    this.socket.on('remote:webrtc-offer', this._handleOffer)
    this.socket.on('remote:webrtc-answer', this._handleAnswer)
    this.socket.on('remote:webrtc-ice-candidate', this._handleIceCandidate)
  }

  detachSocket() {
    this.socket.off('remote:webrtc-offer', this._handleOffer)
    this.socket.off('remote:webrtc-answer', this._handleAnswer)
    this.socket.off('remote:webrtc-ice-candidate', this._handleIceCandidate)
  }

  async connectToDevice(deviceId) {
    this.deviceId = deviceId
    this.mode = 'webrtc'

    const pc = new RTCPeerConnection(ICE_SERVERS)
    this.pc = pc

    this.dc = pc.createDataChannel('remote-desktop', {
      ordered: false,
      maxRetransmits: 1
    })
    this._setupChannelEvents()

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket.emit('remote:webrtc-ice-candidate', {
          deviceId,
          candidate: e.candidate
        })
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      this.onConnectionChange(state)
      if (state === 'failed' || state === 'disconnected') {
        this._fallBackToWebSocket()
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    this.socket.emit('remote:webrtc-offer', { deviceId, offer })
    return true
  }

  async _handleOffer(data) {
    const { viewerId, offer } = data
    this.viewerId = viewerId

    const pc = new RTCPeerConnection(ICE_SERVERS)
    this.pc = pc

    pc.ondatachannel = (event) => {
      this.dc = event.channel
      this._setupChannelEvents()
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket.emit('remote:webrtc-ice-candidate', {
          viewerId,
          candidate: e.candidate
        })
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    this.socket.emit('remote:webrtc-answer', { viewerId, answer })
  }

  async _handleAnswer(data) {
    const { answer } = data
    if (this.pc) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer))
    }
  }

  _handleIceCandidate(data) {
    const { candidate, deviceId, viewerId } = data
    if (this.pc && candidate) {
      this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
    }
  }

  _setupChannelEvents() {
    const dc = this.dc
    dc.binaryType = 'arraybuffer'

    dc.onopen = () => {
      this.mode = 'webrtc'
      this.onConnectionChange('webrtc')
    }

    dc.onmessage = (event) => {
      const data = new Uint8Array(event.data)
      if (data.length < 1) return

      const msgType = data[0]
      const payload = data.slice(1)

      switch (msgType) {
        case MSG_TYPES.FRAME:
          this.onFrame(payload)
          break
        case MSG_TYPES.CLIPBOARD:
          try {
            this.onClipboard(JSON.parse(new TextDecoder().decode(payload)))
          } catch {}
          break
        case MSG_TYPES.INPUT:
          try {
            this.onInput(JSON.parse(new TextDecoder().decode(payload)))
          } catch {}
          break
        case MSG_TYPES.AUDIO:
          this.onAudio(payload)
          break
        case MSG_TYPES.CONTROL:
          try {
            this.onControl(JSON.parse(new TextDecoder().decode(payload)))
          } catch {}
          break
      }
    }

    dc.onclose = () => {
      this._fallBackToWebSocket()
    }

    dc.onerror = () => {
      this._fallBackToWebSocket()
    }
  }

  sendFrame(buffer) {
    if (this.dc && this.dc.readyState === 'open') {
      if (this.dc.bufferedAmount > this.maxBufferedAmount) {
        return false
      }
      const packet = new Uint8Array(1 + buffer.byteLength)
      packet[0] = MSG_TYPES.FRAME
      packet.set(new Uint8Array(buffer), 1)
      this.dc.send(packet)
      return true
    }
    return false
  }

  sendInput(event) {
    if (this.dc && this.dc.readyState === 'open') {
      const json = new TextEncoder().encode(JSON.stringify(event))
      const packet = new Uint8Array(1 + json.byteLength)
      packet[0] = MSG_TYPES.INPUT
      packet.set(json, 1)
      this.dc.send(packet)
      return true
    }
    return false
  }

  sendClipboard(data) {
    if (this.dc && this.dc.readyState === 'open') {
      const json = new TextEncoder().encode(JSON.stringify(data))
      const packet = new Uint8Array(1 + json.byteLength)
      packet[0] = MSG_TYPES.CLIPBOARD
      packet.set(json, 1)
      this.dc.send(packet)
      return true
    }
    return false
  }

  sendAudio(buffer) {
    if (this.dc && this.dc.readyState === 'open') {
      const packet = new Uint8Array(1 + buffer.byteLength)
      packet[0] = MSG_TYPES.AUDIO
      packet.set(new Uint8Array(buffer), 1)
      this.dc.send(packet)
      return true
    }
    return false
  }

  sendControl(data) {
    if (this.dc && this.dc.readyState === 'open') {
      const json = new TextEncoder().encode(JSON.stringify(data))
      const packet = new Uint8Array(1 + json.byteLength)
      packet[0] = MSG_TYPES.CONTROL
      packet.set(json, 1)
      this.dc.send(packet)
      return true
    }
    return false
  }

  _fallBackToWebSocket() {
    if (this.mode === 'websocket') return
    this.mode = 'websocket'
    this.onConnectionChange('websocket')
  }

  get isConnected() {
    return this.dc && this.dc.readyState === 'open'
  }

  destroy() {
    if (this.dc) {
      try { this.dc.close() } catch {}
    }
    if (this.pc) {
      try { this.pc.close() } catch {}
    }
    this.dc = null
    this.pc = null
    this.mode = 'websocket'
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RemoteDataChannel, MSG_TYPES, ICE_SERVERS }
}
