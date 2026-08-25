-- Messages table upgrade: old group-chat schema (user_id/content) -> private+group schema
-- (sender_id/receiver_id/message/message_type). Safe on fresh installs (table is empty).
-- NOTE: runs right after workspace_schema_migration.sql which creates the old version.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS messages;
SET FOREIGN_KEY_CHECKS = 1;
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT DEFAULT NULL,
  group_id INT DEFAULT NULL,
  message TEXT NOT NULL,
  message_type VARCHAR(10) DEFAULT 'text',
  media_url TEXT DEFAULT NULL,
  reply_to INT DEFAULT NULL,
  is_read TINYINT(1) DEFAULT 0,
  is_edited TINYINT(1) DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  is_pinned TINYINT(1) DEFAULT 0,
  forwarded_from INT DEFAULT NULL,
  tenant_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sender_receiver (sender_id, receiver_id),
  INDEX idx_receiver (receiver_id),
  INDEX idx_group (group_id),
  INDEX idx_created (created_at),
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
