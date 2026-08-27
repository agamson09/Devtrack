-- DevTrack Master Database Schema
-- This schema contains ONLY auth, tenant, and workspace management tables.
-- Workspace data (projects, tasks, messages, etc.) lives in separate workspace databases.

CREATE DATABASE IF NOT EXISTS devtrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE devtrack;

-- ============================================================
-- Users (global auth — passwords, 2FA, approval, OAuth)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) DEFAULT NULL,
  role ENUM('admin', 'member') DEFAULT 'member',
  tenant_id INT DEFAULT NULL,
  avatar VARCHAR(500) DEFAULT NULL,
  avatar_style VARCHAR(50) DEFAULT NULL,
  avatar_seed VARCHAR(100) DEFAULT NULL,
  avatar_options JSON DEFAULT NULL,
  telegram_chat_id VARCHAR(100) DEFAULT NULL,
  email_notifications TINYINT(1) DEFAULT 1,
  telegram_notifications TINYINT(1) DEFAULT 1,
  is_approved TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  two_factor_enabled TINYINT(1) DEFAULT 0,
  two_factor_secret VARCHAR(255) DEFAULT NULL,
  auth_provider VARCHAR(50) DEFAULT NULL,
  provider_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Tenants (workspaces)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  domain VARCHAR(255) DEFAULT NULL,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Tenant Settings (branding, features per workspace)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT DEFAULT NULL,
  setting_type ENUM('text', 'image', 'color', 'boolean', 'json') DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tenant_key (tenant_id, setting_key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Tenant Users (membership mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
  invited_by INT DEFAULT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tenant_user (tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Tenant Invites
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_invites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  email VARCHAR(200) NOT NULL,
  role ENUM('admin', 'member', 'viewer') DEFAULT 'member',
  token VARCHAR(64) NOT NULL,
  invited_by INT DEFAULT NULL,
  status ENUM('pending', 'accepted', 'expired', 'revoked') DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_invite_token (token),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Workspace Databases (maps tenant → physical MySQL database)
-- ============================================================
CREATE TABLE IF NOT EXISTS workspace_databases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL UNIQUE,
  db_host VARCHAR(255) DEFAULT '127.0.0.1',
  db_port INT DEFAULT 3306,
  db_name VARCHAR(255) NOT NULL,
  db_user VARCHAR(255) DEFAULT 'root',
  db_password VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- User Sessions (master DB only)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  device_info VARCHAR(255) DEFAULT NULL,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_sessions (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Security Logs (master DB only)
-- ============================================================
CREATE TABLE IF NOT EXISTS security_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  event_type VARCHAR(50) NOT NULL,
  description TEXT,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_security (user_id),
  INDEX idx_event_type (event_type),
  INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Login Attempts (master DB only)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(200) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  success TINYINT(1) DEFAULT 0,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_ip (email, ip_address),
  INDEX idx_attempted_at (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- CSRF Tokens (master DB only)
-- ============================================================
CREATE TABLE IF NOT EXISTS csrf_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Rate Limits (master DB only)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(255) NOT NULL,
  attempts INT DEFAULT 1,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_key (key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Password History (master DB only)
-- ============================================================
CREATE TABLE IF NOT EXISTS password_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Push Subscriptions (master DB only — user-level)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  p256dh_key VARCHAR(255) NOT NULL,
  auth_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_push (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Insert default tenant (DevTrack)
-- ============================================================
INSERT INTO tenants (id, name, slug, domain, status) VALUES
(1, 'DevTrack', 'default', NULL, 'active')
ON DUPLICATE KEY UPDATE name = 'DevTrack';

-- ============================================================
-- Insert default tenant settings
-- ============================================================
INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, setting_type) VALUES
(1, 'app_name', 'DevTrack', 'text'),
(1, 'app_tagline', 'Project Management & IT Support', 'text'),
(1, 'logo_url', '/favicon-white.webp', 'image'),
(1, 'logo_icon_url', '/favicon-white.webp', 'image'),
(1, 'primary_color', '#6366f1', 'color'),
(1, 'accent_color', '#818cf8', 'color'),
(1, 'login_bg', '/favicon-white.webp', 'image'),
(1, 'favicon_url', '/favicon-white.webp', 'image'),
(1, 'footer_text', '© 2026 DevTrack. All rights reserved.', 'text'),
(1, 'theme', 'dark', 'text'),
(1, 'features', '{"projects":true,"tasks":true,"chat":true,"deploy":true,"remote":true,"it_support":true,"terminal":true,"reports":true,"calendar":true,"database":true,"server_monitor":true}', 'json')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ============================================================
-- Register default workspace database (points to master DB)
-- ============================================================
INSERT INTO workspace_databases (tenant_id, db_host, db_port, db_name, db_user, db_password)
VALUES (1, '127.0.0.1', 3306, 'devtrack', 'root', NULL)
ON DUPLICATE KEY UPDATE db_name = 'devtrack';
