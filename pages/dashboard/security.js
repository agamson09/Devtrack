import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import Layout from '@/components/layout/Layout'

const SEVERITY_COLORS = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
  critical: 'bg-red-200 text-red-900 font-bold'
}

const EVENT_ICONS = {
  login: 'fa-sign-in-alt',
  logout: 'fa-sign-out-alt',
  login_failed: 'fa-exclamation-triangle',
  login_success: 'fa-check-circle',
  brute_force_blocked: 'fa-ban',
  rate_limit_exceeded: 'fa-clock',
  session_destroyed: 'fa-trash',
  password_change: 'fa-key',
  permission_change: 'fa-user-shield'
}

export default function SecurityPage() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState([])
  const [eventStats, setEventStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('sessions')
  const [logFilter, setLogFilter] = useState({ severity: '', event_type: '', limit: 50 })
  const [expandedLog, setExpandedLog] = useState(null)

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [sessionsRes, logsRes] = await Promise.all([
        fetch('/api/auth/sessions', { credentials: 'include' }),
        fetch(`/api/auth/security-logs?limit=${logFilter.limit}${logFilter.severity ? '&severity=' + logFilter.severity : ''}${logFilter.event_type ? '&event_type=' + logFilter.event_type : ''}`, { credentials: 'include' })
      ])

      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json()
        setSessions(sessionsData.sessions || [])
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json()
        setLogs(logsData.logs || [])
        setStats(logsData.stats || [])
        setEventStats(logsData.eventStats || [])
      }
    } catch (err) {
      console.error('Failed to load security data:', err)
    } finally {
      setLoading(false)
    }
  }

  const terminateSession = async (sessionId) => {
    if (!confirm('Terminate this session?')) return
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ session_id: sessionId })
      })
      if (res.ok) {
        setSessions(sessions.filter(s => s.id !== sessionId))
      }
    } catch (err) {
      console.error('Failed to terminate session:', err)
    }
  }

  const terminateAllSessions = async () => {
    if (!confirm('Terminate ALL other sessions? This will log out all other devices.')) return
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ all: true })
      })
      if (res.ok) {
        loadData()
      }
    } catch (err) {
      console.error('Failed to terminate sessions:', err)
    }
  }

  const cleanupSessions = async () => {
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'POST',
        credentials: 'include'
      })
      if (res.ok) {
        loadData()
      }
    } catch (err) {
      console.error('Failed to cleanup sessions:', err)
    }
  }

  if (user?.role !== 'admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <i className="fas fa-lock text-6xl text-gray-600 mb-4"></i>
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">Admin access required</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <i className="fas fa-shield-alt text-indigo-400"></i>
              Security Center
            </h1>
            <p className="text-gray-400 text-sm mt-1">Manage sessions, view audit logs, monitor security</p>
          </div>
          <div className="flex gap-2">
            <button onClick={cleanupSessions} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors">
              <i className="fas fa-broom mr-2"></i>Cleanup Expired
            </button>
            <button onClick={terminateAllSessions} className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors">
              <i className="fas fa-ban mr-2"></i>Terminate All Others
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <i className="fas fa-desktop text-blue-400"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{sessions.length}</p>
                <p className="text-xs text-gray-400">Active Sessions</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <i className="fas fa-check-circle text-green-400"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.find(s => s.severity === 'low')?.count || 0}</p>
                <p className="text-xs text-gray-400">Low Events (7d)</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-yellow-400"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.find(s => s.severity === 'medium')?.count || 0}</p>
                <p className="text-xs text-gray-400">Medium Events (7d)</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <i className="fas fa-skull-crossbones text-red-400"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{(stats.find(s => s.severity === 'high')?.count || 0) + (stats.find(s => s.severity === 'critical')?.count || 0)}</p>
                <p className="text-xs text-gray-400">High/Critical (7d)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
          {[
            { id: 'sessions', label: 'Active Sessions', icon: 'fa-desktop' },
            { id: 'logs', label: 'Audit Logs', icon: 'fa-list-alt' },
            { id: 'events', label: 'Event Summary', icon: 'fa-chart-bar' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <i className={`fas ${tab.icon} mr-2`}></i>{tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <>
            {activeTab === 'sessions' && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Device</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IP</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Last Active</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Expires</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {sessions.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500">No active sessions</td>
                        </tr>
                      ) : (
                        sessions.map((session) => (
                          <tr key={session.id} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                                  {session.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white">{session.name}</p>
                                  <p className="text-xs text-gray-400">{session.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-300 flex items-center gap-2">
                                <i className={`fas ${session.device_info?.includes('iPhone') ? 'fa-mobile-alt' : session.device_info?.includes('Windows') ? 'fa-laptop' : session.device_info?.includes('Mac') ? 'fa-laptop' : 'fa-desktop'} text-gray-500`}></i>
                                {session.device_info || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300 font-mono">{session.ip_address}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${session.is_remembered ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {session.is_remembered ? 'Remembered' : 'Session'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">{new Date(session.last_activity).toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{new Date(session.expires_at).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => terminateSession(session.id)}
                                className="text-red-400 hover:text-red-300 text-sm transition-colors"
                                title="Terminate session"
                              >
                                <i className="fas fa-times-circle"></i>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex gap-3">
                  <select
                    value={logFilter.severity}
                    onChange={(e) => setLogFilter({ ...logFilter, severity: e.target.value })}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
                  >
                    <option value="">All Severities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select
                    value={logFilter.event_type}
                    onChange={(e) => setLogFilter({ ...logFilter, event_type: e.target.value })}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
                  >
                    <option value="">All Events</option>
                    <option value="login">Login</option>
                    <option value="login_failed">Login Failed</option>
                    <option value="login_success">Login Success</option>
                    <option value="brute_force_blocked">Brute Force</option>
                    <option value="rate_limit_exceeded">Rate Limit</option>
                    <option value="logout">Logout</option>
                  </select>
                  <button onClick={loadData} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm">
                    <i className="fas fa-sync-alt"></i>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Event</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IP</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Severity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500">No logs found</td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-2 text-sm text-gray-300">
                                <i className={`fas ${EVENT_ICONS[log.event_type] || 'fa-circle'} text-gray-500`}></i>
                                {log.event_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300">{log.user_name || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">{log.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-300 font-mono">{log.ip_address}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[log.severity] || 'bg-gray-100 text-gray-800'}`}>
                                {log.severity}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {log.metadata && (
                                <button
                                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                  className="text-gray-400 hover:text-white text-sm"
                                >
                                  <i className={`fas fa-chevron-${expandedLog === log.id ? 'up' : 'down'}`}></i>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'events' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Events by Severity (7 days)</h3>
                  <div className="space-y-3">
                    {['low', 'medium', 'high', 'critical'].map(severity => {
                      const count = stats.find(s => s.severity === severity)?.count || 0
                      const total = stats.reduce((acc, s) => acc + s.count, 0) || 1
                      const pct = Math.round((count / total) * 100)
                      return (
                        <div key={severity}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300 capitalize">{severity}</span>
                            <span className="text-gray-400">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                severity === 'low' ? 'bg-green-500' :
                                severity === 'medium' ? 'bg-yellow-500' :
                                severity === 'high' ? 'bg-orange-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Top Event Types (7 days)</h3>
                  <div className="space-y-2">
                    {eventStats.length === 0 ? (
                      <p className="text-gray-500 text-sm">No events recorded</p>
                    ) : (
                      eventStats.map((evt, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700/50">
                          <span className="flex items-center gap-2 text-sm text-gray-300">
                            <i className={`fas ${EVENT_ICONS[evt.event_type] || 'fa-circle'} text-gray-500 w-4`}></i>
                            {evt.event_type}
                          </span>
                          <span className="text-sm font-bold text-white">{evt.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
