import { getAuthUser } from '@/lib/auth'
import { logger, apiLogger } from '@/lib/logger'

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const schemas = {
  // Auth schemas
  login: {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, minLength: 1, maxLength: 128 },
    rememberMe: { type: 'boolean', required: false },
  },
  register: {
    name: { type: 'string', required: true, minLength: 2, maxLength: 100 },
    email: { type: 'email', required: true },
    password: { type: 'password', required: true, minLength: 8, maxLength: 128 },
  },

  // Task schemas
  createTask: {
    title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
    description: { type: 'string', required: false, maxLength: 10000 },
    project_id: { type: 'number', required: true, min: 1 },
    status: { type: 'enum', values: ['todo', 'in_progress', 'review', 'done'], required: false },
    priority: { type: 'enum', values: ['low', 'medium', 'high', 'urgent'], required: false },
    assigned_to: { type: 'number', required: false, min: 1 },
    deadline: { type: 'date', required: false },
    start_date: { type: 'date', required: false },
    estimated_hours: { type: 'number', required: false, min: 0, max: 10000 },
    module: { type: 'string', required: false, maxLength: 100 },
  },
  updateTask: {
    title: { type: 'string', required: false, minLength: 1, maxLength: 500 },
    description: { type: 'string', required: false, maxLength: 10000 },
    status: { type: 'enum', values: ['todo', 'in_progress', 'review', 'done'], required: false },
    priority: { type: 'enum', values: ['low', 'medium', 'high', 'urgent'], required: false },
    assigned_to: { type: 'number', required: false, min: 1 },
    deadline: { type: 'date', required: false },
    start_date: { type: 'date', required: false },
    sort_order: { type: 'number', required: false, min: 0, max: 1000000 },
    estimated_hours: { type: 'number', required: false, min: 0, max: 10000 },
    actual_hours: { type: 'number', required: false, min: 0, max: 10000 },
    progress: { type: 'number', required: false, min: 0, max: 100 },
    module: { type: 'string', required: false, maxLength: 100 },
  },

  // Wiki schemas
  createWikiNote: {
    title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    content: { type: 'string', required: false, maxLength: 200000 },
    tags: { type: 'string', required: false, maxLength: 500 },
    project_id: { type: 'number', required: false, min: 1 },
  },
  updateWikiNote: {
    title: { type: 'string', required: false, minLength: 1, maxLength: 200 },
    content: { type: 'string', required: false, maxLength: 200000 },
    tags: { type: 'string', required: false, maxLength: 500 },
    project_id: { type: 'number', required: false, min: 1 },
  },

  // Comment schemas
  createComment: {
    comment: { type: 'string', required: true, minLength: 1, maxLength: 5000 },
    checklist_id: { type: 'number', required: false, min: 1 },
  },

  // Message schemas
  sendMessage: {
    receiverId: { type: 'number', required: true, min: 1 },
    message: { type: 'string', required: true, minLength: 1, maxLength: 5000 },
    message_type: { type: 'enum', values: ['text', 'image', 'file'], required: false },
  },

  // Project schemas
  createProject: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    description: { type: 'string', required: false, maxLength: 5000 },
    status: { type: 'enum', values: ['active', 'completed', 'archived'], required: false },
  },
  updateProject: {
    name: { type: 'string', required: false, minLength: 1, maxLength: 200 },
    description: { type: 'string', required: false, maxLength: 5000 },
    status: { type: 'enum', values: ['active', 'completed', 'archived'], required: false },
  },

  // User schemas
  updateUser: {
    name: { type: 'string', required: false, minLength: 2, maxLength: 100 },
    email: { type: 'email', required: false },
    role: { type: 'enum', values: ['admin', 'manager', 'member'], required: false },
  },

  // IT Support schemas
  createInventory: {
    item_name: { type: 'string', required: true, minLength: 1, maxLength: 300 },
    category: { type: 'string', required: false, maxLength: 100 },
    brand: { type: 'string', required: false, maxLength: 100 },
    model: { type: 'string', required: false, maxLength: 200 },
    serial_number: { type: 'string', required: false, maxLength: 200 },
    status: { type: 'enum', values: ['available', 'in_use', 'repair', 'retired', 'lost'], required: false },
    location: { type: 'string', required: false, maxLength: 200 },
    notes: { type: 'string', required: false, maxLength: 2000 },
  },

  createPurchaseRequest: {
    item_name: { type: 'string', required: true, minLength: 1, maxLength: 300 },
    description: { type: 'string', required: false, maxLength: 2000 },
    quantity: { type: 'number', required: false, min: 1, max: 10000 },
    estimated_price: { type: 'number', required: false, min: 0, max: 1000000000 },
    urgency: { type: 'enum', values: ['low', 'medium', 'high', 'critical'], required: false },
    reason: { type: 'string', required: false, maxLength: 2000 },
  },

  // Deploy schemas
  createDeploy: {
    project_id: { type: 'number', required: true, min: 1 },
    version: { type: 'string', required: true, minLength: 1, maxLength: 50 },
    notes: { type: 'string', required: false, maxLength: 2000 },
  },

  // Webhook schemas
  webhookPayload: {
    ref: { type: 'string', required: true },
    commits: { type: 'array', required: false },
    repository: { type: 'object', required: false },
  },
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate email format
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

/**
 * Validate password strength
 */
function isValidPassword(password) {
  if (!password || password.length < 8) return false
  if (!/[A-Z]/.test(password)) return false
  if (!/[a-z]/.test(password)) return false
  if (!/[0-9]/.test(password)) return false
  return true
}

/**
 * Validate date format
 */
function isValidDate(date) {
  if (!date) return false
  const d = new Date(date)
  return !isNaN(d.getTime())
}

/**
 * Validate string type
 */
function isValidString(value, minLength = 0, maxLength = Infinity) {
  if (typeof value !== 'string') return false
  if (value.length < minLength) return false
  if (value.length > maxLength) return false
  return true
}

/**
 * Validate number type
 */
function isValidNumber(value, min = -Infinity, max = Infinity) {
  const num = Number(value)
  if (isNaN(num)) return false
  if (num < min) return false
  if (num > max) return false
  return true
}

/**
 * Validate enum value
 */
function isValidEnum(value, allowedValues) {
  return allowedValues.includes(value)
}

/**
 * Sanitize string input
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Validate single field against schema
 */
function validateField(value, schema, fieldName) {
  // Handle required check
  if (schema.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `${fieldName} is required` }
  }

  // Skip validation if not required and value is empty
  if (!schema.required && (value === undefined || value === null || value === '')) {
    return { valid: true, value: undefined }
  }

  // Type validation
  switch (schema.type) {
    case 'string':
      if (!isValidString(value, schema.minLength, schema.maxLength)) {
        return { valid: false, error: `${fieldName} must be a string (${schema.minLength || 0}-${schema.maxLength || '∞'} chars)` }
      }
      return { valid: true, value: sanitizeString(value) }

    case 'email':
      if (!isValidEmail(value)) {
        return { valid: false, error: `${fieldName} must be a valid email` }
      }
      return { valid: true, value: value.toLowerCase().trim() }

    case 'password':
      if (!isValidPassword(value)) {
        return { valid: false, error: `${fieldName} must be at least 8 characters with uppercase, lowercase, and number` }
      }
      return { valid: true, value }

    case 'number':
      if (!isValidNumber(value, schema.min, schema.max)) {
        return { valid: false, error: `${fieldName} must be a number (${schema.min || 0}-${schema.max || '∞'})` }
      }
      return { valid: true, value: Number(value) }

    case 'boolean':
      const boolVal = value === true || value === 'true' || value === 1 || value === '1'
      return { valid: true, value: boolVal }

    case 'date':
      if (!isValidDate(value)) {
        return { valid: false, error: `${fieldName} must be a valid date` }
      }
      return { valid: true, value: new Date(value) }

    case 'enum':
      if (!isValidEnum(value, schema.values)) {
        return { valid: false, error: `${fieldName} must be one of: ${schema.values.join(', ')}` }
      }
      return { valid: true, value }

    case 'array':
      if (!Array.isArray(value)) {
        return { valid: false, error: `${fieldName} must be an array` }
      }
      return { valid: true, value }

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        return { valid: false, error: `${fieldName} must be an object` }
      }
      return { valid: true, value }

    default:
      return { valid: true, value }
  }
}

// ============================================
// MAIN VALIDATION MIDDLEWARE
// ============================================

/**
 * Validate request body against a schema
 * @param {string} schemaName - Name of the schema from schemas object
 * @returns {Object} { valid, data, errors }
 */
export function validateBody(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName]
    if (!schema) {
      logger.error(`Schema not found: ${schemaName}`)
      return res.status(500).json({ error: 'Validation configuration error' })
    }

    const data = {}
    const errors = []

    for (const [field, fieldSchema] of Object.entries(schema)) {
      const result = validateField(req.body[field], fieldSchema, field)
      if (!result.valid) {
        errors.push(result.error)
      } else if (result.value !== undefined) {
        data[field] = result.value
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    // Attach validated data to request
    req.validatedBody = data
    if (next) next()
    return { valid: true, data, errors: [] }
  }
}

/**
 * Validate request query params
 * @param {Object} querySchema - Schema for query params
 * @returns {Object} { valid, data, errors }
 */
export function validateQuery(querySchema) {
  return (req, res, next) => {
    const data = {}
    const errors = []

    for (const [field, fieldSchema] of Object.entries(querySchema)) {
      const result = validateField(req.query[field], fieldSchema, field)
      if (!result.valid) {
        errors.push(result.error)
      } else if (result.value !== undefined) {
        data[field] = result.value
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid query parameters', details: errors })
    }

    req.validatedQuery = data
    if (next) next()
    return { valid: true, data, errors: [] }
  }
}

/**
 * Validate request body directly (without middleware)
 * @param {Object} body - Request body
 * @param {string} schemaName - Schema name
 * @returns {Object} { valid, data, errors }
 */
export function validateData(body, schemaName) {
  const schema = schemas[schemaName]
  if (!schema) {
    return { valid: false, data: null, errors: [`Schema not found: ${schemaName}`] }
  }

  const data = {}
  const errors = []

  for (const [field, fieldSchema] of Object.entries(schema)) {
    const result = validateField(body[field], fieldSchema, field)
    if (!result.valid) {
      errors.push(result.error)
    } else if (result.value !== undefined) {
      data[field] = result.value
    }
  }

  return { valid: errors.length === 0, data, errors }
}

/**
 * Sanitize all string values in an object
 */
export function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj

  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeString(item) :
        typeof item === 'object' ? sanitizeObject(item) : item
      )
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

/**
 * Rate limiting middleware (uses unified rateLimit.js)
 */
import { apiRateLimit } from '@/lib/rateLimit'

export function rateLimit(options = {}) {
  return async (req, res, next) => {
    const blocked = await apiRateLimit(req, res)
    if (blocked) return
    next()
  }
}

/**
 * Authentication middleware
 */
export async function requireAuth(req, res) {
  const user = await getAuthUser(req)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  return user
}

/**
 * Admin authorization middleware
 */
export async function requireAdmin(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return null
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return null
  }
  return user
}

/**
 * Manager authorization middleware
 */
export async function requireManager(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return null
  if (user.role !== 'admin' && user.role !== 'manager') {
    res.status(403).json({ error: 'Manager access required' })
    return null
  }
  return user
}

/**
 * Validate ID parameter
 */
export function validateId(id) {
  const num = Number(id)
  if (isNaN(num) || num < 1 || !Number.isInteger(num)) {
    return { valid: false, error: 'Invalid ID parameter' }
  }
  return { valid: true, value: num }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(query) {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
  const offset = Math.max(Number(query.offset) || 0, 0)
  return { limit, offset }
}

export default {
  schemas,
  validateBody,
  validateQuery,
  validateData,
  sanitizeObject,
  rateLimit,
  requireAuth,
  requireAdmin,
  requireManager,
  validateId,
  validatePagination,
}
