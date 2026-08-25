CREATE TABLE IF NOT EXISTS labels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_label_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS task_labels (
  task_id INT NOT NULL,
  label_id INT NOT NULL,
  PRIMARY KEY (task_id, label_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO labels (name, color) VALUES
  ('Bug', '#ef4444'),
  ('Feature', '#22c55e'),
  ('Improvement', '#3b82f6'),
  ('Urgent', '#f97316'),
  ('Frontend', '#8b5cf6'),
  ('Backend', '#06b6d4'),
  ('DevOps', '#ec4899'),
  ('Documentation', '#6b7280'),
  ('Testing', '#14b8a6'),
  ('Design', '#f59e0b');
