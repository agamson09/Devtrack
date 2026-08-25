-- User dashboard layout (customizable widget arrangement, stored as JSON string)
ALTER TABLE users ADD COLUMN dashboard_layout LONGTEXT DEFAULT NULL;
