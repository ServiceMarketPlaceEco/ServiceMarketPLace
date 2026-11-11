#!/bin/sh
# Daily backup of the ServiceHub database (Docker setup).
#
# Run it from the folder that has docker-compose.yml:
#   sh deploy/backup.sh
#
# It saves one compressed file per day in ./backups and deletes files older
# than KEEP_DAYS (30 by default). To run it every night at 2am, add this line
# with `crontab -e` (change the path to where the code is):
#   0 2 * * * cd /opt/servicehub && sh deploy/backup.sh >> backups/backup.log 2>&1
#
# Copy the backups folder somewhere other than this server as well. A backup
# that only lives on the server is lost with the server.
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
FILE="$BACKUP_DIR/servicehub-$(date +%F-%H%M).sql.gz"

mkdir -p "$BACKUP_DIR"

# --single-transaction takes a consistent copy without locking the site
docker compose exec -T db sh -c \
  'mysqldump --single-transaction --no-tablespaces -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  | gzip > "$FILE.part"

# an empty or tiny file means the dump failed, so do not keep it
SIZE=$(wc -c < "$FILE.part")
if [ "$SIZE" -lt 1000 ]; then
  rm -f "$FILE.part"
  echo "$(date) backup FAILED: the dump was empty" >&2
  exit 1
fi

mv "$FILE.part" "$FILE"
find "$BACKUP_DIR" -name 'servicehub-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date) backup saved: $FILE ($SIZE bytes)"

# To restore a backup into the running database:
#   gunzip -c backups/servicehub-2026-11-12-0200.sql.gz | \
#     docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
