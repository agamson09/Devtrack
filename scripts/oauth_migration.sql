-- SSO / OAuth login support
ALTER TABLE users MODIFY password VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN auth_provider ENUM('local', 'google', 'github', 'oidc') DEFAULT 'local';
ALTER TABLE users ADD COLUMN provider_id VARCHAR(191) DEFAULT NULL;

-- Multiple OAuth identities per user (e.g. Google AND GitHub linked)
CREATE TABLE IF NOT EXISTS user_oauth_identities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  provider ENUM('google', 'github', 'oidc') NOT NULL,
  provider_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_identity (provider, provider_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
