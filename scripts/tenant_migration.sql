-- Multi-tenant migration for DevTrack
-- Run this SQL on your MySQL database
-- Compatible with MySQL 5.7+

USE devtrack;

-- 1. Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  domain VARCHAR(255) DEFAULT NULL,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Create tenant_settings table
CREATE TABLE IF NOT EXISTS tenant_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT DEFAULT NULL,
  setting_type ENUM('text', 'image', 'color', 'boolean', 'json') DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tenant_key (tenant_id, setting_key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Add tenant_id to users table (if not exists)
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @columnname = 'tenant_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
   AND TABLE_NAME = @tablename
   AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT NULL AFTER id')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 4. Add index on tenant_id for users (if not exists)
SET @preparedStatement2 = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @dbname
   AND TABLE_NAME = @tablename
   AND INDEX_NAME = 'idx_tenant_id'
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX idx_tenant_id (', @columnname, ')')
));
PREPARE addIndexIfNotExists FROM @preparedStatement2;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;

-- 5. Insert default tenant (DevTrack)
INSERT INTO tenants (id, name, slug, domain, status) VALUES
(1, 'DevTrack', 'default', NULL, 'active')
ON DUPLICATE KEY UPDATE name = 'DevTrack';

-- 6. Insert default tenant settings
INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, setting_type) VALUES
(1, 'app_name', 'DevTrack', 'text'),
(1, 'app_tagline', 'Project Management & IT Support', 'text'),
(1, 'logo_url', '/favicon-white.webp', 'image'),
(1, 'logo_icon_url', '/favicon-white.webp', 'image'),
(1, 'primary_color', '#6366f1', 'color'),
(1, 'accent_color', '#818cf8', 'color'),
(1, 'login_bg', '/favicon-white.webp', 'image'),
(1, 'favicon_url', '/favicon-white.webp', 'image'),
(1, 'footer_text', '© 2026 DevTrack. All rights reserved.', 'text'),
(1, 'theme', 'dark', 'text'),
(1, 'features', '{"projects":true,"tasks":true,"chat":true,"deploy":true,"remote":true,"it_support":true,"terminal":true,"reports":true,"calendar":true,"database":true,"server_monitor":true}', 'json')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- 7. Assign existing users to default tenant
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 8. Add tenant_id to projects
SET @tablename = 'projects';
SET @preparedStatement3 = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'tenant_id'
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN tenant_id INT DEFAULT NULL AFTER id')
));
PREPARE addCol FROM @preparedStatement3;
EXECUTE addCol;
DEALLOCATE PREPARE addCol;

SET @preparedStatement4 = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND INDEX_NAME = 'idx_projects_tenant'
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX idx_projects_tenant (tenant_id)')
));
PREPARE addIdx FROM @preparedStatement4;
EXECUTE addIdx;
DEALLOCATE PREPARE addIdx;

UPDATE projects SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 9. Add tenant_id to tasks
SET @tablename = 'tasks';
SET @preparedStatement5 = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'tenant_id'
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN tenant_id INT DEFAULT NULL AFTER id')
));
PREPARE addCol2 FROM @preparedStatement5;
EXECUTE addCol2;
DEALLOCATE PREPARE addCol2;

SET @preparedStatement6 = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND INDEX_NAME = 'idx_tasks_tenant'
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX idx_tasks_tenant (tenant_id)')
));
PREPARE addIdx2 FROM @preparedStatement6;
EXECUTE addIdx2;
DEALLOCATE PREPARE addIdx2;

UPDATE tasks SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 10. Add tenant_id to chat_groups
SET @tablename = 'chat_groups';
SET @preparedStatement7 = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'tenant_id'
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN tenant_id INT DEFAULT NULL AFTER id')
));
PREPARE addCol3 FROM @preparedStatement7;
EXECUTE addCol3;
DEALLOCATE PREPARE addCol3;

UPDATE chat_groups SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 11. Add tenant_id to notifications
SET @tablename = 'notifications';
SET @preparedStatement8 = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'tenant_id'
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN tenant_id INT DEFAULT NULL AFTER id')
));
PREPARE addCol4 FROM @preparedStatement8;
EXECUTE addCol4;
DEALLOCATE PREPARE addCol4;

UPDATE notifications SET tenant_id = 1 WHERE tenant_id IS NULL;

SELECT 'Multi-tenant migration complete!' AS status;
