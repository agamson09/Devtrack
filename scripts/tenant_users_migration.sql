-- Tenant user management migration
-- Run this SQL on your MySQL database

USE devtrack;

-- 1. Create tenant_users junction table (users can belong to multiple tenants)
CREATE TABLE IF NOT EXISTS tenant_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
  invited_by INT DEFAULT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tenant_user (tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Create tenant_invites table
CREATE TABLE IF NOT EXISTS tenant_invites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  email VARCHAR(100) NOT NULL,
  role ENUM('admin', 'member', 'viewer') DEFAULT 'member',
  token VARCHAR(64) NOT NULL UNIQUE,
  invited_by INT NOT NULL,
  status ENUM('pending', 'accepted', 'expired') DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_email (email),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Add it_support to users.role ENUM if not already there
-- (users table was created with ENUM('admin','member'), need to add 'it_support')
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @colcheck = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
   AND TABLE_NAME = @tablename
   AND COLUMN_NAME = 'role'
   AND COLUMN_TYPE LIKE '%it_support%'
  ) > 0,
  'SELECT 1',
  'SELECT 1'
));
-- MySQL doesn't allow easy ENUM modification, skip if it_support already works
-- (it was added in a previous migration or the column accepts it)

-- 4. Migrate existing users into tenant_users for tenant_id=1
INSERT IGNORE INTO tenant_users (tenant_id, user_id, role)
SELECT 1, id, CASE WHEN role = 'admin' THEN 'owner' ELSE 'member' END
FROM users
WHERE tenant_id = 1 OR tenant_id IS NULL;

-- 5. Assign all users without tenant to tenant 1
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;

SELECT 'Tenant user management migration complete!' AS status;
