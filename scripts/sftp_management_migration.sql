-- SFTP Management System Migration
-- Run: mysql -u root -p devtrack < scripts/sftp_management_migration.sql

-- 1. Add module field to tasks
SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'devtrack' AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'module');
SET @sql = IF(@exists = 0, 'ALTER TABLE tasks ADD COLUMN module VARCHAR(100) DEFAULT NULL AFTER project_id', 'SELECT "module column already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'devtrack' AND TABLE_NAME = 'tasks' AND INDEX_NAME = 'idx_module');
SET @sql2 = IF(@idx_exists = 0, 'ALTER TABLE tasks ADD INDEX idx_module (module)', 'SELECT "idx_module already exists"');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 2. File activity logs
CREATE TABLE IF NOT EXISTS file_activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_path VARCHAR(500) NOT NULL,
  module VARCHAR(100) DEFAULT NULL,
  action ENUM('created', 'modified', 'deleted') NOT NULL,
  file_size INT DEFAULT NULL,
  changed_by VARCHAR(100) DEFAULT NULL,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_module (module),
  INDEX idx_detected_at (detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Deploy logs
CREATE TABLE IF NOT EXISTS deploy_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT DEFAULT NULL,
  module VARCHAR(100) NOT NULL,
  files_json JSON NOT NULL,
  deployed_by INT NOT NULL,
  status ENUM('pending', 'approved', 'deployed', 'rolled_back') DEFAULT 'pending',
  note TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deployed_at TIMESTAMP DEFAULT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (deployed_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Deploy backups
CREATE TABLE IF NOT EXISTS deploy_backups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deploy_log_id INT DEFAULT NULL,
  file_path VARCHAR(500) NOT NULL,
  backup_path VARCHAR(500) NOT NULL,
  original_size INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (deploy_log_id) REFERENCES deploy_logs(id) ON DELETE SET NULL,
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Modules list table (for UI dropdown)
CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  controller_pattern VARCHAR(200) DEFAULT NULL,
  view_folder VARCHAR(100) DEFAULT NULL,
  route_file VARCHAR(100) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Seed default modules
INSERT IGNORE INTO modules (name, display_name, controller_pattern, view_folder, route_file, sort_order) VALUES
('cable', 'Cable', 'CableController', 'cable', 'route_cable.php', 1),
('sales', 'Sales', 'SalesController', 'sales', NULL, 2),
('stock', 'Stock', 'StockController', 'stock', 'route_stock.php', 3),
('inventory', 'Inventory Audit', 'InventoryAuditController', 'InventoryAudit', 'route_inventory_audit.php', 4),
('estimator', 'Estimator', 'EstimatorController', 'estimator', NULL, 5),
('purchasing', 'Purchasing', 'PurchasingController', 'purchasing', NULL, 6),
('logistic', 'Logistic', 'LogisticController', 'logistic', NULL, 7),
('logistik', 'Logistik', 'LogistikController', 'logistik', NULL, 8),
('quotation', 'Quotation Local', 'QuotationLocalController', 'quotation_local', NULL, 9),
('quotation_tracking', 'Quotation Tracking', 'QuotationTrackingController', 'QuotationTracking', 'route_quotation_tracking.php', 10),
('opname', 'Opname', 'OpnameController', 'opname', NULL, 11),
('project', 'Project', 'ProjectController', 'project_controller', NULL, 12),
('it', 'IT', 'ItController', 'it', NULL, 13),
('tender', 'Tender Management', 'TenderManagementController', 'tender', NULL, 14),
('approval', 'Approval', 'ApprovalController', 'approval', NULL, 15),
('rbac', 'RBAC', 'RbacController', 'rbac', NULL, 16),
('notification', 'Notification', 'NotificationController', NULL, NULL, 17),
('profile', 'Profile', 'ProfileController', 'profile', NULL, 18),
('genlight', 'Genlight', 'GenlightController', 'genlight', NULL, 19),
('admin', 'Admin', 'AdminController', 'admin', NULL, 20),
('analytics', 'Analytics', 'AnalyticsController', NULL, NULL, 21),
('audit', 'Audit', 'AuditController', NULL, NULL, 22),
('superuser', 'Superuser', 'SuperuserController', 'superuser', NULL, 23),
('mobile', 'Mobile', 'MobileController', 'mobile', NULL, 24),
('termcond', 'Term & Conditions', 'TermcondController', 'termcond', NULL, 25),
('sales_employee', 'Sales Employee', 'SalesEmployeController', 'sales_employee', NULL, 26);
