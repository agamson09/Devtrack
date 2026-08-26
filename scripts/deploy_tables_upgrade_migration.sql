-- Deploy tables upgrade: old file-era schemas -> current app schemas.
-- Safe on fresh installs (tables are empty). Runs right after
-- workspace_schema_migration.sql which creates the old versions.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS deploy_backups;
DROP TABLE IF EXISTS deploy_logs;
DROP TABLE IF EXISTS file_activity_logs;
DROP TABLE IF EXISTS modules;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE deploy_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT DEFAULT NULL,
  connection_id INT DEFAULT NULL,
  module VARCHAR(100) DEFAULT 'general',
  files_json LONGTEXT DEFAULT NULL,
  commit_before VARCHAR(64) DEFAULT NULL,
  commit_after VARCHAR(64) DEFAULT NULL,
  branch VARCHAR(100) DEFAULT NULL,
  log_text LONGTEXT DEFAULT NULL,
  deployed_by INT DEFAULT NULL,
  status ENUM('pending', 'running', 'deployed', 'failed') DEFAULT 'pending',
  note VARCHAR(500) DEFAULT NULL,
  deployed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conn (connection_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE file_activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_path VARCHAR(500) NOT NULL,
  module VARCHAR(100) DEFAULT 'general',
  action VARCHAR(50) DEFAULT 'modified',
  file_size INT DEFAULT 0,
  changed_by VARCHAR(100) DEFAULT NULL,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_detected (detected_at),
  INDEX idx_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE deploy_backups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deploy_log_id INT DEFAULT NULL,
  file_path VARCHAR(500) NOT NULL,
  backup_path VARCHAR(500) NOT NULL,
  original_size INT DEFAULT 0,
  expires_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deploy_log (deploy_log_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
