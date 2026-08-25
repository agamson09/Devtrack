import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/components/AuthContext'

/**
 * Command Palette (Ctrl+K)
 * - Static navigation commands + quick actions, filtered locally
 * - Live results from /api/search (tasks, projects, wiki notes) once query >= 2 chars
 * - Full keyboard control: arrows / enter / esc
 */
export default function CommandPalette({ onClose }) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState({ tasks: [], projects: [], notes: [] })
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const isAdmin = user?.role === 'admin'
  const isIT = isAdmin || user?.role === 'it_support'

  const commands = useMemo(() => {
    const nav = [
      { icon: 'fa-gauge-high', label: 'Dashboard', hint: 'Halaman utama', href: '/dashboard' },
      { icon: 'fa-folder-open', label: 'Projects', hint: 'Semua proyek', href: '/dashboard/projects' },
      { icon: 'fa-clipboard-check', label: 'My Tasks', hint: 'Tugas saya', href: '/dashboard/my-tasks' },
      { icon: 'fa-calendar-days', label: 'Calendar', hint: 'Kalender & deadline', href: '/dashboard/calendar' },
      { icon: 'fa-comments', label: 'Chat', hint: 'Pesan tim', href: '/dashboard/chat' },
      { icon: 'fa-book-open', label: 'Wiki', hint: 'Knowledge base', href: '/dashboard/wiki' },
      { icon: 'fa-chart-column', label: 'Reports', hint: 'Laporan', href: '/dashboard/reports' },
      { icon: 'fa-users', label: 'Team', hint: 'Anggota tim', href: '/dashboard/team' },
      { icon: 'fa-rocket', label: 'Deploy', hint: 'Deploy aplikasi', href: '/dashboard/deploy' },
      { icon: 'fa-server', label: 'Remote', hint: 'Akses server', href: '/dashboard/remote' },
      { icon: 'fa-database', label: 'Database', hint: 'Backup & SQL console', href: '/dashboard/database' },
      { icon: 'fa-shield-halved', label: 'Security Logs', hint: 'Log keamanan', href: '/dashboard/security' },
      { icon: 'fa-clock-rotate-left', label: 'Activity Log', hint: 'Riwayat aktivitas', href: '/dashboard/activity' },
      { icon: 'fa-sliders', label: 'Settings', hint: 'Preferensi akun', href: '/dashboard/settings' },
    ]
    if (isIT) {
      nav.push(
        { icon: 'fa-boxes-stacked', label: 'IT Inventory', hint: 'Aset & perangkat', href: '/dashboard/it-support' },
        { icon: 'fa-key', label: 'Password Vault', hint: 'Kredensial terenkripsi', href: '/dashboard/it-support/passwords' }
      )
    }
    if (isAdmin) {
      nav.push(
        { icon: 'fa-user-gear', label: 'Admin Panel', hint: 'Kelola pengguna', href: '/dashboard/admin' },
        { icon: 'fa-terminal', label: 'Env Editor', hint: 'Variabel environment', href: '/dashboard/env-editor' }
      )
    }

    const actions = [
      {
        icon: 'fa-plus',
        label: 'Task Baru',
        hint: 'Buat task pada proyek aktif',
        run: () => {
          const btn = document.querySelector('[data-add-task-btn]')
          if (btn) {
            btn.click()
          } else {
            router.push('/dashboard/projects')
          }
        },
      },
      {
        icon: 'fa-file-lines',
        label: 'Catatan Wiki Baru',
        hint: 'Tambah dokumen knowledge base',
        run: () => {
          window.dispatchEvent(new Event('devtrack:new-wiki-note'))
          router.push('/dashboard/wiki')
        },
      },
      {
        icon: 'fa-right-from-bracket',
        label: 'Keluar',
        hint: 'Logout dari DevTrack',
        run: async () => {
          await logout()
          router.push('/login')
        },
      },
    ]

    return [...nav, ...actions]
  }, [isAdmin, isIT, router, logout])

  // Live search (debounced) against the global search API
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setRemote({ tasks: [], projects: [], notes: [] })
      setSearching(false)
      return
    }
    setSearching(true)
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        if (res.ok && !cancelled) setRemote(await res.json())
      } catch {
        /* keep previous results */
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  const lowerQuery = query.trim().toLowerCase()
  const filteredCommands = useMemo(() => (
    !lowerQuery ? commands : commands.filter(c =>
      c.label.toLowerCase().includes(lowerQuery) || (c.hint || '').toLowerCase().includes(lowerQuery)
    )
  ), [commands, lowerQuery])

  const remoteGroups = useMemo(() => [
    { key: 'task', title: 'Tasks', items: remote.tasks.map(r => ({
      key: `t-${r.id}`,
      icon: 'fa-clipboard-check',
      badge: 'Task',
      badgeClass: 'bg-blue-500/15 text-blue-300',
      label: r.title,
      sub: r.project_name || '',
      run: () => router.push(`/task/${r.id}`),
    })) },
    { key: 'proj', title: 'Proyek', items: remote.projects.map(r => ({
      key: `p-${r.id}`,
      icon: 'fa-folder-open',
      badge: 'Proyek',
      badgeClass: 'bg-emerald-500/15 text-emerald-300',
      label: r.name,
      sub: r.description || '',
      run: () => router.push(`/dashboard/projects/${r.id}`),
    })) },
    { key: 'wiki', title: 'Wiki', items: remote.notes.map(r => ({
      key: `w-${r.id}`,
      icon: 'fa-book-open',
      badge: 'Wiki',
      badgeClass: 'bg-indigo-500/15 text-indigo-300',
      label: r.title,
      sub: r.project_name || '',
      run: () => router.push(`/dashboard/wiki?note=${r.id}`),
    })) },
  ].filter(g => g.items.length > 0), [remote, router])

  const flatItems = useMemo(() => [
    ...filteredCommands.map(c => ({ ...c })),
    ...remoteGroups.flatMap(g => g.items),
  ], [filteredCommands, remoteGroups])

  useEffect(() => { setSelected(0) }, [query])

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-idx="${selected}"]`)
      if (el) el.scrollIntoView({ block: 'nearest' })
    }
  }, [selected])

  const runItem = useCallback((item) => {
    onClose()
    if (item.href) router.push(item.href)
    else if (item.run) item.run()
  }, [onClose, router])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatItems[selected]
      if (item) runItem(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }, [flatItems, selected, runItem, onClose])

  useEffect(() => {
    inputRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  let idx = -1

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4 animate-fade-in"
      onMouseDown={onClose}>
      <div className="w-full max-w-xl glass-panel border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-scale-in"
        onMouseDown={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-700/70">
          <i className="fa-solid fa-magnifying-glass text-gray-400"></i>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari perintah, task, proyek, atau catatan wiki…"
            className="flex-1 bg-transparent outline-none text-white placeholder-gray-500 text-sm"
          />
          {searching && <i className="fa-solid fa-circle-notch fa-spin text-gray-500 text-xs"></i>}
          <kbd className="px-1.5 py-0.5 bg-gray-700/60 border border-gray-600 rounded text-[10px] text-gray-400 font-mono">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-2">
          {flatItems.length === 0 && (
            <div className="px-4 py-10 text-center">
              <i className="fa-solid fa-ghost text-3xl text-gray-600 mb-2 block"></i>
              <p className="text-gray-400 text-sm">Tidak ada hasil untuk &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {(filteredCommands.length > 0 || (!lowerQuery)) && (
            <>
              {!lowerQuery && filteredCommands.length > 0 && (
                <div className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Navigasi</div>
              )}
              {filteredCommands.map(cmd => {
                idx += 1
                const active = idx === selected
                return (
                  <button
                    key={cmd.label}
                    data-idx={idx}
                    onMouseEnter={() => setSelected(idx)}
                    onClick={() => runItem(cmd)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-indigo-500/20' : ''}`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-indigo-500/30 text-indigo-200' : 'bg-gray-700/50 text-gray-400'}`}>
                      <i className={`fa-solid ${cmd.icon} text-xs`}></i>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white truncate">{cmd.label}</span>
                      {cmd.hint && <span className="block text-[11px] text-gray-500 truncate">{cmd.hint}</span>}
                    </span>
                    {cmd.href && <i className="fa-solid fa-arrow-right-turn-down text-gray-600 text-xs"></i>}
                  </button>
                )
              })}
            </>
          )}

          {remoteGroups.map(group => (
            <div key={group.key}>
              {lowerQuery && group.items.length > 0 && (
                <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{group.title}</div>
              )}
              {group.items.map(item => {
                idx += 1
                const active = idx === selected
                return (
                  <button
                    key={item.key}
                    data-idx={idx}
                    onMouseEnter={() => setSelected(idx)}
                    onClick={() => runItem(item)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-indigo-500/20' : ''}`}
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-gray-700/50 text-gray-400">
                      <i className={`fa-solid ${item.icon} text-xs`}></i>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white truncate">{item.label}</span>
                      {item.sub && <span className="block text-[11px] text-gray-500 truncate">{item.sub}</span>}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.badgeClass}`}>{item.badge}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-700/70 bg-gray-800/40 text-[10px] text-gray-500">
          <span><kbd className="px-1 py-0.5 bg-gray-700/60 border border-gray-600 rounded">↑↓</kbd> navigasi</span>
          <span><kbd className="px-1 py-0.5 bg-gray-700/60 border border-gray-600 rounded">↵</kbd> buka</span>
          <span><kbd className="px-1 py-0.5 bg-gray-700/60 border border-gray-600 rounded">esc</kbd> tutup</span>
        </div>
      </div>
    </div>
  )
}
