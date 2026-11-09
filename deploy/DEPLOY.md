# Deploying ServiceHub with Docker

This runs the whole of ServiceHub (database, API and website) on one Linux
server with Docker. It is the quickest way to put the site online. The manual
way (Node, MySQL and nginx installed by hand) is in
[docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## What you need

- A Linux server (Ubuntu 22.04 or newer works) with at least 2 GB of memory
- Docker with the compose plugin: https://docs.docker.com/engine/install/ubuntu/
- For HTTPS: a domain name whose DNS points at the server, and ports 80 and 443 open
- An email provider (SMTP), for example Brevo, SendGrid or Gmail with an app password
- A Twilio account for the signup code texts (README section 9)

## 1. Get the code and fill in the settings

```bash
git clone https://github.com/ServiceMarketPlaceEco/ServiceMarketPLace.git
cd ServiceMarketPLace
cp .env.docker.example .env
nano .env
```

Fill in every value. For the passwords and the two JWT secrets, make long
random values with `openssl rand -hex 32`. `.env` stays on the server and is
never committed.

## 2. Start it

Without HTTPS (for a first test, the site is on http://SERVER-IP):

```bash
docker compose up -d --build
```

With HTTPS (set `DOMAIN`, `WEB_PORT=8080` and `TRUST_PROXY=2` in `.env` first):

```bash
docker compose --profile https up -d --build
```

The first start takes a few minutes. It builds the website and the API, and
the database is created from the migrations and the seeds that are safe for a
live site, without the demo and test accounts (`backend/database/docker-init.sh`). Check that everything is up:

```bash
docker compose ps          # db, backend and web should say "healthy" or "running"
docker compose logs backend --tail 50
```

The backend log says `Email is ready` when the email login works. It warns if
Twilio or email are not set up.

## 3. Create the first admin

The live database has no accounts (the demo admin and demo provider are for
laptops only). Make the first admin from the backend container:

```bash
docker compose exec backend npm run admin:create
```

It asks for a name, email, role (choose `super_admin`) and password. After
that, sign in on the website and add any other admins from **Admin accounts**.
`npm run admin:reset-password` and `npm run admin:deactivate` work the same way
if someone is locked out or leaves.

## 4. Before you announce it

- Fill in the [square brackets] on the Privacy Policy and Terms of Use pages
  (`servicehub/src/components/User/LegalPage.vue`), have them checked, then set
  `DRAFT` to `false` in that file and run `docker compose up -d --build` again.
- Sign up as a customer with a real phone number to check the text arrives.
- Request a password reset to check the email arrives.

## Updating to a new version

```bash
git pull
docker compose up -d --build
```

The database keeps its data. A new migration file is **not** run
automatically on an existing database, so run it by hand, for example:

```bash
docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  < backend/database/migrations/006_add_review_approval.sql
```

Every migration is safe to run twice.

## Backups

Daily backup (add it to cron):

```bash
docker compose exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  > servicehub-$(date +%F).sql
```

Restore into the running database:

```bash
docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  < servicehub-2026-11-06.sql
```

Keep copies somewhere other than the server.

## Useful commands

| What | Command |
|---|---|
| Stop everything | `docker compose down` (the data stays) |
| Restart the API | `docker compose restart backend` |
| Follow the logs | `docker compose logs -f backend` |
| Open the database | `docker compose exec db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'` |

`docker compose down -v` also deletes the database. Only use it if you mean to.
