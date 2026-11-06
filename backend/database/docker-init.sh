#!/bin/sh
# Runs once, the first time the MySQL container starts with an empty data
# volume (docker-compose.yml mounts it into /docker-entrypoint-initdb.d).
# It builds the ServiceHub database the same way the deployment guide does:
# every migration in order, then only the seeds that are safe for a real
# site. 003_moderation_test_seed.sql (fake accounts and reviews) is left out.
set -e

run() {
  echo "ServiceHub: running $1"
  mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < "$1"
}

for f in /servicehub-db/migrations/*.sql; do
  run "$f"
done

run /servicehub-db/seeds/001_seed_data.sql
run /servicehub-db/seeds/002_rajshahi_services_seed.sql
run /servicehub-db/seeds/004_service_images_seed.sql

echo "ServiceHub: database ready"
