const { sanitizeInput, validateEmail, validatePassword, validateRequired, validateStringLength, validateNumber, sanitizeFilename } = require('@/lib/validation')

describe('Validation Library', () => {
  describe('sanitizeInput', () => {
    it('should escape HTML characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toContain('&lt;')
      expect(sanitizeInput('<script>alert("xss")</script>')).not.toContain('<script>')
    })

    it('should handle non-string inputs', () => {
      expect(sanitizeInput(123)).toBe(123)
      expect(sanitizeInput(null)).toBe(null)
    })

    it('should pass through safe strings', () => {
      expect(sanitizeInput('hello world')).toBe('hello world')
    })
  })

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co.id')).toBe(true)
    })

    it('should reject invalid emails', () => {
      expect(validateEmail('notanemail')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      const result = validatePassword('StrongPass1')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject short passwords', () => {
      const result = validatePassword('Ab1')
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual('Password must be at least 8 characters')
    })

    it('should reject passwords without uppercase', () => {
      const result = validatePassword('lowercase1')
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual('Password must contain at least 1 uppercase letter')
    })

    it('should reject passwords without lowercase', () => {
      const result = validatePassword('UPPERCASE1')
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual('Password must contain at least 1 lowercase letter')
    })

    it('should reject passwords without numbers', () => {
      const result = validatePassword('NoNumberHere')
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual('Password must contain at least 1 number')
    })

    it('should handle empty password', () => {
      const result = validatePassword('')
      expect(result.valid).toBe(false)
    })
  })

  describe('validateRequired', () => {
    it('should pass when all fields present', () => {
      const result = validateRequired(['name', 'email'], { name: 'John', email: 'john@test.com' })
      expect(result.valid).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('should fail when fields are missing', () => {
      const result = validateRequired(['name', 'email'], { name: 'John' })
      expect(result.valid).toBe(false)
      expect(result.missing).toContain('email')
    })

    it('should fail on empty strings', () => {
      const result = validateRequired(['name'], { name: '  ' })
      expect(result.valid).toBe(false)
      expect(result.missing).toContain('name')
    })
  })

  describe('validateStringLength', () => {
    it('should accept strings within range', () => {
      expect(validateStringLength('hello', 1, 10).valid).toBe(true)
    })

    it('should reject strings too short', () => {
      expect(validateStringLength('hi', 5, 10).valid).toBe(false)
    })

    it('should reject strings too long', () => {
      expect(validateStringLength('a'.repeat(20), 1, 10).valid).toBe(false)
    })

    it('should handle null/undefined', () => {
      expect(validateStringLength(null, 0, 10).valid).toBe(true)
      expect(validateStringLength(null, 1, 10).valid).toBe(false)
    })
  })

  describe('validateNumber', () => {
    it('should accept valid numbers', () => {
      expect(validateNumber(5, 1, 10).valid).toBe(true)
      expect(validateNumber(5, 1, 10).value).toBe(5)
    })

    it('should reject non-numbers', () => {
      expect(validateNumber('abc').valid).toBe(false)
    })

    it('should reject numbers below min', () => {
      expect(validateNumber(0, 1, 10).valid).toBe(false)
    })

    it('should reject numbers above max', () => {
      expect(validateNumber(11, 1, 10).valid).toBe(false)
    })
  })

  describe('sanitizeFilename', () => {
    it('should replace unsafe characters with underscores', () => {
      expect(sanitizeFilename('my file (1).txt')).toBe('my_file_1_.txt')
    })

    it('should replace path traversal with underscores', () => {
      const result = sanitizeFilename('../../etc/passwd')
      expect(result).not.toContain('/')
      expect(result).not.toContain('\\')
    })

    it('should handle clean filenames', () => {
      expect(sanitizeFilename('report.pdf')).toBe('report.pdf')
    })
  })
})
