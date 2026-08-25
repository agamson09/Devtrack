const inMemoryLimits = new Map()

function createRateLimit({ windowMs = 60000, max = 60, message = 'Too many requests' } = {}) {
  function checkLimit(ip, endpoint, res) {
    const key = `${ip}:${endpoint}`
    const now = Date.now()
    const windowStart = now - windowMs

    let record = inMemoryLimits.get(key)
    if (!record || record.start < windowStart) {
      record = { count: 1, start: now }
      inMemoryLimits.set(key, record)

      if (res) {
        res.setHeader('X-RateLimit-Limit', max)
        res.setHeader('X-RateLimit-Remaining', max - 1)
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000))
      }
      return { allowed: true, remaining: max - 1 }
    }

    record.count++
    const remaining = Math.max(0, max - record.count)

    if (res) {
      res.setHeader('X-RateLimit-Limit', max)
      res.setHeader('X-RateLimit-Remaining', remaining)
      res.setHeader('X-RateLimit-Reset', Math.ceil((record.start + windowMs) / 1000))
    }

    if (record.count > max) {
      const retryAfter = Math.ceil((record.start + windowMs - now) / 1000)
      if (res) {
        res.setHeader('Retry-After', retryAfter)
      }
      return { allowed: false, remaining: 0, retryAfter }
    }

    return { allowed: true, remaining }
  }

  return checkLimit
}

function cleanupRateLimits() {
  const now = Date.now()
  for (const [key, record] of inMemoryLimits.entries()) {
    if (now - record.start > 300000) {
      inMemoryLimits.delete(key)
    }
  }
}

if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 60000)
}

const loginLimit = createRateLimit({ windowMs: 300000, max: 10 })
const apiLimit = createRateLimit({ windowMs: 60000, max: 100 })
const socketLimit = createRateLimit({ windowMs: 10000, max: 30 })
const terminalLimit = createRateLimit({ windowMs: 60000, max: 5 })

async function loginRateLimit(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const result = loginLimit(ip, 'login', res)
  if (!result.allowed) {
    res.status(429).json({ error: 'Too many login attempts. Try again later.', retryAfter: result.retryAfter })
    return true
  }
  return false
}

async function apiRateLimit(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const result = apiLimit(ip, req.url, res)
  if (!result.allowed) {
    res.status(429).json({ error: 'Rate limit exceeded', retryAfter: result.retryAfter })
    return true
  }
  return false
}

module.exports = {
  createRateLimit,
  cleanupRateLimits,
  loginLimit,
  apiLimit,
  socketLimit,
  terminalLimit,
  loginRateLimit,
  apiRateLimit,
}
