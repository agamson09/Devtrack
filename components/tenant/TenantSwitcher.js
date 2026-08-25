import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useTenant } from '@/hooks/useTenant'

export default function TenantSwitcher({ collapsed }) {
  const { user, refreshUser } = useAuth()
  const { tenant, settings, refreshSettings } = useTenant()
  const [tenants, setTenants] = useState([])
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef(null)

  // Create workspace modal state
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    fetchTenants()
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchTenants() {
    try {
      const res = await fetch('/api/tenant/my-tenants')
      if (res.ok) {
        const data = await res.json()
        setTenants(data.tenants || [])
      }
    } catch (err) {
      console.error('Failed to load tenants:', err)
    }
  }

  async function switchTenant(tenantId) {
    if (tenantId === tenant?.id || switching) return

    setSwitching(true)
    try {
      const res = await fetch('/api/tenant/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })

      if (res.ok) {
        window.location.reload()
      } else {
        const data = await res.json()
        console.error('Switch failed:', data.error)
      }
    } catch (err) {
      console.error('Switch error:', err)
    } finally {
      setSwitching(false)
      setOpen(false)
    }
  }

  async function handleCreateWorkspace(e) {
    e.preventDefault()
    if (!newName.trim() || newName.trim().length < 2) return

    setCreating(true)
    setCreateError('')

    try {
      const res = await fetch('/api/tenant/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })

      if (res.ok) {
        const data = await res.json()
        // Reload to apply new workspace
        window.location.reload()
      } else {
        const data = await res.json()
        setCreateError(data.error || 'Failed to create workspace')
      }
    } catch {
      setCreateError('Network error')
    } finally {
      setCreating(false)
    }
  }

  function openCreateModal() {
    setOpen(false)
    setNewName('')
    setCreateError('')
    setShowCreate(true)
  }

  const currentTenant = tenants.find(t => t.isActive) || tenants[0]

  // Single tenant view — still show create button
  if (tenants.length <= 1) {
    if (collapsed) return null
    return (
      <>
        <div className="px-3 py-2 mx-2 mb-2 bg-gray-700/30 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-400">
                {(settings?.app_name || 'D').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{settings?.app_name || 'DevTrack'}</p>
              <p className="text-[10px] text-gray-500">Personal workspace</p>
            </div>
            <button
              onClick={openCreateModal}
              title="New workspace"
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Create Workspace Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Create Workspace</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Each workspace gets its own database</p>
                  </div>
                  <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateWorkspace} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Workspace Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. My Project"
                    autoFocus
                    className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                  {newName.trim().length >= 2 && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Database: <span className="text-indigo-400">devtrack_{newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}</span>
                    </p>
                  )}
                </div>

                {createError && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    {createError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || newName.trim().length < 2}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {creating ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Creating...
                      </span>
                    ) : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="relative mx-2 mb-2" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          title={collapsed ? (settings?.app_name || 'DevTrack') : undefined}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all hover:bg-gray-700/50 ${
            collapsed ? 'justify-center' : ''
          } ${open ? 'bg-gray-700/50' : ''}`}
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-indigo-400">
              {(settings?.app_name || 'D').charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-white truncate">{settings?.app_name || 'DevTrack'}</p>
                <p className="text-[10px] text-gray-500 capitalize">{currentTenant?.role || 'member'}</p>
              </div>
              <svg
                className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Workspaces</p>
            </div>

            <div className="max-h-60 overflow-y-auto py-1">
              {tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchTenant(t.id)}
                  disabled={switching}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    t.isActive
                      ? 'bg-indigo-600/10 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  } ${switching ? 'opacity-50' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    t.isActive ? 'bg-indigo-600/30' : 'bg-gray-700'
                  }`}>
                    <span className={`text-sm font-bold ${t.isActive ? 'text-indigo-400' : 'text-gray-400'}`}>
                      {t.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      {t.isActive && (
                        <span className="text-[9px] bg-indigo-600/30 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 capitalize">{t.role}</p>
                  </div>
                  {t.isActive && (
                    <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-700 px-3 py-2">
              <button
                onClick={openCreateModal}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create new workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Create Workspace</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Each workspace gets its own database</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateWorkspace} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Workspace Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. My Project"
                  autoFocus
                  className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                />
                {newName.trim().length >= 2 && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Database: <span className="text-indigo-400">devtrack_{newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}</span>
                  </p>
                )}
              </div>

              {createError && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  {createError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || newName.trim().length < 2}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
