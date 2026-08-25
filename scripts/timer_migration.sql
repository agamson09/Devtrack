ALTER TABLE tasks ADD COLUMN timer_started_at DATETIME DEFAULT NULL AFTER actual_hours;
ALTER TABLE tasks ADD COLUMN timer_accumulated_seconds INT DEFAULT 0 AFTER timer_started_at;
