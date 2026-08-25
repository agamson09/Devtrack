/**
 * Multi-Tenant Helper
 *
 * Provides tenant context extraction and query scoping.
 * Tenant is determined from:
 *   1. JWT token (user.tenant_id)
 *   2. Subdomain (tenant.app.com)
 *   3. Custom domain
 *   4. Query parameter (for API testing)
 */

const db = require('./db')
const fs = require('fs')
const path = require('path')
const { addWorkspaceConfig } = require('./workspace-config')

// ============================================================
// Extract tenant from request
// ============================================================

async function getTenantFromRequest(req) {
  // 1. From JWT token (most reliable — set at login)
  const user = req.user || req.authUser
  if (user && user.tenant_id) {
    return user.tenant_id
  }

  // 2. From subdomain
  const host = (req.headers.host || '').split(':')[0]
  const parts = host.split('.')
  if (parts.length > 2) {
    const subdomain = parts[0]
    // Skip common subdomains
    if (!['www', 'api', 'mail', 'dev', 'staging'].includes(subdomain)) {
      const tenant = await db.queryOne(
        'SELECT id FROM tenants WHERE slug = ? AND status = ?',
        [subdomain, 'active']
      )
      if (tenant) return tenant.id
    }
  }

  // 3. From custom domain
  const tenant = await db.queryOne(
    'SELECT id FROM tenants WHERE domain = ? AND status = ?',
    [host, 'active']
  )
  if (tenant) return tenant.id

  // 4. Fallback: default tenant (for single-tenant deployments)
  return 1
}

// ============================================================
// Tenant-scoped query helpers
// ============================================================

/**
 * Scope a SELECT query by tenant_id
 * Automatically adds WHERE tenant_id = ? to the query
 */
function scopeQuery(baseQuery, tenantId, params = []) {
  if (!tenantId) return { sql: baseQuery, params }

  const hasWhere = /\bWHERE\b/i.test(baseQuery)
  const separator = hasWhere ? 'AND' : 'WHERE'
  const scopedQuery = `${baseQuery} ${separator} (tenant_id = ? OR tenant_id IS NULL)`

  return { sql: scopedQuery, params: [...params, tenantId] }
}

/**
 * Scope a query STRICTLY by tenant_id (no NULL fallback)
 */
function scopeQueryStrict(baseQuery, tenantId, params = []) {
  if (!tenantId) return { sql: baseQuery, params }

  const hasWhere = /\bWHERE\b/i.test(baseQuery)
  const separator = hasWhere ? 'AND' : 'WHERE'
  const scopedQuery = `${baseQuery} ${separator} tenant_id = ?`

  return { sql: scopedQuery, params: [...params, tenantId] }
}

/**
 * Get tenant_id for INSERT operations
 */
function getTenantId(user) {
  return user?.tenant_id || null
}

/**
 * Check if user belongs to a specific tenant
 */
async function userBelongsToTenant(userId, tenantId) {
  const membership = await db.queryOne(
    'SELECT id FROM tenant_users WHERE user_id = ? AND tenant_id = ?',
    [userId, tenantId]
  )
  return !!membership
}

/**
 * Get all tenant_ids a user belongs to
 */
async function getUserTenants(userId) {
  const memberships = await db.query(
    'SELECT tenant_id FROM tenant_users WHERE user_id = ?',
    [userId]
  )
  return memberships.map(m => m.tenant_id)
}

/**
 * Get the DB credentials for the main (default) database.
 */
function getMainDbConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  }
}

/**
 * Run SQL file on a database using raw connection.
 */
async function runSqlOnDatabase(dbConfig, dbName, sqlContent) {
  // Connect without specifying database to run CREATE DATABASE + USE
  const conn = await require('mysql2/promise').createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password || '',
    multipleStatements: true,
  })

  try {
    // Replace USE devtrack with USE <dbName>
    const adapted = sqlContent.replace(/USE devtrack;/gi, `USE \`${dbName}\`;`)
    await conn.query(adapted)
  } finally {
    await conn.end()
  }
}

/**
 * Create a new workspace with its own database.
 * Called during workspace creation from sidebar or registration.
 */
async function createTenant(name, slug, creatorUserId) {
  // 1. Create tenant record in main DB
  const tenant = await db.insert(
    'INSERT INTO tenants (name, slug, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
    [name, slug, 'active']
  )

  const tenantId = tenant.insertId

  // 2. Create default settings in main DB
  const defaultSettings = [
    ['app_name', name],
    ['tagline', 'Project Management & IT Support'],
    ['primary_color', '#6366f1'],
    ['logo_url', ''],
    ['logo_icon_url', ''],
    ['favicon_url', ''],
    ['features', JSON.stringify({
      remote_desktop: false,
      database_manager: true,
      server_monitor: true,
      ai_assistant: true,
      it_support: true,
      deploy: true,
      chat: true,
    })],
  ]

  for (const [key, value] of defaultSettings) {
    await db.insert(
      'INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, setting_type, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [tenantId, key, value, 'text']
    )
  }

  // 3. Add creator as owner
  await db.insert(
    'INSERT INTO tenant_users (tenant_id, user_id, role, joined_at) VALUES (?, ?, ?, NOW())',
    [tenantId, creatorUserId, 'owner']
  )

  // 4. Create new MySQL database for this workspace
  const mainConfig = getMainDbConfig()
  const dbName = `devtrack_${slug}`

  try {
    // Create database
    const tempConn = await require('mysql2/promise').createConnection({
      host: mainConfig.host,
      port: mainConfig.port,
      user: mainConfig.user,
      password: mainConfig.password || '',
    })

    try {
      await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    } finally {
      await tempConn.end()
    }

    // Run workspace schema on new database
    const schemaPath = path.join(__dirname, '..', 'workspace-schema.sql')
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8')
    await runSqlOnDatabase(mainConfig, dbName, schemaSql)

    // 5. Register in workspace_databases
    await db.insert(
      'INSERT INTO workspace_databases (tenant_id, db_host, db_port, db_name, db_user, db_password) VALUES (?, ?, ?, ?, ?, ?)',
      [tenantId, mainConfig.host, mainConfig.port, dbName, mainConfig.user, mainConfig.password || null]
    )

    // 6. Update workspace config file
    addWorkspaceConfig(slug, {
      name,
      database: dbName,
      url: process.env.NEXT_PUBLIC_APP_URL || '',
    })

    console.log(`[tenant] Created workspace "${name}" with database "${dbName}"`)
  } catch (dbError) {
    console.error(`[tenant] Failed to create database for workspace "${name}":`, dbError)
    // Tenant record is already created — workspace exists but without isolated DB
    // Queries will fallback to main pool
  }

  return tenantId
}

/**
 * Join an existing tenant via invite token
 */
async function joinTenantByInvite(userId, inviteToken) {
  const invite = await db.queryOne(
    'SELECT * FROM tenant_invites WHERE token = ? AND status = ? AND expires_at > NOW()',
    [inviteToken, 'pending']
  )

  if (!invite) {
    return { success: false, error: 'Invalid or expired invite code' }
  }

  // Check if already a member
  const existing = await db.queryOne(
    'SELECT id FROM tenant_users WHERE tenant_id = ? AND user_id = ?',
    [invite.tenant_id, userId]
  )
  if (existing) {
    return { success: false, error: 'You are already a member of this workspace' }
  }

  // Add user to tenant
  await db.insert(
    'INSERT INTO tenant_users (tenant_id, user_id, role, invited_by, joined_at) VALUES (?, ?, ?, ?, NOW())',
    [invite.tenant_id, userId, invite.role, invite.invited_by]
  )

  // Mark invite as accepted
  await db.update(
    'tenant_invites',
    { status: 'accepted' },
    'id = ?',
    [invite.id]
  )

  return { success: true, tenantId: invite.tenant_id }
}

/**
 * Generate a random invite token
 */
function generateInviteToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

module.exports = {
  getTenantFromRequest,
  scopeQuery,
  scopeQueryStrict,
  getTenantId,
  userBelongsToTenant,
  getUserTenants,
  createTenant,
  joinTenantByInvite,
  generateInviteToken,
}
