import { csrfFetch } from '@/lib/csrfFetch';
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import { User, X } from 'lucide-react'

const STATUS_CONFIG = {
  todo: { bar: '#6b7280', label: 'To Do', icon: 'fa-circle', badge: 'bg-gray-600/50 text-gray-300' },
  in_progress: { bar: '#f59e0b', label: 'In Progress', icon: 'fa-spinner', badge: 'bg-amber-600/50 text-amber-300' },
  review: { bar: '#8b5cf6', label: 'Review', icon: 'fa-eye', badge: 'bg-violet-600/50 text-violet-300' },
  done: { bar: '#10b981', label: 'Done', icon: 'fa-circle-check', badge: 'bg-emerald-600/50 text-emerald-300' },
}

const PRIORITY_CONFIG = {
  low: { color: 'text-gray-400', icon: 'fa-arrow-down', label: 'Low' },
  medium: { color: 'text-blue-400', icon: 'fa-minus', label: 'Medium' },
  high: { color: 'text-orange-400', icon: 'fa-arrow-up', label: 'High' },
  urgent: { color: 'text-red-400', icon: 'fa-bolt', label: 'Urgent' },
}

export default function ProjectTimelinePage() {
  const router = useRouter()
  const { id } = router.query
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('week')
  const [selectedTask, setSelectedTask] = useState(null)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [users, setUsers] = useState([])
  const scrollRef = useRef(null)

  useEffect(() => { if (id) { loadData(); fetchUsers(); } }, [id])

  async function loadData() {
    try {
      const [projRes, tasksRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/tasks?project_id=${id}`),
      ])
      const projData = await projRes.json()
      const tasksData = await tasksRes.json()
      setProject(projData.project)
      setTasks(tasksData.tasks || [])
    } catch {}
    setLoading(false)
  }

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch {}
  }

  function parseDate(dateStr) {
    if (!dateStr) return null
    const ds = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0]
    if (!ds || ds === '0000-00-00') return null
    const parts = ds.split('-')
    if (parts.length !== 3) return null
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    return isNaN(d.getTime()) ? null : d
  }

  function formatDate(d) {
    if (!d) return '-'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function daysLeft(d) {
    if (!d) return null
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const target = new Date(d)
    target.setHours(0, 0, 0, 0)
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
  }

  function startOfWeek(d) {
    const r = new Date(d)
    const day = r.getDay()
    const diff = day === 0 ? 6 : day - 1
    r.setDate(r.getDate() - diff)
    r.setHours(0, 0, 0, 0)
    return r
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1)
  }

  function getWeekNumber(d) {
    const onejan = new Date(d.getFullYear(), 0, 1)
    return Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7)
  }

  const { timelineData, columns, colWidth, todayMs, totalRangeMs, minDateMs } = useMemo(() => {
    const filteredTasks = filterAssignee ? tasks.filter(t => String(t.assigned_to) === filterAssignee) : tasks

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    if (filteredTasks.length === 0) return { timelineData: [], columns: [], colWidth: 0, todayMs: now.getTime(), totalRangeMs: 0, minDateMs: 0 }
    const parsed = filteredTasks.map(t => {
      let start = parseDate(t.start_date)
      if (!start && t.created_at) {
        start = parseDate(t.created_at)
      }
      if (!start) start = now
      let end = parseDate(t.deadline)
      if (!end) {
        end = new Date(start)
        end.setDate(end.getDate() + 7)
      }
      return { ...t, _start: start, _end: end }
    })

    let minDate = parsed[0]._start
    let maxDate = parsed[0]._end
    parsed.forEach(t => {
      if (t._start < minDate) minDate = t._start
      if (t._end > maxDate) maxDate = t._end
    })

    const buffer = 14 * 24 * 60 * 60 * 1000
    minDate = new Date(Math.min(minDate.getTime() - buffer, now.getTime() - buffer))
    maxDate = new Date(Math.max(maxDate.getTime() + buffer, now.getTime() + buffer))

    // Align minDate AND maxDate to column boundaries so bars match columns
    if (viewMode === 'week') {
      minDate = startOfWeek(minDate)
      // Align maxDate to end of week (Sunday 23:59:59.999)
      const endDay = maxDate.getDay()
      const daysToEndOfWeek = endDay === 0 ? 0 : 7 - endDay
      maxDate = new Date(maxDate)
      maxDate.setDate(maxDate.getDate() + daysToEndOfWeek)
      maxDate.setHours(23, 59, 59, 999)
    } else if (viewMode === 'day') {
      minDate.setHours(0, 0, 0, 0)
      maxDate.setHours(23, 59, 59, 999)
    } else {
      minDate = startOfMonth(minDate)
      // Align maxDate to end of month
      maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0, 23, 59, 59)
    }

    const totalRangeMs = maxDate.getTime() - minDate.getTime()

    if (viewMode === 'month') {
      const monthMap = new Map()
      const d = startOfMonth(minDate)
      while (d <= maxDate) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        const monthStart = new Date(d)
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
        if (!monthMap.has(key)) {
          monthMap.set(key, { key, label, start: monthStart, end: monthEnd })
        }
        d.setMonth(d.getMonth() + 1)
      }
      const cols = Array.from(monthMap.values())
      const taskData = parsed.map(t => ({
        ...t,
        left: (t._start - minDate) / totalRangeMs * 100,
        width: Math.max(((t._end - t._start) / totalRangeMs) * 100, 3),
        color: STATUS_CONFIG[t.status]?.bar || '#6b7280',
      }))
      return { timelineData: taskData, columns: cols, colWidth: 0, todayMs: now.getTime(), totalRangeMs, minDateMs: minDate.getTime() }
    }

    if (viewMode === 'week') {
      const weekMap = new Map()
      let d = startOfWeek(minDate)
      while (d <= maxDate) {
        const weekEnd = new Date(d)
        weekEnd.setDate(weekEnd.getDate() + 6)
        weekEnd.setHours(23, 59, 59)
        const weekNum = getWeekNumber(d)
        const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
        const startLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const endLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (!weekMap.has(key)) {
          const days = []
          const dd = new Date(d)
          for (let i = 0; i < 7; i++) {
            days.push({
              date: new Date(dd),
              dayNum: dd.getDate(),
              dayName: dd.toLocaleDateString('en-US', { weekday: 'short' }),
              isToday: dd.toDateString() === now.toDateString(),
              isWeekend: dd.getDay() === 0 || dd.getDay() === 6,
            })
            dd.setDate(dd.getDate() + 1)
          }
          weekMap.set(key, { key, label: `W${weekNum}`, sublabel: `${startLabel} – ${endLabel}`, days })
        }
        d.setDate(d.getDate() + 7)
      }
      const cols = Array.from(weekMap.values())
      const taskData = parsed.map(t => ({
        ...t,
        left: (t._start - minDate) / totalRangeMs * 100,
        width: Math.max(((t._end - t._start) / totalRangeMs) * 100, 3),
        color: STATUS_CONFIG[t.status]?.bar || '#6b7280',
      }))
      return { timelineData: taskData, columns: cols, colWidth: 0, todayMs: now.getTime(), totalRangeMs, minDateMs: minDate.getTime() }
    }

    // Day view
    const cols = []
    const d = new Date(minDate)
    d.setHours(0, 0, 0, 0)
    while (d <= maxDate) {
      cols.push({
        key: d.toISOString().split('T')[0],
        date: new Date(d),
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: d.toDateString() === now.toDateString(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      })
      d.setDate(d.getDate() + 1)
    }
    const taskData = parsed.map(t => ({
      ...t,
      left: (t._start - minDate) / totalRangeMs * 100,
      width: Math.max(((t._end - t._start) / totalRangeMs) * 100, 3),
      color: STATUS_CONFIG[t.status]?.bar || '#6b7280',
    }))
    return { timelineData: taskData, columns: cols, colWidth: 36, todayMs: now.getTime(), totalRangeMs, minDateMs: minDate.getTime() }
  }, [tasks, viewMode])

  function handleTaskClick(task) {
    setSelectedTask(prev => prev?.id === task.id ? null : task)
  }

  async function handleDateChange(taskId, newStart, newEnd) {
    try {
      await csrfFetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: newStart.toISOString().split('T')[0],
          deadline: newEnd.toISOString().split('T')[0],
        }),
      })
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, start_date: newStart.toISOString().split('T')[0], deadline: newEnd.toISOString().split('T')[0] }
          : t
      ))
    } catch {}
  }

  if (!user) return null

  return (
    <Layout title={project?.name ? `Timeline — ${project.name}` : 'Project Timeline'}>
      <div className="p-3 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/dashboard/projects/${id}`)} className="text-gray-400 hover:text-white transition-colors">
              <i className="fa-solid fa-arrow-left text-lg"></i>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-white truncate">{project?.name}</h1>
              <p className="text-gray-400 text-xs md:text-sm hidden sm:block">Project Timeline</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/dashboard/projects/${id}`} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs md:text-sm font-medium transition-colors">
              <i className="fa-solid fa-columns mr-1.5"></i><span className="hidden sm:inline">Kanban</span><span className="sm:hidden">Board</span>
            </a>
            {user?.role === 'admin' && users.length > 0 && (
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[140px]"
                >
                  <option value="">All</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {filterAssignee && (
                  <button onClick={() => setFilterAssignee('')} className="p-0.5 text-gray-400 hover:text-white transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
            <div className="flex bg-gray-800 rounded-lg border border-gray-700">
              {[
                { label: 'Day', value: 'day' },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
              ].map(v => (
                <button
                  key={v.value}
                  onClick={() => setViewMode(v.value)}
                  className={`px-2 sm:px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewMode === v.value ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 md:mx-0 md:px-0">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: cfg.bar }}></div>
              <span className="text-[11px] text-gray-400">{cfg.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 flex-shrink-0">              <div className="w-0 h-3 border-l-2 border-indigo-500"></div>
            <span className="text-[11px] text-gray-400">Today</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
          ) : timelineData.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <i className="fa-solid fa-chart-line text-5xl mb-4 block"></i>
              <p className="text-lg">No tasks to show</p>
              <p className="text-sm mt-1">Add tasks with dates to see them here</p>
            </div>
          ) : (
            <div ref={scrollRef} className="overflow-x-auto">
              {viewMode === 'month' ? (
                <div style={{ minWidth: '100%' }}>
                  <div className="flex border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                    <div className="w-[200px] md:w-[260px] flex-shrink-0 px-3 md:px-4 py-2 text-[10px] md:text-xs font-semibold text-gray-400 border-r border-gray-700">
                      Task Name
                    </div>
                    <div className="flex flex-1">
                      {columns.map(col => (
                        <div key={col.key} className="text-center py-2 border-r border-gray-700 last:border-r-0 px-1" style={{ flex: '1 1 0' }}>
                          <span className="text-[10px] md:text-xs font-semibold text-indigo-400">{col.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="divide-y divide-gray-700/30">
                    {timelineData.map((task) => (
                      <div key={task.id} className={`flex group ${selectedTask?.id === task.id ? 'bg-indigo-500/10' : ''}`}>
                        <div
                          className="w-[200px] md:w-[260px] flex-shrink-0 px-3 md:px-4 py-2 border-r border-gray-700 flex items-center gap-2 cursor-pointer hover:bg-gray-700/30 transition-colors"
                          onClick={() => handleTaskClick(task)}
                        >
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }}></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] md:text-xs text-white truncate">{task.title}</p>
                            <p className="text-[9px] md:text-[10px] text-gray-500 mt-0.5">{STATUS_CONFIG[task.status]?.label}{task.progress > 0 ? ` · ${task.progress}%` : ''}</p>
                          </div>
                          <i className="fa-solid fa-chevron-right text-[8px] text-gray-600 flex-shrink-0"></i>
                        </div>
                        <div className="flex-1 relative py-2" style={{ minHeight: 40 }}>
                          {todayMs >= minDateMs && totalRangeMs > 0 && (
                            <div className="absolute top-0 bottom-0 w-0 border-l-2 border-indigo-500 z-20" style={{ left: `${((todayMs - minDateMs) / totalRangeMs) * 100}%` }}></div>
                          )}
                          <div
                            className="absolute top-1.5 h-[26px] rounded-md cursor-pointer hover:brightness-110 transition-all shadow-md"
                            style={{ left: `${task.left}%`, width: `${task.width}%`, minWidth: 36, backgroundColor: task.color }}
                            onClick={() => handleTaskClick(task)}
                          >
                            <div className="absolute left-0 top-0 h-full rounded-md opacity-50" style={{ width: `${task.progress || 0}%`, backgroundColor: task.color, filter: 'brightness(1.5)' }}></div>
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] md:text-[10px] font-medium text-white drop-shadow px-1 truncate">{task.title}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : viewMode === 'week' ? (
                <div>
                  <div className="border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                    <div className="flex">
                      <div className="w-[200px] md:w-[260px] flex-shrink-0 px-3 md:px-4 py-2 text-[10px] md:text-xs font-semibold text-gray-400 border-r border-gray-700">
                        Task Name
                      </div>
                      <div className="flex flex-1">
                        {columns.map(week => (
                          <div key={week.key} className="border-r border-gray-700 last:border-r-0" style={{ flex: '1 1 0' }}>
                            <div className="text-center py-1 border-b border-gray-700/50">
                              <span className="text-[10px] md:text-xs font-bold text-indigo-400">{week.label}</span>
                              <span className="text-[8px] md:text-[9px] text-gray-500 block">{week.sublabel}</span>
                            </div>
                            <div className="flex">
                              {week.days.map(day => (
                                <div key={day.date.toISOString().split('T')[0]} className={`flex-1 text-center py-0.5 border-r border-gray-700/30 last:border-r-0 ${day.isToday ? 'bg-indigo-500/10' : ''}`}>
                                  <div className={`text-[7px] md:text-[8px] leading-none ${day.isToday ? 'text-indigo-400 font-bold' : day.isWeekend ? 'text-gray-600' : 'text-gray-500'}`}>{day.dayName}</div>
                                  <div className={`text-[8px] md:text-[9px] leading-tight mt-px ${day.isToday ? 'text-indigo-400 font-bold' : day.isWeekend ? 'text-gray-500' : 'text-gray-400'}`}>{day.dayNum}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-700/30">
                    {timelineData.map((task) => (
                      <div key={task.id} className={`flex group ${selectedTask?.id === task.id ? 'bg-indigo-500/10' : ''}`}>
                        <div
                          className="w-[200px] md:w-[260px] flex-shrink-0 px-3 md:px-4 py-2 border-r border-gray-700 flex items-center gap-2 cursor-pointer hover:bg-gray-700/30 transition-colors"
                          onClick={() => handleTaskClick(task)}
                        >
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }}></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] md:text-xs text-white truncate">{task.title}</p>
                            <p className="text-[9px] md:text-[10px] text-gray-500 mt-0.5">{STATUS_CONFIG[task.status]?.label}{task.progress > 0 ? ` · ${task.progress}%` : ''}</p>
                          </div>
                          <i className="fa-solid fa-chevron-right text-[8px] text-gray-600 flex-shrink-0"></i>
                        </div>
                        <div className="flex-1 relative py-2" style={{ minHeight: 40 }}>
                          <div className="absolute inset-0 flex">
                            {columns.map(week => (
                              <div key={week.key} className="flex-1 border-r border-gray-700/30 last:border-r-0 flex">
                                {week.days.map(day => (
                                  <div key={day.date.toISOString().split('T')[0]} className={`flex-1 border-r border-gray-700/20 last:border-r-0 ${day.isToday ? 'bg-indigo-500/5' : ''}`}></div>
                                ))}
                              </div>
                            ))}
                          </div>
                          {/* Today vertical line */}
                          {todayMs >= minDateMs && totalRangeMs > 0 && (
                            <div className="absolute top-0 bottom-0 w-0 border-l-2 border-indigo-500 z-20" style={{ left: `${((todayMs - minDateMs) / totalRangeMs) * 100}%` }}></div>
                          )}
                          <div
                            className="absolute top-1.5 h-[26px] rounded-md cursor-pointer hover:brightness-110 transition-all shadow-md z-10"
                            style={{ left: `${task.left}%`, width: `${task.width}%`, minWidth: 32, backgroundColor: task.color }}
                            onClick={() => handleTaskClick(task)}
                          >
                            <div className="absolute left-0 top-0 h-full rounded-md opacity-50" style={{ width: `${task.progress || 0}%`, backgroundColor: task.color, filter: 'brightness(1.5)' }}></div>
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] md:text-[10px] font-medium text-white drop-shadow px-1 truncate">{task.title}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                    <div className="flex">
                      <div className="w-[200px] md:w-[260px] flex-shrink-0 px-3 md:px-4 py-2 text-[10px] md:text-xs font-semibold text-gray-400 border-r border-gray-700">
                        Task Name
                      </div>
                      <div className="flex flex-1 overflow-x-auto">
                        {columns.map(col => (
                          <div
                            key={col.key}
                            className={`flex-shrink-0 text-center py-1 border-r border-gray-700/30 last:border-r-0 ${col.isToday ? 'bg-indigo-500/10' : ''}`}
                            style={{ width: colWidth }}
                          >
                            <div className={`text-[7px] md:text-[8px] leading-none ${col.isToday ? 'text-indigo-400 font-bold' : col.isWeekend ? 'text-gray-600' : 'text-gray-500'}`}>{col.dayName}</div>
                            <div className={`text-[8px] md:text-[9px] leading-tight mt-px ${col.isToday ? 'text-indigo-400 font-bold' : col.isWeekend ? 'text-gray-500' : 'text-gray-400'}`}>{col.dayNum}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-700/30">
                    {timelineData.map((task) => (
                      <div key={task.id} className={`flex group ${selectedTask?.id === task.id ? 'bg-indigo-500/10' : ''}`}>
                        <div
                          className="w-[200px] md:w-[260px] flex-shrink-0 px-3 md:px-4 py-2 border-r border-gray-700 flex items-center gap-2 cursor-pointer hover:bg-gray-700/30 transition-colors"
                          onClick={() => handleTaskClick(task)}
                        >
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }}></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] md:text-xs text-white truncate">{task.title}</p>
                            <p className="text-[9px] md:text-[10px] text-gray-500 mt-0.5">{STATUS_CONFIG[task.status]?.label}{task.progress > 0 ? ` · ${task.progress}%` : ''}</p>
                          </div>
                          <i className="fa-solid fa-chevron-right text-[8px] text-gray-600 flex-shrink-0"></i>
                        </div>
                        <div className="flex-1 relative py-2" style={{ minHeight: 40 }}>
                          <div className="absolute inset-0 flex">
                            {columns.map((col, i) => (
                              <div key={col.key} className={`flex-shrink-0 border-r border-gray-700/20 last:border-r-0 ${col.isToday ? 'bg-indigo-500/5' : ''}`} style={{ width: colWidth }}></div>
                            ))}
                          </div>
                          {/* Today vertical line */}
                          {todayMs >= minDateMs && totalRangeMs > 0 && (
                            <div className="absolute top-0 bottom-0 w-0 border-l-2 border-indigo-500 z-20" style={{ left: `${((todayMs - minDateMs) / totalRangeMs) * 100}%` }}></div>
                          )}
                          <div
                            className="absolute top-1.5 h-[26px] rounded-md cursor-pointer hover:brightness-110 transition-all shadow-md z-10"
                            style={{ left: `${task.left}%`, width: `${task.width}%`, minWidth: 28, backgroundColor: task.color }}
                            onClick={() => handleTaskClick(task)}
                          >
                            <div className="absolute left-0 top-0 h-full rounded-md opacity-50" style={{ width: `${task.progress || 0}%`, backgroundColor: task.color, filter: 'brightness(1.5)' }}></div>
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] md:text-[10px] font-medium text-white drop-shadow px-1 truncate">{task.title}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedTask && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden animate-fade-in">
            <div className="p-4 md:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: selectedTask.color + '30' }}>
                    <i className={`fa-solid ${STATUS_CONFIG[selectedTask.status]?.icon || 'fa-circle'} text-sm`} style={{ color: selectedTask.color }}></i>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-bold text-white truncate">{selectedTask.title}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${STATUS_CONFIG[selectedTask.status]?.badge || ''}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedTask.color }}></span>
                        {STATUS_CONFIG[selectedTask.status]?.label || selectedTask.status}
                      </span>
                      {selectedTask.priority && (
                        <span className={`text-[10px] md:text-xs ${PRIORITY_CONFIG[selectedTask.priority]?.color || 'text-gray-400'}`}>
                          <i className={`fa-solid ${PRIORITY_CONFIG[selectedTask.priority]?.icon || 'fa-minus'} mr-0.5`}></i>
                          {PRIORITY_CONFIG[selectedTask.priority]?.label || selectedTask.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-white transition-colors flex-shrink-0 p-1">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="bg-gray-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] md:text-xs text-gray-400">Progress</span>
                  <span className="text-[10px] md:text-xs font-bold text-white">{selectedTask.progress || 0}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${selectedTask.progress || 0}%`, backgroundColor: selectedTask.color }}></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <p className="text-[9px] md:text-[10px] text-gray-400 mb-1"><i className="fa-solid fa-calendar-day mr-1"></i>Start</p>
                  <p className="text-[11px] md:text-xs text-white font-medium">{formatDate(parseDate(selectedTask.start_date))}</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <p className="text-[9px] md:text-[10px] text-gray-400 mb-1"><i className="fa-solid fa-calendar-check mr-1"></i>Due</p>
                  <p className="text-[11px] md:text-xs text-white font-medium">{formatDate(parseDate(selectedTask.deadline))}</p>
                </div>
              </div>

              {selectedTask.deadline && (() => {
                const dl = daysLeft(parseDate(selectedTask.deadline))
                if (dl === null) return null
                return (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] md:text-xs font-medium ${dl < 0 ? 'bg-red-500/10 text-red-400' : dl <= 2 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <i className={`fa-solid ${dl < 0 ? 'fa-circle-exclamation' : dl <= 2 ? 'fa-clock' : 'fa-circle-check'}`}></i>
                    {dl < 0 ? `${Math.abs(dl)} days overdue` : dl === 0 ? 'Due today' : `${dl} days remaining`}
                  </div>
                )
              })()}

              <div className="flex gap-2">
                <a
                  href={`/task/${selectedTask.id}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
                >
                  <i className="fa-solid fa-up-right-from-square"></i> Open Task Detail
                </a>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs md:text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </Layout>
  )
}
