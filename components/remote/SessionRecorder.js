import { useState, useEffect } from 'react'

export default function SessionRecorder({ recording, sessions, onToggleRecord }) {
  const [showSessions, setShowSessions] = useState(false)

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">
          <i className="fa-solid fa-circle-record text-red-400 mr-2"></i>
          Active Sessions
        </h3>
        <span className="text-gray-400 text-xs">{sessions.length} active</span>
      </div>

      {sessions.length === 0 ? (
        <p className="text-gray-500 text-xs">No active remote sessions</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-white text-xs font-medium">{session.deviceName}</span>
                <span className="text-gray-400 text-xs">by {session.userName}</span>
              </div>
              <div className="flex items-center gap-2">
                {session.recording && (
                  <span className="text-red-400 text-xs">
                    <i className="fa-solid fa-circle text-[6px] animate-pulse mr-1"></i>
                    REC
                  </span>
                )}
                <span className="text-gray-500 text-xs">
                  {Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000)}s
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
