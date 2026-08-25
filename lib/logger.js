// ============================================
// STRUCTURED LOGGING MODULE
// ============================================

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
}

const LOG_LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG',
  4: 'TRACE',
}

const LOG_LEVEL_COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m',  // Yellow
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[90m', // Gray
  TRACE: '\x1b[35m', // Magenta
}

const RESET_COLOR = '\x1b[0m'

// ============================================
// LOGGER CLASS
// ============================================

class Logger {
  constructor(context = {}, options = {}) {
    this.context = context
    this.level = options.level !== undefined ? options.level : 
      (process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO : LOG_LEVELS.INFO)
    this.enableConsole = options.enableConsole !== false
    this.enableFile = options.enableFile || false
    this.logFile = options.logFile || 'app.log'
    this.minify = options.minify || false
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext = {}) {
    return new Logger(
      { ...this.context, ...additionalContext },
      { level: this.level, enableConsole: this.enableConsole, enableFile: this.enableFile, logFile: this.logFile }
    )
  }

  /**
   * Set log level
   */
  setLevel(level) {
    if (typeof level === 'string') {
      this.level = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO
    } else {
      this.level = level
    }
  }

  /**
   * Format log entry as JSON
   */
  formatJSON(level, message, data = null, error = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level],
      message,
      ...this.context,
    }

    if (data !== null && data !== undefined) {
      entry.data = data
    }

    if (error !== null && error !== undefined) {
      entry.error = {
        name: error.name || 'Error',
        message: error.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }
    }

    return JSON.stringify(entry)
  }

  /**
   * Format log entry for console (human readable)
   */
  formatConsole(level, message, data = null, error = null) {
    const color = LOG_LEVEL_COLORS[LOG_LEVEL_NAMES[level]] || ''
    const timestamp = new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
    const contextStr = Object.keys(this.context).length > 0 
      ? `[${Object.entries(this.context).map(([k, v]) => `${k}=${v}`).join(' ')}] `
      : ''

    let logLine = `${color}${timestamp} ${LOG_LEVEL_NAMES[level].padEnd(5)}${RESET_COLOR} ${contextStr}${message}`

    if (data !== null && data !== undefined) {
      if (this.minify) {
        logLine += ` ${JSON.stringify(data)}`
      } else {
        logLine += `\n  ${JSON.stringify(data, null, 2)}`
      }
    }

    if (error !== null && error !== undefined) {
      logLine += `\n  Error: ${error.name}: ${error.message}`
      if (error.stack && process.env.NODE_ENV === 'development') {
        const stackLines = error.stack.split('\n').slice(1, 4).join('\n  ')
        logLine += `\n  ${stackLines}`
      }
    }

    return logLine
  }

  /**
   * Write log entry
   */
  log(level, message, data = null, error = null) {
    if (level > this.level) return

    // Console output
    if (this.enableConsole) {
      const formatted = this.formatConsole(level, message, data, error)
      if (level === LOG_LEVELS.ERROR) {
        console.error(formatted)
      } else if (level === LOG_LEVELS.WARN) {
        console.warn(formatted)
      } else {
        console.log(formatted)
      }
    }

    // JSON structured log (for log aggregators)
    if (process.env.LOG_FORMAT === 'json') {
      const jsonLog = this.formatJSON(level, message, data, error)
      if (level === LOG_LEVELS.ERROR) {
        console.error(jsonLog)
      } else {
        console.log(jsonLog)
      }
    }
  }

  /**
   * Log ERROR level
   */
  error(message, dataOrError = null, error = null) {
    let data = null
    let err = null

    if (dataOrError instanceof Error) {
      err = dataOrError
    } else if (error instanceof Error) {
      data = dataOrError
      err = error
    } else {
      data = dataOrError
    }

    this.log(LOG_LEVELS.ERROR, message, data, err)
  }

  /**
   * Log WARN level
   */
  warn(message, data = null) {
    this.log(LOG_LEVELS.WARN, message, data)
  }

  /**
   * Log INFO level
   */
  info(message, data = null) {
    this.log(LOG_LEVELS.INFO, message, data)
  }

  /**
   * Log DEBUG level
   */
  debug(message, data = null) {
    this.log(LOG_LEVELS.DEBUG, message, data)
  }

  /**
   * Log TRACE level
   */
  trace(message, data = null) {
    this.log(LOG_LEVELS.TRACE, message, data)
  }

  /**
   * Log HTTP request
   */
  request(req, res = null, data = null) {
    const requestData = {
      method: req.method,
      url: req.url,
      ip: req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
      userAgent: req.headers?.['user-agent']?.slice(0, 100),
      userId: req.user?.id,
      ...data,
    }

    if (res) {
      requestData.statusCode = res.statusCode
      requestData.responseTime = res.responseTime
    }

    this.info(`HTTP ${req.method} ${req.url}`, requestData)
  }

  /**
   * Log database query
   */
  query(sql, params = null, duration = null) {
    const data = {
      sql: sql.slice(0, 500), // Truncate long queries
      params: params || undefined,
      duration: duration ? `${duration}ms` : undefined,
    }
    this.debug('Database query', data)
  }

  /**
   * Log socket event
   */
  socket(event, socketId, data = null) {
    this.debug(`Socket: ${event}`, { socketId, ...data })
  }

  /**
   * Log authentication event
   */
  auth(event, userId = null, data = null) {
    this.info(`Auth: ${event}`, { userId, ...data })
  }

  /**
   * Log security event
   */
  security(event, data = null) {
    this.warn(`Security: ${event}`, data)
  }

  /**
   * Log error with context
   */
  catchError(error, context = {}) {
    this.error(error.message, { ...context, stack: error.stack })
  }
}

// ============================================
// PRE-CONFIGURED LOGGERS
// ============================================

// Main application logger
export const logger = new Logger({ app: 'devtrack' })

// API request logger
export const apiLogger = logger.child({ module: 'api' })

// Database logger
export const dbLogger = logger.child({ module: 'database' })

// Socket logger
export const socketLogger = logger.child({ module: 'socket' })

// Auth logger
export const authLogger = logger.child({ module: 'auth' })

// Notification logger
export const notifLogger = logger.child({ module: 'notification' })

// Deploy logger
export const deployLogger = logger.child({ module: 'deploy' })

// Error logger
export const errorLogger = logger.child({ module: 'error' })

// ============================================
// REQUEST LOGGING MIDDLEWARE
// ============================================

/**
 * Express/Next.js middleware for request logging
 */
export function requestLogger(options = {}) {
  const { excludePaths = ['/api/health', '/favicon.ico'] } = options

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.url.startsWith(path))) {
      return next()
    }

    const startTime = Date.now()

    // Log request
    apiLogger.request(req)

    // Override res.end to log response
    const originalEnd = res.end
    res.end = function(...args) {
      res.responseTime = Date.now() - startTime
      apiLogger.request(req, res)
      originalEnd.apply(res, args)
    }

    if (next) next()
  }
}

// ============================================
// ERROR HANDLING UTILITIES
// ============================================

/**
 * Wrap async function with error logging
 */
export function withErrorLogging(fn, loggerInstance = logger) {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      loggerInstance.catchError(error, { function: fn.name })
      throw error
    }
  }
}

/**
 * Create error response with logging
 */
export function createErrorResponse(res, error, statusCode = 500, context = {}) {
  logger.error(error.message, { statusCode, ...context }, error)
  
  const response = {
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
  }

  if (process.env.NODE_ENV !== 'production') {
    response.stack = error.stack
  }

  return res.status(statusCode).json(response)
}

// ============================================
// LOG ROTATION (Simple file-based)
// ============================================

/**
 * Simple file logger (for environments without external log aggregation)
 */
export class FileLogger {
  constructor(filePath, options = {}) {
    this.filePath = filePath
    this.maxSize = options.maxSize || 10 * 1024 * 1024 // 10MB
    this.maxFiles = options.maxFiles || 5
    this.currentSize = 0
  }

  async write(message) {
    // In production, use a proper logging library like winston or pino
    // This is a simple fallback
    try {
      const fs = require('fs')
      const path = require('path')

      if (!fs.existsSync(this.filePath)) {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      }

      fs.appendFileSync(this.filePath, message + '\n')
      this.currentSize += Buffer.byteLength(message) + 1

      // Simple rotation check
      if (this.currentSize > this.maxSize) {
        // In production, implement proper rotation
        console.log('Log file rotation needed')
      }
    } catch (error) {
      console.error('Failed to write to log file:', error.message)
    }
  }
}

// ============================================
// PERFORMANCE LOGGING
// ============================================

/**
 * Log performance metrics
 */
export function logPerformance(operation, duration, metadata = {}) {
  const level = duration > 1000 ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG
  logger.log(level, `Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...metadata,
  })
}

/**
 * Create performance timer
 */
export function createTimer(operation) {
  const start = Date.now()
  return {
    end: (metadata = {}) => {
      const duration = Date.now() - start
      logPerformance(operation, duration, metadata)
      return duration
    },
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  Logger,
  logger,
  apiLogger,
  dbLogger,
  socketLogger,
  authLogger,
  notifLogger,
  deployLogger,
  errorLogger,
  requestLogger,
  withErrorLogging,
  createErrorResponse,
  FileLogger,
  logPerformance,
  createTimer,
  LOG_LEVELS,
}
