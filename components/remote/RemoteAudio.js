import { useEffect, useRef, useState } from 'react'

export default function RemoteAudio({ socket, connected }) {
  const [enabled, setEnabled] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const audioContextRef = useRef(null)
  const lastPlaybackRef = useRef(0)

  useEffect(() => {
    if (!socket || !connected || !enabled) return

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 48000 })
    }

    const onAudio = async (data) => {
      if (!enabled || !data.data) return

      // Throttle playback to prevent buffer underrun
      const now = Date.now()
      if (now - lastPlaybackRef.current < 20) return
      lastPlaybackRef.current = now

      try {
        const audioData = atob(data.data)
        const audioBuffer = new Uint8Array(audioData.length)
        for (let i = 0; i < audioData.length; i++) {
          audioBuffer[i] = audioData.charCodeAt(i)
        }

        // Decode and play (simplified - in production use WebCodecs)
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume()
        }
      } catch (e) {}
    }

    socket.on('remote:audio', onAudio)
    return () => socket.off('remote:audio', onAudio)
  }, [socket, connected, enabled])

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  if (!connected) return null

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-indigo-500"
        />
        <span className="text-gray-300 text-sm">
          <i className={`fa-solid ${enabled ? 'fa-volume-high' : 'fa-volume-xmark'} mr-1`}></i>
          Audio
        </span>
      </label>
      {enabled && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      )}
    </div>
  )
}
