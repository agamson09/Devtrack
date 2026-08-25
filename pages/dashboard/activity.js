import { useState, useEffect, useMemo } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/router'

const ACTION_ICONS = {
  created: { icon: 'fa-plus-circle', color: 'text-emerald-400' },
  updated: { icon: 'fa-pen', color: 'text-blue-400' },
  deleted: { icon: 'fa-trash', color: 'text-red-400' },
  commented: { icon: 'fa-comment', color: 'text-yellow-400' },
  deployed: { icon: 'fa-rocket', color: 'text-purple-400' },
  login: { icon: 'fa-right-to-bracket', color: 'text-indigo-400' },
  default: { icon: 'fa-circle-dot', color: 'text-gray-400' },
}

const TARGET_ICONS = {
  project: 'fa-folder',
  task: 'fa-list-check',
  user: 'fa-user',
  deploy: 'fa-rocket',
  comment: 'fa-comment',
  timer: 'fa-stopwatch',
}

function getActionConfig(action) {
  if (!action) return ACTION_ICONS.default
  const lower = action.toLowerCase()
  if (lower.includes('created') || lower.includes('created')) return ACTION_ICONS.created
  if (lower.includes('updated') || lower.includes('changed')) return ACTION_ICONS.updated
  if (lower.includes('deleted') || lower.includes('deactivated')) return ACTION_ICONS.deleted
  if (lower.includes('comment')) return ACTION_ICONS.commented
  if (lower.includes('deploy') || lower.includes('rollback')) return ACTION_ICONS.deployed
  if (lower.includes('login')) return ACTION_ICONS.login
  return ACTION_ICONS.default
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined, hour: '2-digit', minute: '2-digit' })
}

export default function ActivityLogPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [activities, setActivities] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 0 })
  const [filters, setFilters] = useState({ user_id: '', action: '', target_type: '', date_range: '' })

  useEffect(() => { loadActivities() }, [page, filters])

  async function loadActivities() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 50 })
      if (filters.user_id) params.set('user_id', filters.user_id)
      if (filters.action) params.set('action', filters.action)
      if (filters.target_type) params.set('target_type', filters.target_type)
      if (filters.date_range) {
        const now = new Date()
        if (filters.date_range === 'today') {
          params.set('date_from', now.toISOString().split('T')[0])
        } else if (filters.date_range === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 86400000)
          params.set('date_from', weekAgo.toISOString().split('T')[0])
        } else if (filters.date_range === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 86400000)
          params.set('date_from', monthAgo.toISOString().split('T')[0])
        }
      }
      const res = await fetch(`/api/activity?${params}`)
      if (res.ok) {
        const data = await res.json()
        setActivities(data.activities || [])
        setUsers(data.users || [])
        setPagination(data.pagination || { total: 0, pages: 0 })
      }
    } catch {}
    setLoading(false)
  }

  function getTargetLink(activity) {
    if (!activity.target_type || !activity.target_id) return null
    switch (activity.target_type) {
      case 'project': return `/dashboard/projects/${activity.target_id}`
      case 'task': return `/task/${activity.target_id}`
      default: return null
    }
  }

  function parseDetails(details) {
    if (!details) return null
    try {
      const parsed = typeof details === 'string' ? JSON.parse(details) : details
      if (parsed.changes) return parsed.changes.join(', ')
      if (parsed.name) return parsed.name
      return JSON.stringify(parsed)
    } catch {
      return details
    }
  }

  if (user?.role !== 'admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <i className="fa-solid fa-lock text-4xl text-gray-600 mb-4"></i>
            <p className="text-gray-400 text-lg">Access Denied</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Activity Log">
      <div className="p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Activity Log</h1>
          <p className="text-gray-400 text-sm">{pagination.total} activities total</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={filters.user_id}
            onChange={e => { setFilters({ ...filters, user_id: e.target.value }); setPage(1) }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Users</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select
            value={filters.target_type}
            onChange={e => { setFilters({ ...filters, target_type: e.target.value }); setPage(1) }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Targets</option>
            <option value="project">Projects</option>
            <option value="task">Tasks</option>
            <option value="user">Users</option>
            <option value="deploy">Deploys</option>
            <option value="comment">Comments</option>
          </select>
          <select
            value={filters.date_range}
            onChange={e => { setFilters({ ...filters, date_range: e.target.value }); setPage(1) }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          {(filters.user_id || filters.target_type || filters.date_range) && (
            <button
              onClick={() => { setFilters({ user_id: '', action: '', target_type: '', date_range: '' }); setPage(1) }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
            >
              <i className="fa-solid fa-xmark mr-1"></i>Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <i className="fa-solid fa-clock-rotate-left text-5xl mb-4 block"></i>
            <p className="text-lg">No activities found</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left py-3 px-4 w-8"></th>
                    <th className="text-left py-3 px-4">User</th>
                    <th className="text-left py-3 px-4">Action</th>
                    <th className="text-left py-3 px-4 hidden md:table-cell">Details</th>
                    <th className="text-right py-3 px-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map(a => {
                    const actionConfig = getActionConfig(a.action)
                    const targetLink = getTargetLink(a)
                    return (
                      <tr key={a.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                        <td className="py-3 px-4">
                          <i className={`fa-solid ${actionConfig.icon} ${actionConfig.color} text-sm`}></i>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                              {a.user_avatar ? (
                                <img src={a.user_avatar} className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-bold text-white">{a.user_name?.charAt(0)?.toUpperCase()}</span>
                              )}
                            </div>
                            <span className="text-white text-xs">{a.user_name || 'System'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <i className={`fa-solid ${TARGET_ICONS[a.target_type] || 'fa-circle'} text-[10px] text-gray-500`}></i>
                            {targetLink ? (
                              <a href={targetLink} className="text-xs text-indigo-400 hover:text-indigo-300">
                                {a.action}
                              </a>
                            ) : (
                              <span className="text-xs text-gray-300">{a.action}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <span className="text-xs text-gray-500 truncate max-w-[200px] block">
                            {parseDetails(a.details)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-[11px] text-gray-500">{formatTime(a.created_at)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
