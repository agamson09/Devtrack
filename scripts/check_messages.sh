#!/bin/bash
[ -z "$DB_PASSWORD" ] && { echo "ERROR: set DB_PASSWORD env var first" >&2; exit 1; }
mysql -u root -p"$DB_PASSWORD" devtrack -e "SELECT message, LENGTH(message) as msg_len, RIGHT(message, 5) as last5 FROM messages WHERE group_id IS NOT NULL ORDER BY id DESC LIMIT 5;"