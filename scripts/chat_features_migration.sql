-- Chat features migration: read-by, reply, edit/delete, voice, pin, forward, reactions

-- Add columns to messages table (check before adding)
SET @dbname = 'devtrack';
SET @tablename = 'messages';
SET @columnname = 'reply_to';
SELECT COUNT(*) INTO @exist FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname;
SET @sqlstmt = IF(@exist = 0, 'ALTER TABLE messages ADD COLUMN reply_to INT DEFAULT NULL AFTER media_url', 'SELECT "Column reply_to already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @exist FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'is_edited';
SET @sqlstmt = IF(@exist = 0, 'ALTER TABLE messages ADD COLUMN is_edited TINYINT(1) DEFAULT 0 AFTER is_read', 'SELECT "Column is_edited already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @exist FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'is_deleted';
SET @sqlstmt = IF(@exist = 0, 'ALTER TABLE messages ADD COLUMN is_deleted TINYINT(1) DEFAULT 0 AFTER is_edited', 'SELECT "Column is_deleted already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @exist FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'is_pinned';
SET @sqlstmt = IF(@exist = 0, 'ALTER TABLE messages ADD COLUMN is_pinned TINYINT(1) DEFAULT 0 AFTER is_deleted', 'SELECT "Column is_pinned already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @exist FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'forwarded_from';
SET @sqlstmt = IF(@exist = 0, 'ALTER TABLE messages ADD COLUMN forwarded_from INT DEFAULT NULL AFTER is_pinned', 'SELECT "Column forwarded_from already exists"');
PREPARE stmt FROM @sqlstmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Create message_reads table
CREATE TABLE IF NOT EXISTS message_reads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_read (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_reaction (message_id, user_id, emoji),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
