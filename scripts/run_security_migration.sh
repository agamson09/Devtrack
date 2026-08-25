#!/bin/bash
[ -z "$DB_PASSWORD" ] && { echo "ERROR: set DB_PASSWORD env var first" >&2; exit 1; }
mysql -u root -p"$DB_PASSWORD" devtrack < /var/www/devtrack/scripts/security_migration.sql