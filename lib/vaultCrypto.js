import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'

// Resolve lazily (not at module load) so dotenv/.env.local is guaranteed loaded first.
function getKey() {
  const material =
    process.env.DEPLOY_ENCRYPTION_KEY || process.env.JWT_SECRET || 'devtrack-deploy-default-key-32c'
  return crypto.scryptSync(material, 'salt', 32)
}

/** Encrypt a secret for storage (format: iv:payload, both hex). */
export function encryptSecret(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  let encrypted = cipher.update(String(text), 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/** Decrypt a stored secret. Returns null when unreadable/corrupt. */
export function decryptSecret(encryptedText) {
  try {
    const [ivHex, encrypted] = String(encryptedText).split(':')
    if (!ivHex || !encrypted) return null
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'))
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return null
  }
}

/** Mask a secret for API responses. */
export function maskSecret(secret) {
  if (!secret) return ''
  if (secret.length <= 4) return '••••'
  return '••••' + secret.slice(-2)
}
