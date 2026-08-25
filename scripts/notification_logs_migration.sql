-- Notification Logs: track delivery status for each channel
CREATE TABLE IF NOT EXISTS notification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id INT NOT NULL,
  channel ENUM('in_app', 'email', 'telegram', 'push') NOT NULL,
  status ENUM('sent', 'failed', 'pending', 'retrying') DEFAULT 'pending',
  error_message TEXT DEFAULT NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  next_retry_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  INDEX idx_channel_status (channel, status),
  INDEX idx_notification (notification_id),
  INDEX idx_retry (status, next_retry_at)
);

-- Add columns to notifications table for source tracking
ALTER TABLE notifications
  ADD COLUMN source_type VARCHAR(50) DEFAULT NULL AFTER link,
  ADD COLUMN source_id INT DEFAULT NULL AFTER source_type,
  ADD COLUMN actor_id INT DEFAULT NULL AFTER source_id,
  ADD COLUMN group_count INT DEFAULT NULL AFTER actor_id;

-- Index for faster queries
ALTER TABLE notifications
  ADD INDEX idx_user_read (user_id, is_read),
  ADD INDEX idx_user_type (user_id, type),
  ADD INDEX idx_user_created (user_id, created_at DESC);
