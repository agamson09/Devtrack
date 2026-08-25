-- Wiki / Knowledge Base module
-- Run once against the production database.

USE devtrack;

CREATE TABLE IF NOT EXISTS wiki_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT DEFAULT NULL,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL,
  content MEDIUMTEXT,
  tags VARCHAR(500) DEFAULT NULL,
  created_by INT NOT NULL,
  tenant_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_wiki_slug (slug),
  INDEX idx_wiki_project (project_id),
  INDEX idx_wiki_tenant (tenant_id)
);
