-- Avatar customization columns (order matters: each column is positioned AFTER the previous one)
ALTER TABLE users ADD COLUMN avatar_style VARCHAR(50) DEFAULT NULL AFTER avatar;
ALTER TABLE users ADD COLUMN avatar_seed VARCHAR(100) DEFAULT NULL AFTER avatar_style;
ALTER TABLE users ADD COLUMN avatar_options JSON DEFAULT NULL AFTER avatar_seed;
