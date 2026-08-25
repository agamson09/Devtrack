import db from '@/lib/db'
const dbPool = db.pool
import { verifyToken } from '@/lib/auth'
import { IncomingForm } from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  const { method } = req
  const token = req.cookies.devtrack_token || req.cookies.token || req.headers.authorization?.replace('Bearer ', '')

  if (method === 'GET') {
    try {
      // Use active tenant from: 1) query param, 2) cookie, 3) user token, 4) first tenant
      const requestedTenantId = req.query.tenantId
      // Read active_tenant cookie
      const cookieHeader = req.headers.cookie || ''
      const cookieMatch = cookieHeader.match(/(?:^|;\s*)active_tenant=([^;]*)/)
      const cookieTenantId = cookieMatch ? cookieMatch[1] : null
      const user = token ? verifyToken(token) : null
      const tenantId = requestedTenantId || cookieTenantId || user?.tenant_id

      let tenant
      if (tenantId) {
        const [tenants] = await dbPool.execute('SELECT * FROM tenants WHERE id = ? AND status = ?', [tenantId, 'active'])
        tenant = tenants[0] || null
      }
      if (!tenant) {
        const [tenants] = await dbPool.execute('SELECT * FROM tenants WHERE status = ? LIMIT 1', ['active'])
        tenant = tenants[0] || null
      }

      if (!tenant) {
        return res.status(200).json({ settings: {}, tenant: null })
      }

      const [settings] = await dbPool.execute(
        'SELECT setting_key, setting_value, setting_type FROM tenant_settings WHERE tenant_id = ?',
        [tenant.id]
      )

      const settingsObj = {}
      for (const row of settings) {
        settingsObj[row.setting_key] = row.setting_value
      }

      return res.status(200).json({ settings: settingsObj, tenant })
    } catch (error) {
      console.error('[tenant] GET error:', error)
      return res.status(500).json({ error: 'Failed to load tenant settings' })
    }
  }

  if (method === 'PUT') {
    // Verify admin
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const user = verifyToken(token)
      if (!user) {
        return res.status(401).json({ error: 'Invalid token' })
      }

      // Check tenant role from tenant_users table (not JWT role)
      const userTenantId = user.tenant_id
      if (userTenantId) {
        const [roleCheck] = await dbPool.execute(
          'SELECT role FROM tenant_users WHERE tenant_id = ? AND user_id = ?',
          [userTenantId, user.id]
        )
        const myRole = roleCheck[0]?.role
        if (myRole !== 'owner' && myRole !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' })
        }
      } else if (user.role !== 'admin') {
        // Fallback: check JWT role for legacy users
        return res.status(403).json({ error: 'Admin access required' })
      }

      // Handle multipart form (with file upload)
      const contentType = req.headers['content-type'] || ''
      let settings = {}

      if (contentType.includes('multipart/form-data')) {
        // Parse form data with file upload
        const form = new IncomingForm({
          multiples: false,
          uploadDir: path.join(process.cwd(), 'public', 'uploads', 'tenant'),
          keepExtensions: true,
          maxFileSize: 5 * 1024 * 1024, // 5MB
        })

        const [fields, files] = await new Promise((resolve, reject) => {
          form.parse(req, (err, fields, files) => {
            if (err) reject(err)
            else resolve([fields, files])
          })
        })

        // Process form fields
        for (const [key, value] of Object.entries(fields)) {
          if (Array.isArray(value)) {
            settings[key] = value[0]
          } else {
            settings[key] = value
          }
        }

        // Process uploaded files
        for (const [key, file] of Object.entries(files)) {
          if (file && file[0]) {
            const f = file[0]
            const ext = path.extname(f.originalFilename || f.newFilename || '.png')
            const filename = `tenant_${key}_${Date.now()}${ext}`
            const newPath = path.join(process.cwd(), 'public', 'uploads', 'tenant', filename)

            // Ensure directory exists
            fs.mkdirSync(path.dirname(newPath), { recursive: true })
            fs.renameSync(f.filepath, newPath)

            settings[key] = `/uploads/tenant/${filename}`
          }
        }
      } else {
        // Regular JSON body
        const body = await new Promise((resolve, reject) => {
          let data = ''
          req.on('data', chunk => { data += chunk })
          req.on('end', () => {
            try { resolve(JSON.parse(data)) }
            catch { resolve({}) }
          })
          req.on('error', reject)
        })
        settings = body
      }

      if (!settings || Object.keys(settings).length === 0) {
        return res.status(400).json({ error: 'No settings provided' })
      }

      // Get active tenant from: 1) body param, 2) cookie, 3) JWT, 4) first tenant
      const requestedTenantId = settings._tenantId || null
      delete settings._tenantId // don't save this as a setting
      const cookieHeader = req.headers.cookie || ''
      const cookieMatch = cookieHeader.match(/(?:^|;\s*)active_tenant=([^;]*)/)
      const cookieTenantId = cookieMatch ? cookieMatch[1] : null
      const tenantId = requestedTenantId || cookieTenantId || user.tenant_id

      let finalTenantId = tenantId
      if (!finalTenantId) {
        const [tenants] = await dbPool.execute('SELECT id FROM tenants LIMIT 1')
        finalTenantId = tenants[0]?.id
      }
      if (!finalTenantId) {
        const [result] = await dbPool.execute(
          'INSERT INTO tenants (name, slug, domain, status) VALUES (?, ?, ?, ?)',
          ['Default', 'default', null, 'active']
        )
        finalTenantId = result.insertId
      }

      // Upsert each setting
      for (const [key, value] of Object.entries(settings)) {
        const typeMap = {
          app_name: 'text',
          app_tagline: 'text',
          logo_url: 'image',
          logo_icon_url: 'image',
          primary_color: 'color',
          accent_color: 'color',
          login_bg: 'image',
          favicon_url: 'image',
          footer_text: 'text',
          theme: 'text',
          features: 'json',
          tagline: 'text',
        }
        const settingType = typeMap[key] || 'text'

        await dbPool.execute(
          `INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, setting_type)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_type = VALUES(setting_type)`,
          [finalTenantId, key, value, settingType]
        )
      }

      return res.status(200).json({ success: true, message: 'Settings updated' })
    } catch (error) {
      console.error('[tenant] PUT error:', error)
      return res.status(500).json({ error: 'Failed to update tenant settings' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
