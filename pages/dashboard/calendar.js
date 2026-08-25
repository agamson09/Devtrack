import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/layout/Layout'
import Loading from '@/components/common/Loading'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function TaskDot({ task, onClick }) {
  const priorityColors = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-blue-500',
    low: 'bg-gray-500',
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(task) }}
      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate border border-transparent hover:border-gray-500 transition-colors ${priorityColors[task.priority] || 'bg-gray-600'} text-white`}
      title={`${task.title} (${task.priority})`}
    >
      {task.title}
    </button>
  )
}

export default function CalendarPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState('month')
  const [selectedTask, setSelectedTask] = useState(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    fetchProjects()
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [year, month, filterProject, filterAssignee])

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch {}
  }

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch {}
  }

  async function fetchTasks() {
    setLoading(true)
    try {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${getDaysInMonth(year, month)}`
      let url = `/api/tasks/calendar?start=${start}&end=${end}`
      if (filterProject) url += `&project_id=${filterProject}`
      if (filterAssignee) url += `&assigned_to=${filterAssignee}`
      const res = await fetch(url)
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const tasksByDate = useCallback(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.deadline) {
        const key = (task.deadline || '').split('T')[0].split(' ')[0]
        if (!map[key]) map[key] = []
        map[key].push(task)
      }
      if (task.start_date) {
        const key = (task.start_date || '').split('T')[0].split(' ')[0]
        if (!map[key]) map[key] = []
        if (!task.deadline || key !== (task.deadline || '').split('T')[0].split(' ')[0]) {
          map[key].push({ ...task, _isStart: true })
        }
      }
    })
    return map
  }, [tasks])()

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = formatDate(new Date())

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  function goToday() {
    setCurrentDate(new Date())
  }

  function getWeekDates() {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
    const dates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      dates.push(d)
    }
    return dates
  }

  const weekDates = view === 'week' ? getWeekDates() : []

  return (
    <Layout>
      <div className="p-3 md:p-6 max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Calendar</h1>
            <p className="text-gray-400 text-xs md:text-sm mt-1">{MONTHS[month]} {year}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="bg-gray-700 text-white text-xs md:text-sm rounded-lg px-2 md:px-3 py-1.5 md:py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none min-w-0 max-w-[140px]">
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="bg-gray-700 text-white text-xs md:text-sm rounded-lg px-2 md:px-3 py-1.5 md:py-2 border border-gray-600 focus:border-indigo-500 focus:outline-none min-w-0 max-w-[140px]">
              <option value="">All Members</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <div className="flex bg-gray-700 rounded-lg border border-gray-600 overflow-hidden">
              <button onClick={() => setView('month')} className={`px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium transition-colors ${view === 'month' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>Month</button>
              <button onClick={() => setView('week')} className={`px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium transition-colors ${view === 'week' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>Week</button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors">
            <i className="fa-solid fa-chevron-left text-sm"></i>
          </button>
          <button onClick={goToday} className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors">Today</button>
          <button onClick={nextMonth} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors">
            <i className="fa-solid fa-chevron-right text-sm"></i>
          </button>
          <span className="text-white font-semibold ml-2">{MONTHS[month]} {year}</span>
        </div>

        {loading ? <Loading /> : view === 'month' ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="grid grid-cols-7">
              {DAYS.map(day => (
                <div key={day} className="px-1 md:px-2 py-1.5 md:py-2 text-center text-[10px] md:text-xs font-semibold text-gray-400 border-b border-gray-700">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[60px] md:min-h-[100px] border-b border-r border-gray-700 bg-gray-800/50"></div>
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayTasks = tasksByDate[dateStr] || []
                const isToday = dateStr === today
                return (
                  <div key={day} className={`min-h-[60px] md:min-h-[100px] border-b border-r border-gray-700 p-0.5 md:p-1 ${isToday ? 'bg-indigo-900/20' : ''}`}>
                    <div className={`text-[10px] md:text-xs font-medium mb-0.5 md:mb-1 px-0.5 md:px-1 ${isToday ? 'text-indigo-400 font-bold' : 'text-gray-400'}`}>{day}</div>
                    <div className="space-y-px">
                      {dayTasks.slice(0, 2).map((task, ti) => (
                        <TaskDot key={`${task.id}-${ti}`} task={task} onClick={setSelectedTask} />
                      ))}
                      {dayTasks.length > 2 && (
                        <span className="text-[9px] md:text-[10px] text-gray-500 px-0.5 md:px-1">+{dayTasks.length - 2}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="grid grid-cols-7">
              {weekDates.map((d, i) => {
                const dateStr = formatDate(d)
                const dayTasks = tasksByDate[dateStr] || []
                const isToday = dateStr === today
                return (
                  <div key={i} className={`min-h-[120px] md:min-h-[200px] border-b border-r border-gray-700 p-1 md:p-2 ${isToday ? 'bg-indigo-900/20' : ''}`}>
                    <div className={`text-[10px] md:text-xs font-medium mb-1 md:mb-2 ${isToday ? 'text-indigo-400 font-bold' : 'text-gray-400'}`}>
                      <span className="hidden sm:inline">{DAYS[d.getDay()]} </span>{d.getDate()}
                    </div>
                    <div className="space-y-0.5 md:space-y-1">
                      {dayTasks.slice(0, 4).map((task, ti) => (
                        <TaskDot key={`${task.id}-${ti}`} task={task} onClick={setSelectedTask} />
                      ))}
                      {dayTasks.length > 4 && (
                        <span className="text-[9px] md:text-[10px] text-gray-500">+{dayTasks.length - 4} more</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {selectedTask && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={() => setSelectedTask(null)}>
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white text-lg font-bold">{selectedTask.title}</h3>
                  <p className="text-gray-400 text-sm">{selectedTask.project_name}</p>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-white">
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm w-24">Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedTask.status === 'done' ? 'bg-emerald-500/20 text-emerald-400' :
                    selectedTask.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' :
                    selectedTask.status === 'review' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{selectedTask.status?.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm w-24">Priority:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedTask.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                    selectedTask.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    selectedTask.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{selectedTask.priority}</span>
                </div>
                {selectedTask.assignee_name && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm w-24">Assignee:</span>
                    <span className="text-white text-sm">{selectedTask.assignee_name}</span>
                  </div>
                )}
                {selectedTask.deadline && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm w-24">Deadline:</span>
                    <span className="text-white text-sm">{new Date(((selectedTask.deadline || '').split('T')[0].split(' ')[0]) + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                )}
                {selectedTask.labels && selectedTask.labels.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm w-24">Labels:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedTask.labels.map(l => (
                        <span key={l.id} className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: l.color }}>{l.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={() => { setSelectedTask(null); router.push(`/task/${selectedTask.id}`) }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium transition-colors">
                  View Task <i className="fa-solid fa-arrow-right ml-1 text-xs"></i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
