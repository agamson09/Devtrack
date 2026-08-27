import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/ToastContext'

export default function SelectWorkspacePage() {
  const router = useRouter()
  const { user, workspaceSelection, selectWorkspace, clearWorkspaceSelection } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [branding, setBranding] = useState({ appName: 'DevTrack', logo: '', primaryColor: '#6366f1' })
  const [workspaces, setWorkspaces] = useState([])

  useEffect(() => {
    // Load branding
    fetch('/api/tenant/settings')
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setBranding({
            appName: data.settings.app_name || 'DevTrack',
            logo: data.settings.logo_url || '',
            primaryColor: data.settings.primary_color || '#6366f1',
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    // If we have workspace selection data from AuthContext, use it
    if (workspaceSelection?.workspaces) {
      setWorkspaces(workspaceSelection.workspaces)
      return
    }

    // Otherwise, fetch from API
    const fetchWorkspaces = async () => {
      try {
        const token = localStorage.getItem('devtrack_socket_token')
        if (!token) {
          router.push('/login')
          return
        }

        const res = await fetch('/api/tenant/my-tenants', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        })

        if (res.ok) {
          const data = await res.json()
          if (data.tenants && data.tenants.length > 0) {
            setWorkspaces(data.tenants)
          } else {
            // No workspaces — redirect to register
            showToast('info', 'No workspaces found. Create one to get started.')
            router.push('/register')
          }
        } else {
          router.push('/login')
        }
      } catch (err) {
        router.push('/login')
      }
    }

    fetchWorkspaces()
  }, [workspaceSelection, router, showToast])

  const handleSelect = async (workspaceId) => {
    setLoading(true)
    try {
      const result = await selectWorkspace(workspaceId)
      if (result.success) {
        showToast('success', `Switched to ${result.tenant?.name || 'workspace'}`)
        router.push('/dashboard')
      } else {
        showToast('error', result.error || 'Failed to select workspace')
      }
    } catch (err) {
      showToast('error', 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="force-dark min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${branding.primaryColor}15 0%, #111827 50%, ${branding.primaryColor}10 100%)`,
      }}
    >
      {/* Ambient glow blobs */}
      <div
        className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full blur-[120px] opacity-20 animate-float pointer-events-none"
        style={{ background: branding.primaryColor }}
      />
      <div
        className="absolute -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full blur-[130px] opacity-15 animate-float pointer-events-none"
        style={{ background: '#7c3aed', animationDelay: '2.5s' }}
      />
      <div className="absolute inset-0 bg-gray-900/70" />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            {branding.logo ? (
              <img src={branding.logo} alt={branding.appName} className="h-16 w-auto drop-shadow-lg" />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-glow overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.primaryColor}aa)` }}
              >
                <img src="/favicon-white.webp" alt={branding.appName} className="w-12 h-12 object-contain" />
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold gradient-text">Select Workspace</h1>
          <p className="text-gray-400 mt-2">Choose a workspace to continue</p>
        </div>

        <div className="glass-panel p-6">
          {workspaces.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="animate-spin h-8 w-8 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading workspaces...
            </div>
          ) : (
            <div className="space-y-3">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-700/40 hover:bg-gray-600/60 border border-gray-600/50 hover:border-gray-500/70 text-left transition-all duration-200 group disabled:opacity-50"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0"
                    style={{ background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.primaryColor}aa)` }}
                  >
                    {ws.name?.charAt(0)?.toUpperCase() || 'W'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">{ws.name}</div>
                    <div className="text-xs text-gray-400 capitalize">{ws.role || 'member'}</div>
                  </div>
                  <i className="fa-solid fa-arrow-right text-gray-500 group-hover:text-white transition-colors"></i>
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-gray-700/60 text-center">
            <button
              onClick={() => {
                clearWorkspaceSelection()
                router.push('/login')
              }}
              className="text-gray-400 hover:text-gray-200 transition-colors text-sm"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
