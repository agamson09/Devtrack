-- Add Model module for deploy system
-- Run: mysql -u root -p devtrack < scripts/add_model_module_migration.sql

INSERT IGNORE INTO modules (name, display_name, controller_pattern, view_folder, route_file, sort_order) 
VALUES ('model', 'Model', NULL, NULL, NULL, 99);