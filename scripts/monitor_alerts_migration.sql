-- Server monitor alerting thresholds (Telegram notifications)
CREATE TABLE IF NOT EXISTS server_alert_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  cpu_threshold INT DEFAULT 85,
  memory_threshold INT DEFAULT 90,
  disk_threshold INT DEFAULT 90,
  cooldown_minutes INT DEFAULT 30,
  telegram_chat_id VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO server_alert_settings (enabled)
SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM server_alert_settings);
