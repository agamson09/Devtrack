import { createContext, useContext, useState, useEffect } from 'react'

const TenantContext = createContext(null)

function getCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

const DEFAULT_SETTINGS = {
  app_name: 'DevTrack',
  app_tagline: 'Project Management & IT Support',
  logo_url: '/favicon-white.webp',
  logo_icon_url: '/favicon-white.webp',
  primary_color: '#6366f1',
  accent_color: '#818cf8',
  login_bg: '/favicon-white.webp',
  favicon_url: '/favicon-white.webp',
  footer_text: '© 2026 DevTrack. All rights reserved.',
  theme: 'dark',
  features: {
    projects: true,
    tasks: true,
    chat: true,
    deploy: true,
    remote: true,
    it_support: true,
    terminal: true,
    reports: true,
    calendar: true,
    database: true,
    server_monitor: true,
  },
}

export function TenantProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTenantSettings()
  }, [])

  async function fetchTenantSettings() {
    try {
      // Get active tenant from cookie
      const activeTenantId = getCookie('active_tenant')
      const url = activeTenantId
        ? `/api/tenant/settings?tenantId=${activeTenantId}`
        : '/api/tenant/settings'

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          // Merge with defaults
          const merged = { ...DEFAULT_SETTINGS }
          for (const [key, value] of Object.entries(data.settings)) {
            if (key === 'features') {
              try {
                merged.features = typeof value === 'string' ? JSON.parse(value) : value
              } catch {
                merged.features = DEFAULT_SETTINGS.features
              }
            } else {
              merged[key] = value
            }
          }
          setSettings(merged)
        }
        if (data.tenant) {
          setTenant(data.tenant)
        }

        // Apply primary color as CSS variable
        const primary = data.settings?.primary_color || DEFAULT_SETTINGS.primary_color
        document.documentElement.style.setProperty('--primary-color', primary)

        // Update favicon if custom
        const fav = data.settings?.favicon_url || DEFAULT_SETTINGS.favicon_url
        if (fav) {
          const link = document.querySelector("link[rel*='icon']") || document.createElement('link')
          link.rel = 'icon'
          link.href = fav
          document.head.appendChild(link)
        }
      }
    } catch (err) {
      console.error('Failed to load tenant settings:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <TenantContext.Provider value={{ settings, tenant, loading, refreshSettings: fetchTenantSettings }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    return { settings: DEFAULT_SETTINGS, tenant: null, loading: false, refreshSettings: () => {} }
  }
  return context
}
