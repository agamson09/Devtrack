#!/bin/bash
# DevTrack - Auto MySQL Backup Script
# Runs daily at 3:00 AM via cron
# Backs up devtrack database to /var/backups/mysql/
# Retains backups for 30 days

BACKUP_DIR="/var/backups/mysql"
DB_USER="root"
DB_PASS="${MYSQL_PASSWORD:-}"
[ -z "$DB_PASS" ] && { echo "ERROR: set MYSQL_PASSWORD env var first" >&2; exit 1; }
DB_NAME="devtrack"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="devtrack-${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

mysqldump -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$FILEPATH"

if [ $? -eq 0 ]; then
    SIZE=$(du -h "$FILEPATH" | cut -f1)
    echo "[$(date)] Backup successful: ${FILENAME} (${SIZE})"
else
    echo "[$(date)] Backup FAILED" >&2
    rm -f "$FILEPATH"
    exit 1
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "devtrack-*.sql.gz" -mtime +${RETENTION_DAYS} -delete
DELETED=$(find "$BACKUP_DIR" -name "devtrack-*.sql.gz" -mtime +${RETENTION_DAYS} | wc -l)

echo "[$(date)] Cleanup: ${DELETED} old backups removed"
