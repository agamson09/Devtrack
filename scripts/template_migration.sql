-- Task Templates
CREATE TABLE IF NOT EXISTS task_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
  module VARCHAR(100) DEFAULT NULL,
  estimated_hours DECIMAL(6,2) DEFAULT NULL,
  checklist_items JSON DEFAULT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_task_templates_created (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;