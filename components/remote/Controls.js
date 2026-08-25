import { useState } from 'react'

export default function Controls({ connected, device, onDisconnect, onScreenshot, recording, onToggleRecord }) {
  const [fullscreen, setFullscreen] = useState(false)

  const toggleFullscreen = () => {
    const el = document.getElementById('remote-viewer')
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        setFullscreen(true)
        el.style.background = '#000'
      }).catch(() => {})
    } else {
      document.exitFullscreen().then(() => {
        setFullscreen(false)
        el.style.background = ''
      }).catch(() => {})
    }
  }

  const sendCtrlAltDel = () => {
    // This will be handled by the parent via keyboard event
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'delete', ctrlKey: true, altKey: true, bubbles: true
    }))
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {connected && device && (
        <>
          <div className="flex items-center gap-2 mr-4">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-white text-sm font-medium">{device.name}</span>
            <span className="text-gray-400 text-xs">({device.ip})</span>
          </div>

          <button
            onClick={onScreenshot}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs font-medium transition-colors"
            title="Take Screenshot"
          >
            <i className="fa-solid fa-camera mr-1"></i> Screenshot
          </button>

          <button
            onClick={sendCtrlAltDel}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs font-medium transition-colors"
            title="Send Ctrl+Alt+Del"
          >
            <i className="fa-solid fa-key mr-1"></i> Ctrl+Alt+Del
          </button>

          <button
            onClick={onToggleRecord}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              recording
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title={recording ? 'Stop Recording' : 'Start Recording'}
          >
            <i className={`fa-solid ${recording ? 'fa-stop' : 'fa-circle'} mr-1`}></i>
            {recording ? 'Stop' : 'Record'}
          </button>

          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs font-medium transition-colors"
            title="Toggle Fullscreen"
          >
            <i className={`fa-solid ${fullscreen ? 'fa-compress' : 'fa-expand'} mr-1`}></i>
            {fullscreen ? 'Exit' : 'Fullscreen'}
          </button>

          <button
            onClick={onDisconnect}
            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-xs font-medium transition-colors ml-auto"
          >
            <i className="fa-solid fa-phone-slash mr-1"></i> Disconnect
          </button>
        </>
      )}
    </div>
  )
}
