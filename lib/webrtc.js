export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    ...(process.env.NEXT_PUBLIC_TURN_URL
      ? [{ urls: process.env.NEXT_PUBLIC_TURN_URL, username: process.env.NEXT_PUBLIC_TURN_USER || '', credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '' }]
      : []),
  ],
}

export const MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 24 },
  },
}

export const SCREEN_SHARE_CONSTRAINTS = {
  video: {
    cursor: 'always',
    displaySurface: 'monitor',
  },
  audio: false,
}

export function createPeerConnection(config = ICE_SERVERS) {
  const pc = new RTCPeerConnection(config)
  return pc
}

export async function getLocalMedia(constraints = MEDIA_CONSTRAINTS) {
  return navigator.mediaDevices.getUserMedia(constraints)
}

export async function getScreenMedia() {
  return navigator.mediaDevices.getDisplayMedia(SCREEN_SHARE_CONSTRAINTS)
}
