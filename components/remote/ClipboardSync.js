import { useState, useEffect, useRef } from 'react'

export default function ClipboardSync({ socket, connected, selectedDevice }) {
  const [enabled, setEnabled] = useState(false)
  const lastClipboardRef = useRef('')
  const isRemoteUpdate = useRef(false)

  useEffect(() => {
    if (!socket || !connected) return

    const onClipboard = (data) => {
      if (data.text && enabled && !isRemoteUpdate.current) {
        navigator.clipboard.writeText(data.text).then(() => {
          lastClipboardRef.current = data.text
        }).catch(() => {})
      }
    }

    socket.on('remote:clipboard', onClipboard)
    return () => socket.off('remote:clipboard', onClipboard)
  }, [socket, connected, enabled])

  useEffect(() => {
    if (!enabled || !connected || !selectedDevice) return

    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text && text !== lastClipboardRef.current && !isRemoteUpdate.current) {
          lastClipboardRef.current = text
          socket.emit('remote:clipboard-set', {
            deviceId: selectedDevice.id,
            text
          })
        }
      } catch {}
    }

    const interval = setInterval(checkClipboard, 1000)
    return () => clearInterval(interval)
  }, [enabled, connected, selectedDevice, socket])

  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-indigo-500"
      />
      <span className="text-gray-300 text-sm">Clipboard Sync</span>
    </label>
  )
}
