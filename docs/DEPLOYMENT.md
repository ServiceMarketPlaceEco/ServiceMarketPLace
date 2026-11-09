# Deploying ServiceHub to production

This guide puts ServiceHub on a single Linux server (VPS). Everything runs on
that one server: MySQL, the NestJS API (as a systemd service) and nginx. nginx
serves the built Vue frontend and forwards `/api` to the API, all over HTTPS on
one domain.

> For a local development copy, see the root [README](../README.md).
> This guide never uses the demo accounts or the test seed data.

**Contents**

1. [Before you start](#1-before-you-start)
2. [Prepare the server](#2-prepare-the-server)
3. [Create the database and its user](#3-create-the-database-and-its-user)
4. [Install and configure the backend](#4-install-and-configure-the-backend)
5. [Create the tables and the first admin](#5-create-the-tables-and-the-first-admin)
6. [Run the backend as a service](#6-run-the-backend-as-a-service)
7. [Build the frontend](#7-build-the-frontend)
8. [nginx and HTTPS](#8-nginx-and-https)
9. [Check the deployment](#9-check-the-deployment)
10. [Backups and restore](#10-backups-and-restore)
11. [Deploying a new version](#11-deploying-a-new-version)
12. [Admin accounts](#12-admin-accounts)
13. [Known limitations at launch](#13-known-limitations-at-launch)

---

## 1. Before you start

You need:

| What | Notes |
|---|---|
| A Linux server | Ubuntu 22.04 or 24.04 LTS. 2 GB RAM is enough. |
| A domain | e.g. `servicehub.example.com`, with a DNS **A record** pointing at the server. The examples below use this name: replace it everywhere with your own. |
| SMTP account | For password-reset and welcome emails (e.g. SendGrid, Amazon SES, Mailgun, or your own mail server). |
| *(Optional)* Google OAuth client ID | Only for "Continue with Google" (see the root README, step 8). Add `https://servicehub.example.com` as an authorized JavaScript origin. |
| *(Optional)* OpenAI API key | AI chatbot and AI voice-search matching. Without it, voice search uses the built-in matcher and the chatbot is unavailable. |
| *(Optional)* Anthropic API key | "Screen with AI" on the admin moderation page. Without it, the button says AI screening is not configured. |

Read [section 13](#13-known-limitations-at-launch) first: customer sign-up
needs an SMS provider that isn't connected yet.

## 2. Prepare the server

Log in as a user with `sudo`, then install Node.js 22 (the version CI tests
with), MySQL 8, nginx, certbot and git:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```bash
sudo apt-get install -y nodejs mysql-server nginx certbot python3-certbot-nginx git
```

Create a system user to own and run the app, and get the code:

```bash
sudo adduser --system --group --home /opt/servicehub servicehub
```

```bash
sudo -u servicehub git clone https://github.com/ServiceMarketPlaceEco/ServiceMarketPLace.git /opt/servicehub/app
```

Only allow SSH and web traffic in. MySQL (3306) and the API (3001) must **not**
be reachable from the internet; nginx is the only way in:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## 3. Create the database and its user

The app gets its own MySQL user that can only touch its own database. Don't use
`root`. Generate a password and keep it for the next step:

```bash
openssl rand -base64 24
```

```bash
sudo mysql
```

```sql
CREATE DATABASE servicehub CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'servicehub'@'localhost' IDENTIFIED BY 'PASTE_THE_GENERATED_PASSWORD';
GRANT ALL PRIVILEGES ON servicehub.* TO 'servicehub'@'localhost';
EXIT;
```

## 4. Install and configure the backend

```bash
cd /opt/servicehub/app/backend
```

```bash
sudo -u servicehub npm ci
```

```bash
sudo -u servicehub npm run build
```

Create the production settings file. It holds secrets, so only the
`servicehub` user may read it. It is **never** committed to git
(`.gitignore` already excludes it).

```bash
sudo -u servicehub cp .env.example .env && sudo chmod 600 .env
```

Generate the two JWT secrets (run it twice, one value for each):

```bash
openssl rand -hex 32
```

Edit `.env` (`sudo -u servicehub nano .env`) and set at least:

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `API_PORT` | `3001` (only nginx connects to it) |
| `APP_URL` | `https://servicehub.example.com` (used for links in emails) |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` |
| `DB_USERNAME` / `DB_PASSWORD` | `servicehub` / the password from step 3 |
| `DB_DATABASE` | `servicehub` |
| `JWT_ACCESS_SECRET` | first generated value |
| `JWT_REFRESH_SECRET` | second generated value |
| `CORS_ORIGIN` | `https://servicehub.example.com` |
| `TRUST_PROXY` | `1` (the app is behind nginx, so the rate limits must use each visitor's real IP) |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS` | your SMTP provider's settings (port 587 with STARTTLS) |
| `MAIL_FROM`, `MAIL_FROM_NAME` | the sender address and name, on a domain your SMTP provider is allowed to send for |
| `GOOGLE_CLIENT_ID` | optional, see section 1 |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | optional, see section 1 |
| `ENABLE_SWAGGER` | leave empty, so the API docs at `/api/docs` stay off in production |

The rate-limit values (`RATE_LIMIT`, `AUTH_RATE_LIMIT`, `AI_RATE_LIMIT` and
their windows) can keep their defaults.

With `NODE_ENV=production` the app **refuses to start** if
`JWT_ACCESS_SECRET` is missing, shorter than 32 characters, or still the
`your_...` example value. That's deliberate.

## 5. Create the tables and the first admin

```bash
sudo -u servicehub npm run db:setup -- --production
```

This runs every migration in `database/migrations/` and only the
production-safe seeds:

| Seed | Production? | Contents |
|---|---|---|
| `001_seed_data.sql` | ✅ runs | General service categories |
| `002_rajshahi_services_seed.sql` | ✅ runs | Rajshahi service categories |
| `003_moderation_test_seed.sql` | ❌ skipped | Fake accounts and reviews for testing moderation |
| `004_service_images_seed.sql` | ✅ runs | Photos for the service categories |
| `005_demo_accounts_seed.sql` | ❌ skipped | `admin@servicehub.com` / `Admin@123` and the demo provider, whose passwords are public |

Any seed with `demo` or `test` in its file name is skipped in production mode.
Name new seed files the same way. With `NODE_ENV=production`, a plain
`npm run db:setup` (without `--production`) refuses to run, and `db:reset` is
blocked, so the live database can't get test data or be dropped by accident.

The production database starts with **no accounts at all**. Create the first
admin. It asks for a name, email, role (press Enter for `super_admin`) and a
password (at least 12 characters, upper and lower case, and a number or
symbol), which is not shown as you type:

```bash
sudo -u servicehub npm run admin:create
```

The service categories have no providers yet. Real providers sign up through
the app, an admin verifies them, and they set their prices.

> **Moving an existing development database to production instead?**
> `npm run db:setup -- --production` warns about every demo or test account
> still active in it. After creating a real admin, turn them all off:
> `npm run db:disable-demo-accounts`. It deactivates them, replaces their
> passwords with random ones, signs them out, and makes the demo provider's
> services unbookable. Bookings and reviews that point at them are kept.

## 6. Run the backend as a service

`npm run build` writes the app to `backend/dist/`, and
`npm run start:prod` runs `node dist/main`. Make systemd run it, restart it
if it crashes, and start it at boot:

```bash
sudo tee /etc/systemd/system/servicehub-api.service > /dev/null <<'EOF'
[Unit]
Description=ServiceHub API
After=network.target mysql.service

[Service]
Type=simple
User=servicehub
WorkingDirectory=/opt/servicehub/app/backend
ExecStart=/usr/bin/node dist/main
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now servicehub-api
```

Check it started (`Application is running on: http://localhost:3001`):

```bash
sudo journalctl -u servicehub-api -n 30 --no-pager
```

Run **one** instance only. The rate limits are counted in memory, so several
copies of the app (for example PM2 cluster mode) would each count separately.

## 7. Build the frontend

The API address is baked into the frontend when it's built, so build it on the
server (or anywhere) with the production values:

```bash
cd /opt/servicehub/app/servicehub
```

```bash
sudo -u servicehub tee .env.production > /dev/null <<'EOF'
VITE_API_URL=https://servicehub.example.com/api
VITE_GOOGLE_CLIENT_ID=
EOF
```

Put the same Google client ID here as in the backend `.env`, or leave it
empty to show the Google button as "not configured".

```bash
sudo -u servicehub npm ci && sudo -u servicehub npm run build
```

The finished site is in `servicehub/dist/`: plain static files, nothing to run.

## 8. nginx and HTTPS

```bash
sudo tee /etc/nginx/sites-available/servicehub > /dev/null <<'EOF'
server {
    listen 80;
    server_name servicehub.example.com;

    # the built Vue app
    root /opt/servicehub/app/servicehub/dist;
    index index.html;

    # the app uses #/page links, so every other path (like the
    # /reset-password link in emails) just loads the app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # the NestJS API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10m;
    }
}
EOF
```

```bash
sudo ln -s /etc/nginx/sites-available/servicehub /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Get a free Let's Encrypt certificate. certbot adds HTTPS to the config above,
redirects HTTP to HTTPS, and renews the certificate by itself:

```bash
sudo certbot --nginx -d servicehub.example.com --redirect
```

nginx (the `www-data` user) needs to read `servicehub/dist`. If the site shows
"403 Forbidden", run `sudo chmod o+rx /opt/servicehub /opt/servicehub/app /opt/servicehub/app/servicehub`.

## 9. Check the deployment

- [ ] `https://servicehub.example.com` loads with a valid padlock, and `http://` redirects to it.
- [ ] `https://servicehub.example.com/api/services` returns the service list as JSON.
- [ ] `https://servicehub.example.com/api/docs` returns 404 (Swagger is off).
- [ ] You can sign in with the admin you created in step 5.
- [ ] `admin@servicehub.com` / `Admin@123` does **not** work.
- [ ] "Forgot password" sends a real email to a test address.
- [ ] From another machine, ports 3306 and 3001 are closed (`nc -zv servicehub.example.com 3306` fails).
- [ ] The first backup (next section) ran, and you restored it once to a test database.

## 10. Backups and restore

The database is the only thing that changes: the code is in git, and the
settings are in `backend/.env` and `servicehub/.env.production`. Keep a copy
of both env files in your password manager, not in git.

### Nightly database backup

```bash
sudo mkdir -p /var/backups/servicehub && sudo chown servicehub: /var/backups/servicehub
```

Give the backup job its own read-only MySQL user, so the app's password isn't
copied around:

```bash
sudo mysql -e "CREATE USER 'servicehub_backup'@'localhost' IDENTIFIED BY 'ANOTHER_GENERATED_PASSWORD'; GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES, EVENT, PROCESS ON *.* TO 'servicehub_backup'@'localhost';"
```

```bash
sudo -u servicehub tee /opt/servicehub/.my.cnf > /dev/null <<'EOF'
[mysqldump]
user=servicehub_backup
password=ANOTHER_GENERATED_PASSWORD
EOF
```

```bash
sudo chmod 600 /opt/servicehub/.my.cnf
```

The backup script keeps 14 days of compressed dumps:

```bash
sudo tee /opt/servicehub/backup.sh > /dev/null <<'EOF'
#!/bin/sh
set -e
FILE=/var/backups/servicehub/servicehub-$(date +%F-%H%M).sql.gz
mysqldump --defaults-extra-file=/opt/servicehub/.my.cnf --single-transaction --routines --triggers servicehub | gzip > "$FILE"
find /var/backups/servicehub -name 'servicehub-*.sql.gz' -mtime +14 -delete
EOF
```

```bash
sudo chmod 750 /opt/servicehub/backup.sh && sudo chown servicehub: /opt/servicehub/backup.sh
```

Run it once by hand to check it works, then schedule it for 02:30 every night:

```bash
sudo -u servicehub /opt/servicehub/backup.sh && ls -lh /var/backups/servicehub
```

```bash
echo '30 2 * * * servicehub /opt/servicehub/backup.sh' | sudo tee /etc/cron.d/servicehub-backup
```

**Copy the backups off the server.** A backup on the same disk is lost with the
server. Copy `/var/backups/servicehub` daily to other storage (your hosting
provider's object storage, another server with `rsync`, etc.), or turn on the
provider's server snapshots as well.

### Restoring a backup

Test this before you need it: restore into a scratch database first.

```bash
sudo mysql -e "CREATE DATABASE servicehub_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
```

```bash
gunzip -c /var/backups/servicehub/servicehub-YYYY-MM-DD-HHMM.sql.gz | sudo mysql servicehub_restore_test
```

To restore the live database, stop the API, take a fresh backup of the current
state (in case you need it), restore, then start the API again:

```bash
sudo systemctl stop servicehub-api
```

```bash
sudo -u servicehub /opt/servicehub/backup.sh
```

```bash
gunzip -c /var/backups/servicehub/servicehub-YYYY-MM-DD-HHMM.sql.gz | sudo mysql servicehub
```

```bash
sudo systemctl start servicehub-api
```

The dump recreates every table it contains, so this replaces the live data with
the backup's.

## 11. Deploying a new version

Back up first, then update the code, rebuild both parts, apply new
migrations, and restart:

```bash
sudo -u servicehub /opt/servicehub/backup.sh
```

```bash
cd /opt/servicehub/app && sudo -u servicehub git pull
```

```bash
cd backend && sudo -u servicehub npm ci && sudo -u servicehub npm run build && sudo -u servicehub npm run db:setup -- --production
```

```bash
cd ../servicehub && sudo -u servicehub npm ci && sudo -u servicehub npm run build
```

```bash
sudo systemctl restart servicehub-api
```

`db:setup -- --production` can be run on every deploy: all migrations and seeds
are written to be re-run safely, so it only applies what's new. It never
overwrites a service photo an admin has changed.

Only deploy commits that passed CI (the green tick on GitHub).

## 12. Admin accounts

The first admin has to be made with a command on the server. After that, a
super admin can add admins, switch them off or on, and change their own
password on the **Admin accounts** page of the admin dashboard. The commands
below still work, and are the way back in if every admin is locked out. Run
them from `/opt/servicehub/app/backend`, as the `servicehub` user
(`sudo -u servicehub npm run ...`). Each one asks for the admin's email.

| Task | Command |
|---|---|
| Add an admin (the first one, or more) | `npm run admin:create` |
| Forgotten password / locked out | `npm run admin:reset-password`: sets a new password, reactivates the account and signs it out on every device |
| Someone leaves | `npm run admin:deactivate`: they can't sign in any more and are signed out everywhere. The last active admin can't be deactivated. |

Roles: `super_admin`, `admin` and `moderator`.

**Never** use `admin@servicehub.com`. It exists only in development databases,
and its password is published in the README.

## 13. Known limitations at launch

These need a decision from the client before go-live:

| Area | Current state | What's needed |
|---|---|---|
| **Customer sign-up (SMS)** | Sign-up in the app sends a 6-digit code to the customer's phone, but **no SMS provider is connected**. In production the code isn't shown or logged, so **customers can't finish signing up in the app**. Google sign-in only works for accounts that already exist. | Choose an SMS provider (e.g. Twilio, or a local Bangladeshi gateway) and connect it in `sendPhoneVerification()` in `backend/src/modules/auth/auth.service.ts`. This is a blocker for a public launch. |
| **Phone check isn't enforced by the API** | `POST /api/auth/register/customer` accepts sign-ups without a `phoneVerificationToken`. Only the app's sign-up form requires the code. | Once SMS works, make the token required in the API. |
| **Payments** | The payments module records payments against bookings. No payment gateway (card, bKash, etc.) is integrated. | Decide whether launch is cash-only or which gateway to integrate. |
| **Password reset email** | The email shows a reset token that the user pastes into the "Forgot password" form. The button in the email only opens the site; it doesn't fill the token in. | Works as is. Optionally make the link open the reset form with the token filled in. |
| **Docker** | No Dockerfile or compose file is provided; this guide installs directly on the server. | Optional. |
