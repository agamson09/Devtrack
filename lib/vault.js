const crypto = require('crypto')

const ALGORITHM = 'aes-256-cbc'

function getKey() {
  const secret = process.env.IT_VAULT_KEY || 'devtrack-default-vault-key'
  if (!secret) {
    console.error('[vault] IT_VAULT_KEY environment variable is not set')
    throw new Error('IT_VAULT_KEY environment variable is not set')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

function encrypt(text) {
  if (!text) return ''
  try {
    const key = getKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return iv.toString('hex') + ':' + encrypted
  } catch (err) {
    console.error('[vault] encrypt failed:', err.message)
    throw err
  }
}

function decrypt(encryptedText) {
  if (!encryptedText) return ''
  try {
    const key = getKey()
    const parts = encryptedText.split(':')
    if (parts.length < 2) {
      console.error('[vault] decrypt failed: invalid encrypted format')
      return '[decryption error]'
    }
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('[vault] decrypt failed:', err.message)
    return '[decryption error]'
  }
}

module.exports = { encrypt, decrypt }
