-- Multi-server deploy + multi-host database connections
USE devtrack;

-- Deploy: multiple named targets instead of a single row
ALTER TABLE remote_deploy_configs
  ADD COLUMN IF NOT EXISTS name VARCHAR(100) NULL AFTER id;

UPDATE remote_deploy_configs SET name = CONCAT('Server #', id) WHERE name IS NULL OR name = '';

-- Database: saved remote MySQL connections
CREATE TABLE IF NOT EXISTS db_connections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INT DEFAULT 3306,
  username VARCHAR(100) NOT NULL,
  password_enc TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
