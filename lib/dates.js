/**
 * Extract YYYY-MM-DD from any date string format.
 * Handles: "2026-08-14", "2026-08-14 00:00:00", "2026-08-14T00:00:00.000Z"
 */
export function getDatePart(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr)
  // Split on T or space, take first part
  const datePart = s.includes('T') ? s.split('T')[0] : s.split(' ')[0]
  if (!datePart || datePart === '0000-00-00') return null
  return datePart
}

/**
 * Parse a date string as LOCAL time (not UTC).
 * MySQL dates like "2026-08-14" should be Aug 14 local, not Aug 14 UTC.
 */
export function parseLocalDate(dateStr) {
  const ds = getDatePart(dateStr)
  if (!ds) return null
  const parts = ds.split('-')
  if (parts.length !== 3) return null
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  return isNaN(d.getTime()) ? null : d
}

/**
 * Parse a date string and return YYYY-MM-DD for <input type="date">
 */
export function toInputDate(dateStr) {
  const d = parseLocalDate(dateStr)
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Format date string to locale display
 */
export function formatDate(dateStr, locale = 'id-ID', options = {}) {
  const d = parseLocalDate(dateStr)
  if (!d) return '-'
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', ...options })
}
