-- Task Checklists/Subtasks
CREATE TABLE IF NOT EXISTS task_checklists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  is_checked TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_task_checklists_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;