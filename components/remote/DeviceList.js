export default function DeviceList({ devices, selectedDevice, onSelect, connected }) {
  const getOsIcon = (os) => {
    if (os === 'win32') return 'fa-windows'
    if (os === 'darwin') return 'fa-apple'
    if (os === 'linux') return 'fa-linux'
    return 'fa-desktop'
  }

  const getOsColor = (os) => {
    if (os === 'win32') return 'text-blue-400'
    if (os === 'darwin') return 'text-gray-300'
    if (os === 'linux') return 'text-orange-400'
    return 'text-gray-400'
  }

  // Deduplicate: prefer http agents (C# agent), keep most recent
  const deduped = []
  const seen = new Map()
  for (const d of devices) {
    const key = d.name || d.id
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, d)
      deduped.push(d)
    } else if (d.type === 'http' && existing.type !== 'http') {
      // Replace websocket agent with http agent
      const idx = deduped.indexOf(existing)
      if (idx >= 0) {
        deduped[idx] = d
        seen.set(key, d)
      }
    }
  }

  if (deduped.length === 0) {
    return (
      <div className="text-center py-8">
        <i className="fa-solid fa-desktop text-3xl text-gray-600 mb-3"></i>
        <p className="text-gray-400 text-sm">No agents connected</p>
        <p className="text-gray-500 text-xs mt-1">Start an agent on the target PC</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {deduped.map(device => {
        const isSelected = selectedDevice?.id === device.id
        const isActive = connected && isSelected
        return (
          <button
            key={device.id}
            onClick={() => onSelect(device)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
              isActive
                ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500/50'
                : isSelected
                ? 'bg-gray-700/50 border-indigo-500/50'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-700/50'
            }`}
          >
            <div className="flex-shrink-0 relative">
              <div className={`w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center ${getOsColor(device.os)}`}>
                <i className={`fa-brands ${getOsIcon(device.os)} text-lg`}></i>
              </div>
              {device.online && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800"></span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-medium text-sm truncate">{device.name}</p>
              <p className="text-gray-400 text-xs truncate">{device.ip}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="text-[10px] text-gray-500 block">
                {device.resolution ? `${device.resolution.width}x${device.resolution.height}` : ''}
              </span>
              <span className={`text-[10px] ${device.online ? 'text-green-400' : 'text-red-400'}`}>
                {device.online ? 'Online' : 'Offline'}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
