import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [csrfToken, setCsrfToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshTimerRef = useRef(null)

  const scheduleRefresh = useCallback((jwtToken) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const decoded = parseJwt(jwtToken)
    if (!decoded || !decoded.exp) return
    const expiresAt = decoded.exp * 1000
    const refreshAt = expiresAt - 60 * 60 * 1000
    const now = Date.now()
    if (refreshAt > now) {
      refreshTimerRef.current = setTimeout(async () => {
        await checkAuth()
      }, refreshAt - now)
    }
  }, [])

  useEffect(() => {
    const storedToken = localStorage.getItem('devtrack_socket_token')
    const storedCsrf = localStorage.getItem('devtrack_csrf')
    if (storedToken) {
      setToken(storedToken)
      if (storedCsrf) setCsrfToken(storedCsrf)
      scheduleRefresh(storedToken)
    }
    checkAuth()
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current) }
  }, [])

  const checkAuth = async () => {
    try {
      const storedToken = localStorage.getItem('devtrack_socket_token')
      if (!storedToken) { setUser(null); setLoading(false); return }
      // Timeout after 5s so loading never gets stuck
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      let res
      try {
        res = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: { Authorization: `Bearer ${storedToken}` },
          signal: controller.signal
        })
      } finally {
        clearTimeout(timeout)
      }
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setToken(storedToken)
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken)
          localStorage.setItem('devtrack_csrf', data.csrfToken)
        }
        scheduleRefresh(storedToken)
      } else {
        setUser(null)
        setToken(null)
        setCsrfToken(null)
        localStorage.removeItem('devtrack_socket_token')
        localStorage.removeItem('devtrack_csrf')
      }
    } catch (err) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = useCallback(async (email, password, rememberMe = false, twoFactorToken = null, pendingTwoFactor = null) => {
    try {
      const body = { email, password, rememberMe }
      if (twoFactorToken) body.twoFactorToken = twoFactorToken
      if (pendingTwoFactor) body.pendingTwoFactor = pendingTwoFactor

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (!res.ok) {
        return { success: false, error: data.error }
      }

      // 2FA required - return temp token and user info
      if (data.requiresTwoFactor) {
        return { success: false, requiresTwoFactor: true, tempToken: data.tempToken, user: data.user }
      }

      setUser(data.user)
      setToken(data.token)
      setCsrfToken(data.csrfToken)
      localStorage.setItem('devtrack_socket_token', data.token)
      if (data.csrfToken) localStorage.setItem('devtrack_csrf', data.csrfToken)

      if (rememberMe) {
        localStorage.setItem('devtrack_remember', 'true')
      } else {
        localStorage.removeItem('devtrack_remember')
      }

      return { success: true, user: data.user }
    } catch (err) {
      return { success: false, error: 'Connection error' }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': localStorage.getItem('devtrack_csrf') || '' }
      })
    } catch (err) {}

    setUser(null)
    setToken(null)
    setCsrfToken(null)
    localStorage.removeItem('devtrack_socket_token')
    localStorage.removeItem('devtrack_remember')
    localStorage.removeItem('devtrack_csrf')
  }, [csrfToken])

  const value = {
    user,
    token,
    csrfToken,
    loading,
    login,
    logout,
    checkAuth,
    setUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
