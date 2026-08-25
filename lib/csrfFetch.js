function getCsrfToken() {
  if (typeof window === 'undefined') return ''
  // JSON login stores the token here; SSO redirect flow delivers it via cookie
  const stored = localStorage.getItem('devtrack_csrf')
  if (stored) return stored
  const match = document.cookie.match(/(?:^|;\s*)devtrack_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export async function csrfFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = { ...options.headers }

  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF-Token'] = getCsrfToken()
  }

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  return fetch(url, { ...options, headers, credentials: 'include' })
}
