#!/bin/bash
[ -z "$DB_PASSWORD" ] && { echo "ERROR: set DB_PASSWORD env var first" >&2; exit 1; }

mysql -u root -p"$DB_PASSWORD" devtrack -e "SHOW TABLES LIKE 'deploy%';"
mysql -u root -p"$DB_PASSWORD" devtrack -e "SHOW TABLES LIKE 'file_activity%';"
mysql -u root -p"$DB_PASSWORD" devtrack -e "SHOW TABLES LIKE 'modules';"
mysql -u root -p"$DB_PASSWORD" devtrack -e "DESCRIBE tasks module;"
mysql -u root -p"$DB_PASSWORD" devtrack -e "SELECT COUNT(*) as module_count FROM modules;"
