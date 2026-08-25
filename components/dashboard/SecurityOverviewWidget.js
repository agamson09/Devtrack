import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const SEVERITY_COLORS = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
  critical: 'text-red-500'
}

export default function SecurityOverviewWidget({ user }) {
  const router = useRouter()
  const [sessions, setSessions] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role === 'admin') {
      loadSecurityData()
    }
  }, [user])

  const loadSecurityData = async () => {
    try {
      const [sessionsRes, logsRes] = await Promise.all([
        fetch('/api/auth/sessions', { credentials: 'include' }),
        fetch('/api/auth/security-logs?limit=10', { credentials: 'include' })
      ])

      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        setSessions(data.sessions || [])
      }

      if (logsRes.ok) {
        const data = await logsRes.json()
        setRecentLogs(data.logs || [])
        setStats(data.stats || [])
      }
    } catch (err) {
      console.error('Failed to load security data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (user?.role !== 'admin') return null

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <i className="fas fa-shield-alt text-indigo-400"></i>
          Security Overview
        </h3>
        <button
          onClick={() => router.push('/dashboard/security')}
          className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
        >
          View All <i className="fas fa-arrow-right ml-1"></i>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{sessions.length}</p>
              <p className="text-xs text-gray-400">Active Sessions</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{stats.find(s => s.severity === 'medium')?.count || 0}</p>
              <p className="text-xs text-gray-400">Warnings (7d)</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{(stats.find(s => s.severity === 'high')?.count || 0) + (stats.find(s => s.severity === 'critical')?.count || 0)}</p>
              <p className="text-xs text-gray-400">Critical (7d)</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase">Recent Activity</p>
            {recentLogs.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent activity</p>
            ) : (
              recentLogs.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-center gap-3 py-1.5 border-b border-gray-700/50 last:border-0">
                  <i className={`fas ${
                    log.event_type === 'login_success' ? 'fa-check-circle text-green-400' :
                    log.event_type === 'login_failed' ? 'fa-times-circle text-red-400' :
                    log.event_type === 'brute_force_blocked' ? 'fa-ban text-red-500' :
                    log.event_type === 'rate_limit_exceeded' ? 'fa-clock text-yellow-400' :
                    'fa-circle text-gray-500'
                  } text-xs w-4`}></i>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate">{log.description}</p>
                    <p className="text-[10px] text-gray-500">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-[10px] font-medium ${SEVERITY_COLORS[log.severity] || 'text-gray-500'}`}>
                    {log.severity}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
