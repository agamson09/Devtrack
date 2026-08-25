function getCsrfToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('devtrack_csrf') || ''
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
