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
const { splitSqlStatements } = require('./externalDb/splitter')

// ============================================================
// Extract tenant from request
// ============================================================

async function getTenantFromRequest(req) {
  // 1. From JWT token (most reliable — set at login)
  let user = req.user || req.authUser
  if (!user) {
    try {
      const { getAuthUser } = require('./auth')
      user = await getAuthUser(req)
    } catch (e) {
      // ignore
    }
  }

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
 * Run the full schema (base + key migrations) on a workspace database.
 * Statement-by-statement with tolerant duplicate handling — MySQL 8 safe.
 */
async function runSchemaOnDatabase(dbConfig, dbName) {
  const conn = await require('mysql2/promise').createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password || '',
    multipleStatements: false,
  })

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await conn.query(`USE \`${dbName}\``)

    const root = process.cwd() // __dirname is rewritten by Turbopack — use cwd
    const files = [
      'schema.sql',
      'scripts/workspace_schema_migration.sql',
      // Messaging
      'scripts/messages_upgrade_migration.sql',
      'scripts/chat_features_migration.sql',
      'scripts/group_chat_migration.sql',
      // Tasks
      'scripts/labels_migration.sql',
      'scripts/checklist_migration.sql',
      'scripts/template_migration.sql',
      'scripts/attachment_migration.sql',
      'scripts/gantt_migration.sql',
      'scripts/timer_migration.sql',
      'scripts/add_model_module_migration.sql',
      'scripts/approval_migration.sql',
      // Deploy & infrastructure
      'scripts/deploy_tables_upgrade_migration.sql',
      'scripts/git_deploy_migration.sql',
      'scripts/sftp_management_migration.sql',
      'scripts/multihost_migration.sql',
      // Monitoring
      'scripts/uptime_monitor_migration.sql',
      'scripts/monitor_alerts_migration.sql',
      'scripts/server_metrics_history_migration.sql',
    ]
    for (const f of files) {
      const p = path.join(root, f)
      if (!fs.existsSync(p)) continue
      const raw = fs.readFileSync(p, 'utf8')
        .replace(/^\s*CREATE DATABASE[^;]*;\s*/im, '')
        .replace(/^\s*USE\s+[^;]*;\s*/im, '')
      const lines = raw.split('\n').filter((l) => { const t = l.trim(); return !(t.startsWith('--') || t.startsWith('#')) })
      for (const stmt of lines.join('\n').split(';').map((s) => s.trim()).filter(Boolean)) {
        let q = stmt
        if (/^USE\s/i.test(q)) continue
        q = q.replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi, 'ADD COLUMN')
        try { await conn.query(q) } catch (e) {
          if (![1050, 1054, 1060, 1061, 1062, 1091, 1146].includes(e.errno)) {
            console.error(`[tenant] schema import ${f}: [${e.errno}] ${e.sqlMessage}`)
          }
        }
      }
    }
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
    ['app_tagline', 'Project Management & IT Support'],
    ['primary_color', '#6366f1'],
    ['accent_color', '#818cf8'],
    ['logo_url', ''],
    ['logo_icon_url', '/favicon-white.webp'],
    ['favicon_url', '/favicon-white.webp'],
    ['login_bg', ''],
    ['footer_text', `© ${new Date().getFullYear()} ${name}. All rights reserved.`],
    ['theme', 'dark'],
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

  // 4. Create new MySQL database for this workspace: {workspace-prefix}_devtrack
  //    Name-based (clean), collision-safe via _2, _3... suffixes.
  const mainConfig = getMainDbConfig()
  const prefix = String(name).toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'ws'
  const dbName = await (async () => {
    const mysql = require('mysql2/promise')
    const probe = await mysql.createConnection({ host: mainConfig.host, port: mainConfig.port, user: mainConfig.user, password: mainConfig.password || '' })
    try {
      let candidate = `${prefix}_devtrack`
      let n = 2
      // Keep suffixing while the name is taken by a DIFFERENT tenant's database
      while (true) {
        const [rows] = await probe.query(
          'SELECT COUNT(*) AS n FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
          [candidate]
        )
        const takenByOther = rows[0].n > 0
        if (!takenByOther) return candidate
        const reg = await db.queryOne('SELECT tenant_id FROM workspace_databases WHERE db_name = ?', [candidate])
        if (reg && Number(reg.tenant_id) === Number(tenantId)) return candidate // re-provisioning own DB
        candidate = `${prefix}_${n}_devtrack`
        n++
      }
    } finally {
      probe.end()
    }
  })()

  try {
    // Create database + import full schema (base + key migrations)
    await runSchemaOnDatabase(mainConfig, dbName)

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

  // Sync creator to the new tenant DB
  await syncUserToTenantDb(creatorUserId, tenantId, 'admin');

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

  // Sync user to the tenant DB
  await syncUserToTenantDb(userId, invite.tenant_id, invite.role);

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

/**
 * Syncs a global user to a specific workspace database.
 * This ensures the user exists locally in the tenant DB for queries like task assignment.
 * The workspace users table is a shadow copy (no passwords needed for auth, but kept for FK).
 */
async function syncUserToTenantDb(userId, tenantId, role = 'member') {
  const dbConfig = await db.queryOne('SELECT * FROM workspace_databases WHERE tenant_id = ?', [tenantId])
  if (!dbConfig) return;

  const user = await db.queryOne('SELECT * FROM users WHERE id = ?', [userId])
  if (!user) return;

  const mysql = require('mysql2/promise')
  try {
    const tenantConn = await mysql.createConnection({
      host: dbConfig.db_host,
      port: dbConfig.db_port,
      user: dbConfig.db_user,
      password: dbConfig.db_password || '',
      database: dbConfig.db_name
    })

    // Ensure the workspace users table has all needed columns
    await tenantConn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) DEFAULT NULL,
        role ENUM('admin', 'member') DEFAULT 'member',
        avatar VARCHAR(500) DEFAULT NULL,
        avatar_style VARCHAR(50) DEFAULT NULL,
        avatar_seed VARCHAR(100) DEFAULT NULL,
        avatar_options JSON DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        is_approved TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {})

    // Upsert user profile (without password — workspace DB doesn't need it for auth)
    await tenantConn.query(
      `INSERT INTO users (id, name, email, role, avatar, avatar_style, avatar_seed, avatar_options, is_active, is_approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), email = VALUES(email), role = VALUES(role),
         avatar = VALUES(avatar), avatar_style = VALUES(avatar_style),
         avatar_seed = VALUES(avatar_seed), avatar_options = VALUES(avatar_options),
         is_active = VALUES(is_active)`,
      [
        user.id, user.name, user.email, role,
        user.avatar || null, user.avatar_style || null, user.avatar_seed || null,
        user.avatar_options ? JSON.stringify(user.avatar_options) : null,
        user.is_active ?? 1, 1, user.created_at
      ]
    )
    await tenantConn.end()
  } catch (err) {
    console.error(`[tenant] Failed to sync user ${userId} to tenant DB ${dbConfig.db_name}:`, err)
  }
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
  runSchemaOnDatabase,
}
