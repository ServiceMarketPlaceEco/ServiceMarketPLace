#!/bin/sh
# Runs once, the first time the MySQL container starts with an empty data
# volume (docker-compose.yml mounts it into /docker-entrypoint-initdb.d).
# It builds the ServiceHub database the same way `npm run db:setup --
# --production` does: every migration in order, then every seed except the
# ones with "demo" or "test" in the name (fake accounts with known
# passwords). No accounts are created: make the first admin afterwards with
#   docker compose exec backend npm run admin:create
set -e

run() {
  echo "ServiceHub: running $1"
  mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < "$1"
}

for f in /servicehub-db/migrations/*.sql; do
  run "$f"
done

for f in /servicehub-db/seeds/*.sql; do
  case "$(basename "$f" | tr 'A-Z' 'a-z')" in
    *demo*|*test*) echo "ServiceHub: skipping $f (development only)" ;;
    *) run "$f" ;;
  esac
done

echo "ServiceHub: database ready"
