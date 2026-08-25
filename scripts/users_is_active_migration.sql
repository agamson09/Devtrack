-- Add is_active column to users table
ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER avatar;

-- Set all existing users as active
UPDATE users SET is_active = 1 WHERE is_active IS NULL;
