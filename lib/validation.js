export function sanitizeInput(input) {
  if (typeof input !== 'string') return input
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function validatePassword(password) {
  const errors = []
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters')
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least 1 uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least 1 lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least 1 number')
  return { valid: errors.length === 0, errors }
}

export function validateRequired(fields, body) {
  const missing = []
  for (const field of fields) {
    if (!body[field] || (typeof body[field] === 'string' && !body[field].trim())) {
      missing.push(field)
    }
  }
  return { valid: missing.length === 0, missing }
}

export function validateStringLength(value, min = 0, max = 10000) {
  if (!value) return { valid: min === 0 }
  return { valid: value.length >= min && value.length <= max }
}

export function validateNumber(value, min = null, max = null) {
  const num = Number(value)
  if (isNaN(num)) return { valid: false }
  if (min !== null && num < min) return { valid: false }
  if (max !== null && num > max) return { valid: false }
  return { valid: true, value: num }
}

export function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function validateJSON(str) {
  try {
    JSON.parse(str)
    return { valid: true }
  } catch {
    return { valid: false }
  }
}
