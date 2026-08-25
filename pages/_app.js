import { useEffect } from 'react'
import '@/styles/globals.css'
import { AuthProvider } from '@/components/AuthContext'
import { ToastProvider } from '@/components/ToastContext'
import { CallProvider } from '@/components/call/CallContext'
import { SocketProvider } from '@/components/SocketContext'
import { TenantProvider } from '@/hooks/useTenant'
import CallManager from '@/components/call/CallManager'
import ErrorBoundary from '@/components/ErrorBoundary'

function SWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Dev: SW cache-first strategy makes hot-reload serve stale bundles —
    // unregister and wipe caches instead of registering.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {})
      if (window.caches && caches.keys) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
      }
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  return null
}

function CsrfInterceptor() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let isRefreshing = false
    let pendingQueue = []

    async function refreshCSRFToken() {
      try {
        const storedToken = localStorage.getItem('devtrack_socket_token') || ''
        const res = await originalFetch('/api/auth/me', {
          credentials: 'include',
          headers: { Authorization: `Bearer ${storedToken}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.csrfToken) {
            localStorage.setItem('devtrack_csrf', data.csrfToken)
            return data.csrfToken
          }
        }
      } catch (e) {}
      return null
    }

    const originalFetch = window.fetch
    window.fetch = async function (url, options = {}) {
      const method = (options.method || 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'HEAD') {
        let csrfToken = localStorage.getItem('devtrack_csrf') || ''
        const headers = new Headers(options.headers)
        if (csrfToken && !headers.has('X-CSRF-Token')) {
          headers.set('X-CSRF-Token', csrfToken)
        }
        const res = await originalFetch(url, { ...options, headers, credentials: 'include' })

        // Auto-refresh CSRF token on 403 and retry once
        if (res.status === 403) {
          const body = await res.clone().json().catch(() => ({}))
          if (body.error && body.error.includes('CSRF')) {
            if (!isRefreshing) {
              isRefreshing = true
              const newToken = await refreshCSRFToken()
              isRefreshing = false
              pendingQueue.forEach(cb => cb(newToken))
              pendingQueue = []

              if (newToken) {
                const retryHeaders = new Headers(options.headers)
                retryHeaders.set('X-CSRF-Token', newToken)
                return originalFetch(url, { ...options, headers: retryHeaders, credentials: 'include' })
              }
            } else {
              // Another refresh is in progress — wait for it
              return new Promise((resolve) => {
                pendingQueue.push(async (newToken) => {
                  const retryHeaders = new Headers(options.headers)
                  if (newToken) retryHeaders.set('X-CSRF-Token', newToken)
                  resolve(originalFetch(url, { ...options, headers: retryHeaders, credentials: 'include' }))
                })
              })
            }
          }
        }
        return res
      }
      return originalFetch(url, options)
    }

    return () => { window.fetch = originalFetch }
  }, [])

  return null
}

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <TenantProvider>
            <SocketProvider>
              <CallProvider>
                <SWRegister />
                <CsrfInterceptor />
                <CallManager />
                <Component {...pageProps} />
              </CallProvider>
            </SocketProvider>
          </TenantProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
