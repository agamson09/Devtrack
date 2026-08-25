import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import Loading from '@/components/common/Loading'
import { PdfExportButton } from '@/components/common/PdfExport'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6', '#06b6d4', '#f97316']

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-2.5 md:p-4">
      <div className="flex items-center gap-2 md:gap-3">
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color || 'bg-indigo-500/20'}`}>
          <i className={`fa-solid ${icon} text-sm md:text-lg`}></i>
        </div>
        <div className="min-w-0">
          <p className="text-lg md:text-2xl font-bold text-white leading-tight">{value}</p>
          <p className="text-gray-400 text-[10px] md:text-xs truncate">{label}</p>
          {sub && <p className="text-gray-500 text-[9px] md:text-[10px]">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-white text-sm font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-gray-300 text-xs">{p.name}: <span className="text-white font-medium">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}h</span></p>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterProject, setFilterProject] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => { fetchProjects(); fetchUsers() }, [])

  useEffect(() => { fetchReport() }, [filterProject, filterUser])

  async function fetchProjects() {
    try { const res = await fetch('/api/projects'); const d = await res.json(); setProjects(d.projects || []) } catch {}
  }

  async function fetchUsers() {
    try { const res = await fetch('/api/users'); const d = await res.json(); setUsers(d.users || []) } catch {}
  }

  async function fetchReport() {
    setLoading(true)
    try {
      let url = '/api/reports/time?'
      if (filterProject) url += `&project_id=${filterProject}`
      if (filterUser) url += `&user_id=${filterUser}`
      const res = await fetch(url)
      setData(await res.json())
    } catch (err) { console.error('Failed to fetch report:', err) }
    finally { setLoading(false) }
  }

  function exportCSV() {
    if (!data?.tasks?.length) return
    const headers = ['Title', 'Project', 'Assignee', 'Status', 'Priority', 'Estimated Hours', 'Actual Hours']
    const rows = data.tasks.map(t => [`"${t.title}"`, t.project_name || '', t.assignee_name || '', t.status, t.priority, t.estimated_hours || 0, t.actual_hours || 0])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `time-report-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <Layout><Loading /></Layout>
  if (!data) return <Layout><div className="p-6 text-gray-400">No data available</div></Layout>

  return (
    <Layout>
      <div className="p-3 md:p-6">
        <div id="reports-content">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Time Reports</h1>
              <p className="text-gray-400 text-xs md:text-sm mt-1">Track time spent on tasks</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="bg-gray-700 text-white text-xs md:text-sm rounded-lg px-2 md:px-3 py-1.5 md:py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none min-w-0 max-w-[140px]">
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="bg-gray-700 text-white text-xs md:text-sm rounded-lg px-2 md:px-3 py-1.5 md:py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none min-w-0 max-w-[140px]">
                <option value="">All Members</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button onClick={exportCSV} className="px-2 md:px-3 py-1.5 md:py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs md:text-sm font-medium transition-colors">
                <i className="fa-solid fa-download mr-1"></i> <span className="hidden sm:inline">Export </span>CSV
              </button>
              <PdfExportButton elementId="reports-content" filename={`time-report-${new Date().toISOString().split('T')[0]}.pdf`} label="PDF" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
            <StatCard label="Total Hours" value={data.summary.total_hours.toFixed(1)} icon="fa-clock" color="bg-indigo-500/20 text-indigo-400" />
            <StatCard label="Estimated" value={data.summary.total_estimated.toFixed(1)} icon="fa-bullseye" color="bg-blue-500/20 text-blue-400" />
            <StatCard label="Tasks" value={data.summary.task_count} icon="fa-list-check" color="bg-emerald-500/20 text-emerald-400" />
            <StatCard label="Efficiency" value={data.summary.efficiency ? `${data.summary.efficiency}%` : 'N/A'} icon="fa-chart-line" color="bg-amber-500/20 text-amber-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6 mb-4 md:mb-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-white font-semibold mb-4">Hours by Member</h3>
              {data.byUser.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.byUser.slice(0, 8)}>
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total_hours" name="Hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-500 text-sm text-center py-8">No data</p>}
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-white font-semibold mb-4">Hours by Project</h3>
              {data.byProject.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.byProject.slice(0, 8)}>
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total_hours" name="Hours" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-500 text-sm text-center py-8">No data</p>}
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-white font-semibold mb-4">Hours by Priority</h3>
              {data.byPriority.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={data.byPriority.map(p => ({ ...p, name: p.priority }))} dataKey="total_hours" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {data.byPriority.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-500 text-sm text-center py-8">No data</p>}
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-white font-semibold mb-4">Hours by Module</h3>
              {data.byModule.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.byModule.slice(0, 8)}>
                    <XAxis dataKey="module_name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total_hours" name="Hours" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-500 text-sm text-center py-8">No data</p>}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h3 className="text-white font-semibold">Task Details ({data.tasks.length})</h3>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-800">
                  <tr className="text-gray-400 text-left border-b border-gray-700">
                    <th className="px-4 py-2 font-medium">Task</th>
                    <th className="px-4 py-2 font-medium">Project</th>
                    <th className="px-4 py-2 font-medium">Assignee</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium text-right">Estimated</th>
                    <th className="px-4 py-2 font-medium text-right">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tasks.map(task => (
                    <tr key={task.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-2 text-white">{task.title}</td>
                      <td className="px-4 py-2 text-gray-400">{task.project_name || '-'}</td>
                      <td className="px-4 py-2 text-gray-400">{task.assignee_name || '-'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${task.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' : task.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' : task.status === 'review' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'}`}>{task.status?.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-right">{task.estimated_hours || 0}h</td>
                      <td className="px-4 py-2 text-right">
                        <span className={task.actual_hours > task.estimated_hours ? 'text-red-400' : 'text-emerald-400'}>{task.actual_hours || 0}h</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
