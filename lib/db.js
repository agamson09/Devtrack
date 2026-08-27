const mysql = require("mysql2/promise");

// Validate required environment variables
if (!process.env.DB_PASSWORD) {
  console.warn('⚠️  DB_PASSWORD not set in environment variables');
}

// Main pool (for shared tables: users, tenants, tenant_users, workspace_databases)
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || "devtrack",
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true,
});

// ============================================================
// Dynamic workspace pool system
// ============================================================

// Cache: tenantId -> mysql pool
const workspacePools = new Map();

/**
 * Get the database pool for a specific workspace/tenant.
 * tenantId=1 (or null) returns the main pool (devtrack database).
 * Other tenants look up workspace_databases table for their DB config.
 */
async function getPool(tenantId) {
  if (!tenantId || tenantId === 1) {
    return pool;
  }

  if (workspacePools.has(tenantId)) {
    return workspacePools.get(tenantId);
  }

  // Look up workspace database config from main DB
  const [rows] = await pool.query(
    'SELECT db_host, db_port, db_name, db_user, db_password FROM workspace_databases WHERE tenant_id = ?',
    [tenantId]
  );

  if (!rows || rows.length === 0) {
    // No custom DB configured — fallback to main pool
    return pool;
  }

  const cfg = rows[0];
  const wsPool = mysql.createPool({
    host: cfg.db_host || '127.0.0.1',
    port: cfg.db_port || 3306,
    user: cfg.db_user || 'root',
    password: cfg.db_password || '',
    database: cfg.db_name,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: true,
  });

  workspacePools.set(tenantId, wsPool);
  return wsPool;
}

/**
 * Create a MySQL pool for a raw DB config (used when creating new workspaces).
 */
function createRawPool(dbConfig) {
  return mysql.createPool({
    host: dbConfig.host || '127.0.0.1',
    port: dbConfig.port || 3306,
    user: dbConfig.user || 'root',
    password: dbConfig.password || '',
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: true,
  });
}

/**
 * Invalidate cached pool for a tenant (forces reconnect on next getPool call).
 */
function invalidatePool(tenantId) {
  const existing = workspacePools.get(tenantId);
  if (existing) {
    existing.end().catch(() => {});
    workspacePools.delete(tenantId);
  }
}

/**
 * Execute a query using a specific pool.
 */
async function queryWithPool(targetPool, sql, params = []) {
  const cleanParams = params.map(p => {
    if (typeof p === 'string' && /^\d+$/.test(p)) return parseInt(p, 10);
    if (p === null || p === undefined) return null;
    return p;
  });
  const [rows] = await targetPool.query(sql, cleanParams);
  return rows;
}

// ============================================================
// Tenant-scoped query functions
// Route queries to the correct workspace database pool.
// ============================================================

function cleanParams(params) {
  return params.map(p => {
    if (typeof p === 'string' && /^\d+$/.test(p)) return parseInt(p, 10);
    if (p === null || p === undefined) return null;
    return p;
  });
}

/**
 * Execute a SELECT query on a tenant's workspace database.
 * @param {number} tenantId - The tenant/workspace ID
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Result rows
 */
async function tenantQuery(tenantId, sql, params = []) {
  const targetPool = await getPool(tenantId);
  const [rows] = await targetPool.query(sql, cleanParams(params));
  return rows;
}

/**
 * Execute a SELECT query and return the first row (or null) from a tenant's database.
 */
async function tenantQueryOne(tenantId, sql, params = []) {
  const rows = await tenantQuery(tenantId, sql, params);
  return rows[0] || null;
}

/**
 * Insert a row into a tenant's database.
 * Supports both `tenantInsert(tenantId, 'table', { col: val })` and
 * `tenantInsert(tenantId, 'INSERT INTO ...', [params])`.
 */
async function tenantInsert(tenantId, sqlOrTable, paramsOrData) {
  const targetPool = await getPool(tenantId);
  if (typeof sqlOrTable === 'string' && typeof paramsOrData !== 'undefined') {
    if (typeof paramsOrData === 'object' && !Array.isArray(paramsOrData)) {
      const keys = Object.keys(paramsOrData);
      const validatedKeys = keys.map(validateTableName);
      const placeholders = validatedKeys.map(() => "?").join(", ");
      const sql = `INSERT INTO ${validateTableName(sqlOrTable)} (${validatedKeys.join(", ")}) VALUES (${placeholders})`;
      const [result] = await targetPool.query(sql, Object.values(paramsOrData));
      return { insertId: result.insertId, id: result.insertId, ...paramsOrData };
    }
    const params = Array.isArray(paramsOrData) ? paramsOrData : [];
    const [result] = await targetPool.query(sqlOrTable, params);
    return { insertId: result.insertId, id: result.insertId };
  }
  const [result] = await targetPool.query(sqlOrTable, []);
  return { insertId: result.insertId, id: result.insertId };
}

/**
 * Update rows in a tenant's database.
 * Supports both `tenantUpdate(tenantId, 'table', { col: val }, 'where', [params])` and
 * `tenantUpdate(tenantId, 'UPDATE ...', [params])`.
 */
async function tenantUpdate(tenantId, sqlOrTable, paramsOrData, where, whereParams = []) {
  const targetPool = await getPool(tenantId);
  if (typeof sqlOrTable === 'string' && typeof paramsOrData !== 'undefined' && !Array.isArray(paramsOrData) && typeof where === 'string') {
    const setClause = Object.keys(paramsOrData)
      .map((key) => `${validateTableName(key)} = ?`)
      .join(", ");
    const sql = `UPDATE ${validateTableName(sqlOrTable)} SET ${setClause} WHERE ${where}`;
    const values = [...Object.values(paramsOrData), ...whereParams];
    const [result] = await targetPool.query(sql, values);
    return result.affectedRows;
  }
  const params = Array.isArray(paramsOrData) ? paramsOrData : [];
  const [result] = await targetPool.query(sqlOrTable, params);
  return result.affectedRows;
}

/**
 * Delete rows from a tenant's database.
 * Supports both `tenantRemove(tenantId, 'table', 'where', [params])` and
 * `tenantRemove(tenantId, 'DELETE FROM ...', [params])`.
 */
async function tenantRemove(tenantId, sqlOrTable, paramsOrData, whereParams = []) {
  const targetPool = await getPool(tenantId);
  if (typeof sqlOrTable === 'string' && typeof paramsOrData === 'string') {
    const sql = `DELETE FROM ${validateTableName(sqlOrTable)} WHERE ${paramsOrData}`;
    const [result] = await targetPool.query(sql, whereParams);
    return result.affectedRows;
  }
  const params = typeof paramsOrData === 'string' ? whereParams : (Array.isArray(paramsOrData) ? paramsOrData : []);
  const [result] = await targetPool.query(sqlOrTable, params);
  return result.affectedRows;
}

/**
 * Run a transaction on a tenant's database.
 */
async function tenantTransaction(tenantId, callback) {
  const targetPool = await getPool(tenantId);
  const connection = await targetPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================================
// Whitelist of allowed table names to prevent SQL injection
// ============================================================

const ALLOWED_TABLES = new Set([
  'users', 'tasks', 'projects', 'messages', 'notifications',
  'task_comments', 'task_commits', 'task_history', 'task_labels',
  'labels', 'activity_logs', 'login_attempts', 'security_logs',
  'user_sessions', 'push_subscriptions', 'notification_preferences',
  'notification_logs', 'chat_groups', 'chat_group_members',
  'message_reads', 'deploy_backups', 'deployments', 'modules',
  'csrf_tokens', 'inventory_items', 'purchase_requests',
  'it_assets', 'documents', 'file_activity', 'webhooks',
  'deploy_logs', 'remote_deploy_configs', 'file_activity_logs',
  'it_email_accounts', 'it_inventory', 'it_inventory_assign',
  'it_ip_addresses', 'it_password_vault', 'it_purchase_requests',
  'message_reactions', 'password_history', 'rate_limits',
  'task_attachments', 'task_checklists', 'task_templates',
]);

// Validate table name to prevent SQL injection
function validateTableName(name) {
  if (typeof name !== 'string' || !name) {
    throw new Error('Invalid table name: must be a non-empty string');
  }
  // Check for SQL injection patterns
  if (/[;\-\-\/\/\*\*\/|`'"\\]/.test(name)) {
    throw new Error('Invalid table name: contains forbidden characters');
  }
  return name;
}

// Escape identifier (for column/table names in raw queries)
function escapeId(identifier) {
  if (typeof identifier !== 'string' || !identifier) {
    throw new Error('Invalid identifier');
  }
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

async function query(sql, params = []) {
  const cleanParams = params.map(p => {
    if (typeof p === 'string' && /^\d+$/.test(p)) return parseInt(p, 10)
    if (p === null || p === undefined) return null
    return p
  })
  const [rows] = await pool.query(sql, cleanParams)
  return rows
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function insert(sqlOrTable, paramsOrData) {
  if (typeof sqlOrTable === 'string' && typeof paramsOrData !== 'undefined') {
    if (typeof paramsOrData === 'object' && !Array.isArray(paramsOrData)) {
      const keys = Object.keys(paramsOrData);
      const validatedKeys = keys.map(validateTableName);
      const placeholders = validatedKeys.map(() => "?").join(", ");
      const sql = `INSERT INTO ${validateTableName(sqlOrTable)} (${validatedKeys.join(", ")}) VALUES (${placeholders})`;
      const [result] = await pool.query(sql, Object.values(paramsOrData));
      return { insertId: result.insertId, id: result.insertId, ...paramsOrData };
    }
    const params = Array.isArray(paramsOrData) ? paramsOrData : [];
    const [result] = await pool.query(sqlOrTable, params);
    return { insertId: result.insertId, id: result.insertId };
  }
  const [result] = await pool.query(sqlOrTable, []);
  return { insertId: result.insertId, id: result.insertId };
}

async function update(sqlOrTable, paramsOrData, where, whereParams = []) {
  if (typeof sqlOrTable === 'string' && typeof paramsOrData !== 'undefined' && !Array.isArray(paramsOrData) && typeof where === 'string') {
    const setClause = Object.keys(paramsOrData)
      .map((key) => `${validateTableName(key)} = ?`)
      .join(", ");
    const sql = `UPDATE ${validateTableName(sqlOrTable)} SET ${setClause} WHERE ${where}`;
    const values = [...Object.values(paramsOrData), ...whereParams];
    const [result] = await pool.query(sql, values);
    return result.affectedRows;
  }
  const params = Array.isArray(paramsOrData) ? paramsOrData : [];
  const [result] = await pool.query(sqlOrTable, params);
  return result.affectedRows;
}

async function remove(sqlOrTable, paramsOrData, whereParams = []) {
  if (typeof sqlOrTable === 'string' && typeof paramsOrData === 'string') {
    const sql = `DELETE FROM ${validateTableName(sqlOrTable)} WHERE ${paramsOrData}`;
    const [result] = await pool.query(sql, whereParams);
    return result.affectedRows;
  }
  const params = typeof paramsOrData === 'string' ? whereParams : (Array.isArray(paramsOrData) ? paramsOrData : []);
  const [result] = await pool.query(sqlOrTable, params);
  return result.affectedRows;
}

async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  query,
  queryOne,
  insert,
  update,
  remove,
  transaction,
  validateTableName,
  escapeId,
  getPool,
  createRawPool,
  invalidatePool,
  queryWithPool,
  // Tenant-scoped functions — route to workspace database
  tenantQuery,
  tenantQueryOne,
  tenantInsert,
  tenantUpdate,
  tenantRemove,
  tenantTransaction,
};
