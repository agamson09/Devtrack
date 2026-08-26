import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Avatar from '@/components/common/Avatar'
import { useAuth } from '@/components/AuthContext'
import { useSocket } from '@/components/SocketContext'
import { useTenant } from '@/hooks/useTenant'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/dashboard/projects': 'Projects',
  '/dashboard/wiki': 'Wiki',
  '/dashboard/settings': 'Settings',
  '/dashboard/team': 'Team Management',
  '/dashboard/chat': 'Chat',
  '/dashboard/it-support': 'IT Support',
  '/dashboard/it-support/purchases': 'Purchase Requests',
  '/dashboard/it-support/inventory': 'IT Inventory',
  '/dashboard/it-support/passwords': 'Password Vault',
  '/dashboard/it-support/ip-addresses': 'IP Address Management',
  '/dashboard/it-support/ai-search': 'AI Product Search',
}

const NOTIF_ICONS = {
  task_assigned: 'fa-user-check',
  task_created: 'fa-plus-circle',
  task_updated: 'fa-pen',
  task_deleted: 'fa-trash',
  status_changed: 'fa-arrow-right',
  new_comment: 'fa-comment',
  new_commit: 'fa-code-commit',
  mention: 'fa-at',
  checklist_changed: 'fa-list-check',
  file_uploaded: 'fa-paperclip',
  labels_changed: 'fa-tag',
  deadline_approaching: 'fa-clock',
  chat_mention: 'fa-at',
  chat_message: 'fa-comment',
  group_mention: 'fa-at',
  group_joined: 'fa-users',
  group_removed: 'fa-user-minus',
  group_message: 'fa-comments',
  reaction: 'fa-face-smile',
  call_missed: 'fa-phone-slash',
  project_created: 'fa-folder-plus',
  project_updated: 'fa-pen',
  project_deleted: 'fa-trash',
  deploy_executed: 'fa-rocket',
  deploy_failed: 'fa-triangle-exclamation',
  purchase_created: 'fa-cart-plus',
  purchase_approved: 'fa-check-circle',
  purchase_rejected: 'fa-times-circle',
  inventory_assigned: 'fa-box',
  user_created: 'fa-user-plus',
  role_changed: 'fa-shield',
  password_changed: 'fa-key',
  login_new_device: 'fa-desktop',
  brute_force: 'fa-shield-halved',
  system_config: 'fa-gear',
  agent_offline: 'fa-desktop',
}

const NOTIF_COLORS = {
  task_assigned: 'text-blue-400',
  task_created: 'text-green-400',
  status_changed: 'text-yellow-400',
  new_comment: 'text-purple-400',
  new_commit: 'text-indigo-400',
  mention: 'text-pink-400',
  chat_mention: 'text-pink-400',
  group_mention: 'text-pink-400',
  deploy_executed: 'text-green-400',
  deploy_failed: 'text-red-400',
  brute_force: 'text-red-400',
  login_new_device: 'text-yellow-400',
  deadline_approaching: 'text-orange-400',
  reaction: 'text-yellow-400',
}

const NOTIF_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'task', label: 'Tasks', types: ['task_assigned', 'task_created', 'task_updated', 'task_deleted', 'status_changed', 'new_commit', 'checklist_changed', 'file_uploaded', 'labels_changed', 'deadline_approaching'] },
  { key: 'comment', label: 'Comments', types: ['new_comment', 'mention'] },
  { key: 'chat', label: 'Chat', types: ['chat_mention', 'chat_message', 'group_mention', 'group_joined', 'group_message', 'reaction', 'call_missed'] },
  { key: 'system', label: 'System', types: ['project_created', 'project_updated', 'deploy_executed', 'deploy_failed', 'purchase_approved', 'purchase_rejected', 'inventory_assigned', 'role_changed', 'login_new_device', 'brute_force', 'system_config', 'agent_offline'] },
]

let notifAudio = null

export default function Header({ onToggleSidebar }) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const socket = useSocket()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [themeIcon, setThemeIcon] = useState('dark')

  useEffect(() => {
    setThemeIcon(document.documentElement.classList.contains('light') ? 'light' : 'dark')
  }, [])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifFilter, setNotifFilter] = useState('all')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)
  const { settings: tenantSettings } = useTenant()

  const pageTitle = pageTitles[router.pathname] ||
    (router.pathname.startsWith('/dashboard/projects/') ? 'Project Detail' :
    router.pathname.startsWith('/task/') ? 'Task Detail' : 'DevTrack')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notif_sound')
      if (saved !== null) setSoundEnabled(saved === 'true')
    }
  }, [])

  const playNotifSound = useCallback(() => {
    if (!soundEnabled) return
    try {
      if (!notifAudio) {
        notifAudio = new Audio('/sounds/notification.mp3')
        notifAudio.volume = 0.5
      }
      notifAudio.currentTime = 0
      notifAudio.play().catch(() => {})
    } catch {}
  }, [soundEnabled])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    if (!socket) return

    const handleNewNotif = (notif) => {
      setNotifications(prev => [notif, ...prev].slice(0, 50))
      setUnreadCount(prev => prev + 1)
      playNotifSound()
    }

    const handleUnreadCount = (data) => {
      setUnreadCount(data.unreadCount)
    }

    socket.on('notification:new', handleNewNotif)
    socket.on('notification:unread-count', handleUnreadCount)

    return () => {
      socket.off('notification:new', handleNewNotif)
      socket.off('notification:unread-count', handleUnreadCount)
    }
  }, [socket, playNotifSound])

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (err) {}
  }

  async function markAllRead() {
    try {
      await fetch('/api/notifications', { method: 'POST' })
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })))
      if (socket) socket.emit('notification:read-all')
    } catch (err) {}
  }

  async function markNotifRead(id) {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PUT' })
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: 1 } : n))
      setUnreadCount((prev) => Math.max(0, prev - 1))
      if (socket) socket.emit('notification:read', { notificationId: id })
    } catch (err) {}
  }

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'all') return true
    const filter = NOTIF_FILTERS.find(f => f.key === notifFilter)
    return filter?.types?.includes(n.type)
  })

  return (
    <header className="sticky top-0 z-30 bg-gray-900/75 backdrop-blur-xl border-b border-gray-800/80">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden text-gray-400 hover:text-white p-2 -ml-2 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Open menu"
          >
            <i className="fa-solid fa-bars text-lg"></i>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold gradient-text truncate">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block relative group">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 text-sm transition-colors"></i>
            <input
              type="text"
              placeholder="Search tasks, projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery.trim())}`)
                }
              }}
              className="w-56 lg:w-64 pl-10 pr-14 py-2 bg-gray-800/70 border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/50 focus:w-72 focus:bg-gray-800 transition-all duration-300 ease-out-expo"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex px-1.5 py-0.5 bg-gray-700/80 border border-gray-600 rounded text-[10px] text-gray-400 font-mono pointer-events-none">
              Ctrl K
            </kbd>
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => {
              const next = document.documentElement.classList.contains('light') ? 'dark' : 'light'
              document.documentElement.classList.toggle('light', next === 'light')
              try { localStorage.setItem('devtrack_theme', next) } catch {}
              setThemeIcon(next)
            }}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
            title={themeIcon === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <i className={`fa-solid ${themeIcon === 'light' ? 'fa-moon' : 'fa-sun'} text-lg`}></i>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(!notifOpen); setDropdownOpen(false) }}
              className={`relative p-2 rounded-lg transition-colors ${notifOpen ? 'text-indigo-300 bg-indigo-500/10' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              aria-label="Notifications"
            >
              <i className="fa-solid fa-bell text-lg"></i>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-gray-900 animate-pulse-soft">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-[420px] glass-panel !rounded-xl z-50 animate-scale-in origin-top-right overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const next = !soundEnabled
                        setSoundEnabled(next)
                        localStorage.setItem('notif_sound', String(next))
                      }}
                      className={`text-xs p-1 rounded ${soundEnabled ? 'text-indigo-400' : 'text-gray-500'}`}
                      title={soundEnabled ? 'Sound on' : 'Sound off'}
                    >
                      <i className={`fa-solid ${soundEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
                    </button>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-indigo-400 hover:text-indigo-300">
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 px-3 py-2 border-b border-gray-700 overflow-x-auto">
                  {NOTIF_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setNotifFilter(f.key)}
                      className={`px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
                        notifFilter === f.key
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {filteredNotifications.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-8">No notifications</p>
                  ) : (
                    filteredNotifications.slice(0, 30).map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (!notif.is_read) markNotifRead(notif.id)
                          if (notif.link) router.push(notif.link)
                          setNotifOpen(false)
                        }}
                        className={`px-4 py-3 border-b border-gray-700/50 cursor-pointer hover:bg-gray-700/50 transition-colors ${
                          !notif.is_read ? 'bg-indigo-500/5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 ${NOTIF_COLORS[notif.type] || 'text-gray-400'}`}>
                            <i className={`fa-solid ${NOTIF_ICONS[notif.type] || 'fa-bell'} text-sm`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white">{notif.title}</p>
                              {!notif.is_read && (
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></div>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{notif.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(notif.created_at).toLocaleString()}
                              {notif.group_count > 1 && (
                                <span className="ml-1 text-indigo-400">({notif.group_count})</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false) }}
              className={`flex items-center gap-2 p-1 pr-2 rounded-xl transition-colors ${dropdownOpen ? 'bg-gray-800' : 'hover:bg-gray-800/80'}`}
            >
               <Avatar name={user?.name} src={user?.avatar} avatarStyle={user?.avatar_style} avatarSeed={user?.avatar_seed} avatarOptions={user?.avatar_options} size="sm" />
              <span className="hidden sm:block text-sm text-gray-300">{user?.name}</span>
              <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}></i>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 glass-panel !rounded-xl py-1.5 animate-scale-in origin-top-right">
                <button
                  onClick={() => { setDropdownOpen(false); router.push('/dashboard/settings') }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 mx-auto text-sm text-gray-300 hover:bg-gray-700/60 hover:text-white text-left transition-colors"
                >
                  <i className="fa-solid fa-user-gear w-4 text-center"></i>
                  Profile
                </button>
                <hr className="border-gray-700/70 my-1" />
                <button
                  onClick={async () => { setDropdownOpen(false); await logout(); router.push('/login') }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <i className="fa-solid fa-right-from-bracket w-4 text-center"></i>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
