-- Uptime monitoring: external URL/portal health checks
CREATE TABLE IF NOT EXISTS uptime_monitors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  url VARCHAR(500) NOT NULL,
  method ENUM('GET', 'HEAD') DEFAULT 'HEAD',
  interval_seconds INT DEFAULT 60,
  enabled TINYINT(1) DEFAULT 1,
  last_status ENUM('up', 'down', 'paused') DEFAULT 'paused',
  last_checked_at DATETIME DEFAULT NULL,
  last_down_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS uptime_checks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  monitor_id INT NOT NULL,
  status ENUM('up', 'down') NOT NULL,
  response_ms INT DEFAULT NULL,
  status_code INT DEFAULT NULL,
  error VARCHAR(300) DEFAULT NULL,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_monitor_time (monitor_id, checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
