-- Workspace Database Mapping Migration
-- Maps each tenant to its own database
-- Run this on the MAIN devtrack database

USE devtrack;

CREATE TABLE IF NOT EXISTS workspace_databases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL UNIQUE,
  db_host VARCHAR(255) DEFAULT '127.0.0.1',
  db_port INT DEFAULT 3306,
  db_name VARCHAR(255) NOT NULL,
  db_user VARCHAR(255) DEFAULT 'root',
  db_password VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Register the default workspace to use the main devtrack database
INSERT INTO workspace_databases (tenant_id, db_host, db_port, db_name, db_user, db_password)
VALUES (1, '127.0.0.1', 3306, 'devtrack', 'root', NULL)
ON DUPLICATE KEY UPDATE db_name = 'devtrack';
