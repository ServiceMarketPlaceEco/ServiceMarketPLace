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
for f in backend/database/migrations/006_add_review_approval.sql \
         backend/database/migrations/007_reviews_without_booking.sql \
         backend/database/migrations/008_add_support_chat.sql; do
  docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < "$f"
done
```

Every migration is safe to run twice.

## Backups

`deploy/backup.sh` saves a compressed copy of the database in `./backups` and
deletes copies older than 30 days:

```bash
sh deploy/backup.sh
```

To run it every night at 2am, run `crontab -e` and add this line (change the
path to where the code is):

```
0 2 * * * cd /opt/servicehub && sh deploy/backup.sh >> backups/backup.log 2>&1
```

Restore a backup into the running database:

```bash
gunzip -c backups/servicehub-2026-11-12-0200.sql.gz | \
  docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
```

Copy the `backups` folder somewhere other than the server (another computer
or cloud storage). Restore one backup into a test database before launch so
you know it works.

## Monitoring

`https://your-domain/api/health` returns `{"status":"ok","database":"up"}`
when the site and its database are working, and an error (503) when the
database is down. Docker uses the same address to restart the API if it stops
answering.

Add that address to a free uptime monitor such as UptimeRobot or Better Stack
and it will email you when the site goes down. `docker compose logs -f backend`
shows what the API is doing.

## How much traffic it handles

A short load test was run on 12 November 2026 against a development machine
(2 CPU cores, 8 GB memory, API and database on the same machine, rate limits
raised for the test). Each run lasted 20 seconds.

| Page | People at once | Requests per second | Average wait | Slowest 1% | Failed |
|---|---|---|---|---|---|
| Service list | 50 | about 1,010 | 49 ms | 93 ms | 0 |
| Provider list | 50 | about 1,010 | 49 ms | 79 ms | 0 |
| Reviews | 50 | about 250 | 199 ms | 267 ms | 0 |
| Admin messages (signed in) | 50 | about 490 | 101 ms | 159 ms | 0 |
| Service list | 200 | about 820 | 242 ms | 382 ms | 0 |

This is far more than a new local marketplace needs, but it is not a test of
the real server or the real internet connection. Repeat it on the live server
before a big launch:

```bash
npx autocannon -c 50 -d 20 https://your-domain/api/services
```

Each visitor is limited to 120 requests a minute (`RATE_LIMIT`), so run the
test from the server itself or raise the limit while testing.

## Useful commands

| What | Command |
|---|---|
| Stop everything | `docker compose down` (the data stays) |
| Restart the API | `docker compose restart backend` |
| Follow the logs | `docker compose logs -f backend` |
| Open the database | `docker compose exec db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'` |

`docker compose down -v` also deletes the database. Only use it if you mean to.
