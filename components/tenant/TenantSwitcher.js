import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { useTheme } from '@/hooks/useTheme'

export default function TenantSwitcher({ collapsed }) {
  const { user, refreshUser } = useAuth()
  const { isLight } = useTheme()
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

  return (
    <>
      <div className="relative mx-2 mb-2" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center justify-between p-2 rounded-xl transition-all duration-200 border ${isLight
              ? (open ? 'bg-white border-indigo-200 shadow-sm' : 'bg-gray-50/80 border-gray-200 hover:bg-white hover:border-gray-300')
              : (open ? 'bg-gray-700/80 border-gray-600' : 'bg-gray-800 border-transparent hover:bg-gray-700/50')
            }`}
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-indigo-400">
              {(settings?.app_name || 'D').charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left px-2">
                <p className={`text-sm font-semibold truncate ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  {currentTenant?.name || settings?.app_name || 'Workspace'}
                </p>
                <p className={`text-[10px] truncate ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                  {currentTenant?.slug || 'Personal workspace'}
                </p>
              </div>
              <div className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </>
          )}
        </button>

        {open && (
          <div
            className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl overflow-hidden z-50 transition-all duration-200 origin-top ${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}
          >
            <div className="max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">
              <div className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                Switch Workspace
              </div>

              <div className="space-y-0.5">
                {tenants.map((t) => {
                  const isActive = t.isActive
                  return (
                    <button
                      key={t.id}
                      onClick={() => switchTenant(t.id)}
                      disabled={switching}
                      className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors text-left relative ${isActive
                          ? (isLight ? 'bg-indigo-50' : 'bg-gray-700/50')
                          : (isLight ? 'hover:bg-gray-50' : 'hover:bg-gray-700/30')
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 font-medium ${isActive
                          ? 'bg-indigo-500 text-white'
                          : (isLight ? 'bg-gray-100 text-gray-600' : 'bg-gray-700 text-gray-300')
                        }`}>
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isActive ? (isLight ? 'text-gray-900' : 'text-white') : (isLight ? 'text-gray-700' : 'text-gray-200')}`}>
                          {t.name}
                        </p>
                        <p className={`text-[10px] truncate ${isActive ? (isLight ? 'text-indigo-600' : 'text-indigo-400') : (isLight ? 'text-gray-500' : 'text-gray-400')}`}>
                          {t.slug}
                        </p>
                      </div>
                      {isActive && (
                        <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className={`mt-1 pt-1 border-t ${isLight ? 'border-gray-100' : 'border-gray-700/50'}`}>
                <button
                  onClick={openCreateModal}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors text-left ${isLight ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-900' : 'text-gray-400 hover:bg-gray-700/30 hover:text-white'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create new workspace
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
