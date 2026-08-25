-- Task Approval
ALTER TABLE tasks ADD COLUMN approved_by INT DEFAULT NULL AFTER progress;
ALTER TABLE tasks ADD COLUMN approved_at DATETIME DEFAULT NULL AFTER approved_by;
ALTER TABLE tasks ADD FOREIGN KEY (approved_by) REFERENCES users(id);