-- Historical server metrics for Server Monitor charts
CREATE TABLE IF NOT EXISTS server_metrics_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_id VARCHAR(64) DEFAULT 'local',
  cpu_pct FLOAT DEFAULT 0,
  memory_pct FLOAT DEFAULT 0,
  disk_pct FLOAT DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_target_time (target_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
