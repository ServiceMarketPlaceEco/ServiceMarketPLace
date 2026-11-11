# ServiceHub

ServiceHub is a local services marketplace for Rajshahi. Customers book
services (cleaning, repairs, tutoring...), providers manage their jobs and
prices, and admins verify providers and moderate accounts and reviews.

| Part | Folder | Stack |
|---|---|---|
| Frontend | [`servicehub/`](servicehub/) | Vue 3 + Vite |
| Backend API | [`backend/`](backend/) | NestJS 10 + TypeORM, JWT auth ([API reference](backend/README.md)) |
| Database | [`backend/database/`](backend/database/) | MySQL 8: numbered SQL migrations and seeds |

The `package.json` at the repository root isn't an app and nothing needs it.
It only lists ESLint and Prettier packages for editor plugins; no script or lint
config uses them. Run `npm install` and the app commands inside `backend/` and
`servicehub/`.

**Documentation**

- This README: a working copy on your own computer (below).
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): production deployment by hand, the first admin account, backups and restore.
- [deploy/DEPLOY.md](deploy/DEPLOY.md): the same with Docker, in one command.
- [backend/README.md](backend/README.md): API endpoints and schema.
- [docs/HANDOVER.md](docs/HANDOVER.md): handover status against the client's reviews, and open questions.

---

# Local Setup From Scratch (Database + Backend + Frontend)

These steps build a complete, working copy of ServiceHub on your own computer:
a new MySQL database (schema + seed data), the NestJS backend and the Vue frontend.
It doesn't depend on any shared or remote database.

## 1. Install the prerequisites

| Tool | Version | Check with |
|---|---|---|
| [Node.js](https://nodejs.org/) (includes npm) | 18 or newer (20 LTS recommended) | `node -v` |
| [MySQL Server](https://dev.mysql.com/downloads/mysql/) | 8.0 or newer | `mysql --version` |
| [Git](https://git-scm.com/) | any | `git --version` |
| [DBeaver](https://dbeaver.io/download/) *(optional)* | any | – |

**Installing MySQL 8** — pick one:

- **Windows / macOS:** run the MySQL Installer from the link above. Choose *Server only* (or *Developer Default*), keep port `3306`, and **write down the `root` password** you set.
- **macOS (Homebrew):** `brew install mysql && brew services start mysql`, then `mysql_secure_installation` to set a root password.
- **Ubuntu/Debian:** `sudo apt install mysql-server`, then `sudo mysql_secure_installation`.
- **Docker (any OS):**
  ```bash
  docker run -d --name servicehub-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=your_password mysql:8.0
  ```

Make sure the MySQL server is running before continuing.

> You do **not** need to create the database by hand — the setup script in step 4 does that.

## 2. Get the code

```bash
git clone https://github.com/ServiceMarketPlaceEco/ServiceMarketPLace.git
cd ServiceMarketPLace
```

## 3. Configure the backend

```bash
cd backend
npm install
cp .env.example .env          # Windows (cmd): copy .env.example .env
```

Open `backend/.env` and set the database values to match **your** MySQL server:

```env
NODE_ENV=development
API_PORT=3001

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password     # the root password you set in step 1
DB_DATABASE=servicehub        # will be created for you
```

Leave the other values as they are for local use. The mail settings are only
needed for email features, `OPENAI_API_KEY` only for the AI chatbot and
AI voice-search matching, and `ANTHROPIC_API_KEY` only for the "Screen with AI"
button on the admin moderation page (it uses Claude). Without the key, voice search still works using the
built-in rule-based matcher (synonyms, Bengali terms and typo tolerance).

## 4. Create the database, tables and seed data

Still inside `backend/`:

```bash
npm run db:setup
```

This connects with the settings in `.env`, creates the `servicehub` database if
it does not exist, and runs these scripts in order:

| Order | File | What it does |
|---|---|---|
| 1 | `backend/database/migrations/000_initial_schema.sql` | Creates all 10 tables (admins, customers, service_providers, services, provider_services, bookings, payments, reviews, block_reports, refresh_tokens) |
| 2 | `backend/database/migrations/001_add_provider_location.sql` | Live provider-location columns on bookings |
| 3 | `backend/database/migrations/002_add_username_login.sql` | Username sign-in + the phone_verifications table |
| 4 | `backend/database/migrations/003_add_service_image.sql` | `image_url` photo column on services |
| 5 | `backend/database/migrations/004_add_phone_verification_attempts.sql` | `failed_attempts` on phone_verifications, so a code locks after 5 wrong guesses |
| 6 | `backend/database/migrations/005_add_chat.sql` | Chat approvals and messages between customers and providers |
| 7 | `backend/database/migrations/006_add_review_approval.sql` | Approval status on reviews (pending, approved, rejected) |
| 8 | `backend/database/migrations/007_reviews_without_booking.sql` | Lets a review be about a provider without a booking |
| 9 | `backend/database/migrations/008_add_support_chat.sql` | Messages between the admin team and a customer or provider |
| 10 | `backend/database/seeds/001_seed_data.sql` | General service categories |
| 11 | `backend/database/seeds/002_rajshahi_services_seed.sql` | Rajshahi service catalog |
| 12 | `backend/database/seeds/003_moderation_test_seed.sql` | Test accounts and reviews for the moderation workflow *(development only)* |
| 13 | `backend/database/seeds/004_service_images_seed.sql` | Photos for the seeded services |
| 14 | `backend/database/seeds/005_demo_accounts_seed.sql` | Default admin + a demo provider with prices *(development only)* |

Expected output:

```
Running database/migrations/000_initial_schema.sql
Running database/migrations/001_add_provider_location.sql
Running database/migrations/002_add_username_login.sql
Running database/migrations/003_add_service_image.sql
Running database/migrations/004_add_phone_verification_attempts.sql
Running database/migrations/005_add_chat.sql
Running database/migrations/006_add_review_approval.sql
Running database/migrations/007_reviews_without_booking.sql
Running database/migrations/008_add_support_chat.sql
Running database/seeds/001_seed_data.sql
Running database/seeds/002_rajshahi_services_seed.sql
Running database/seeds/003_moderation_test_seed.sql
Running database/seeds/004_service_images_seed.sql
Running database/seeds/005_demo_accounts_seed.sql

Done. Database `servicehub` has 13 tables.
```

Seeds marked *development only* create accounts whose passwords are listed in
this README. A production server uses `npm run db:setup -- --production`,
which skips them (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

All scripts are safe to re-run. To wipe everything and start over:

```bash
npm run db:reset              # DROPS the database, then runs the setup again
```

<details>
<summary><b>Alternative: run the SQL files manually (DBeaver or mysql CLI)</b></summary>

**mysql command line** (from the `backend/` folder):

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS servicehub CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
mysql -u root -p servicehub < database/migrations/000_initial_schema.sql
mysql -u root -p servicehub < database/migrations/001_add_provider_location.sql
mysql -u root -p servicehub < database/migrations/002_add_username_login.sql
mysql -u root -p servicehub < database/migrations/003_add_service_image.sql
mysql -u root -p servicehub < database/migrations/004_add_phone_verification_attempts.sql
mysql -u root -p servicehub < database/migrations/005_add_chat.sql
mysql -u root -p servicehub < database/migrations/006_add_review_approval.sql
mysql -u root -p servicehub < database/migrations/007_reviews_without_booking.sql
mysql -u root -p servicehub < database/migrations/008_add_support_chat.sql
mysql -u root -p servicehub < database/seeds/001_seed_data.sql
mysql -u root -p servicehub < database/seeds/002_rajshahi_services_seed.sql
mysql -u root -p servicehub < database/seeds/003_moderation_test_seed.sql
mysql -u root -p servicehub < database/seeds/004_service_images_seed.sql
mysql -u root -p servicehub < database/seeds/005_demo_accounts_seed.sql
```

**DBeaver:**

1. **New Database Connection** (plug icon) → **MySQL** → Next.
2. Host `localhost`, Port `3306`, leave *Database* empty, Username `root`, Password = your root password.
   If you get *"Public Key Retrieval is not allowed"*, open **Driver properties** and set `allowPublicKeyRetrieval` = `true`.
3. **Test Connection** → **Finish**.
4. Open an SQL editor on the connection and run:
   `CREATE DATABASE servicehub CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
5. Refresh, select the `servicehub` database, then open each file below and execute it as a script (**Alt+X**), in this order:
   1. `backend/database/migrations/000_initial_schema.sql`
   2. `backend/database/migrations/001_add_provider_location.sql`
   3. `backend/database/migrations/002_add_username_login.sql`
   4. `backend/database/migrations/003_add_service_image.sql`
   5. `backend/database/migrations/004_add_phone_verification_attempts.sql`
   6. `backend/database/migrations/005_add_chat.sql`
   7. `backend/database/migrations/006_add_review_approval.sql`
   8. `backend/database/migrations/007_reviews_without_booking.sql`
   9. `backend/database/migrations/008_add_support_chat.sql`
   9. `backend/database/seeds/001_seed_data.sql`
   10. `backend/database/seeds/002_rajshahi_services_seed.sql`
   11. `backend/database/seeds/003_moderation_test_seed.sql`
   12. `backend/database/seeds/004_service_images_seed.sql`
   13. `backend/database/seeds/005_demo_accounts_seed.sql`

</details>

> `backend/database/legacy/001_schema_update.sql` is an old patch for the previous
> hand-built database. It is **not** part of this setup — do not run it.

## 5. Start the backend

In `backend/`:

```bash
npm run start:dev
```

You should see `Application is running on: http://localhost:3001`.
Open **http://localhost:3001/api/docs** to see the Swagger API docs.

## 6. Start the frontend

In a **second terminal**, from the repository root:

```bash
cd servicehub
npm install
npm run dev
```

`servicehub/.env` should contain `VITE_API_URL=http://localhost:3001/api`
(copy it from `servicehub/.env.example` if it is missing). Open the URL Vite prints
(usually **http://localhost:5173**).

## 7. Log in with the seeded accounts

> ⚠️ **Local development only.** These accounts come from
> `005_demo_accounts_seed.sql` and their passwords are public. They are never
> created on a production server: there, the first admin is made with
> `npm run admin:create` (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

| Role | Email | Password |
|---|---|---|
| Admin | `admin@servicehub.com` | `Admin@123` |
| Provider (demo) | `demo.provider@servicehub.local` | `Provider@123` |

Customers can be created through the app's sign-up page
(or `POST /api/auth/register/customer` in Swagger).

## 8. (Optional) Enable "Continue with Google"

Google sign-in only signs in **existing** accounts: the Google account's email
must match the email a customer, provider or admin registered with. Otherwise
the sign-in page shows "This user has not been signed up".

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth client ID** of type **Web application**.
2. Under **Authorized JavaScript origins** add `http://localhost:5173` (and your
   deployed frontend URL). No redirect URI is needed.
3. Put the client ID in both env files and restart both servers:
   - `backend/.env`: `GOOGLE_CLIENT_ID=<client id>`
   - `servicehub/.env`: `VITE_GOOGLE_CLIENT_ID=<client id>`

Without a client ID the button is shown disabled with a "not configured" note.

## 9. Phone codes by SMS (Twilio)

Customer signup sends a 6-digit code to the customer's phone. On your laptop you
don't need anything: leave the `TWILIO_*` values blank and the code is printed in
the backend terminal as `[phone-verification] code for ...: 123456`.

To send real texts (needed on the live server):

1. Create an account at [twilio.com](https://www.twilio.com) and get a phone number.
2. From the Twilio Console, put these in `backend/.env` and restart the backend:
   - `TWILIO_ACCOUNT_SID=` (starts with AC)
   - `TWILIO_AUTH_TOKEN=`
   - `TWILIO_FROM=` (your Twilio number, like +1...)
3. `SMS_DEFAULT_COUNTRY_CODE` is added in front of local numbers (`+880` for
   Bangladesh, `+61` if you are testing with an Australian number).

A Twilio trial account can only text numbers you have verified in the Twilio
Console, and the message starts with "Sent from your Twilio trial account".

## 10. Email

The backend emails customers when they sign up, reset a password, send a
request, and when their booking is confirmed, started, finished or cancelled.
Providers get an email when a review about them is approved.

Admins get an email when something is waiting for them: a new request, a
provider application, a review to approve, a chat to approve, or a message
sent to the admin team. Customers and providers get an email when an admin
replies to them, opens or closes their chat, or decides on a review. These
go to every active admin account, so use real email addresses for admins.
An email problem never stops the action itself.

### Messages to the admin team

Customers (**Message admin** on their dashboard) and providers (**Messages**)
can write to the admin team, and admins answer from **Messages** in the admin
workspace, where they can also start a conversation with anyone. This is
separate from the customer and provider chat on a booking, which an admin
has to approve first.

### Health check

`GET /api/health` answers `{"status":"ok","database":"up"}` when the API and
the database are both working, and 503 when the database is down. Point an
uptime monitor at it.

On your laptop leave the Mailtrap values in `backend/.env`: Mailtrap catches the
emails so nobody real receives them. On the live server put a real SMTP
provider in the `MAIL_*` settings (see `backend/.env.example` for examples).
The live server checks the email login when it starts and logs
`Email is ready` or the reason it failed.

## 11. Putting it on a server (Docker)

`docker-compose.yml` runs the database, the API and the website together on one
server, with optional HTTPS. The steps are in [deploy/DEPLOY.md](deploy/DEPLOY.md).

```bash
cp .env.docker.example .env      # fill in the values
docker compose up -d --build
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL is not running, or is on another port — start it / fix `DB_PORT`. |
| `Access denied for user 'root'@'localhost'` | Wrong `DB_USERNAME` / `DB_PASSWORD` in `backend/.env`. |
| `Unknown database 'servicehub'` when starting the backend | Run `npm run db:setup` first (step 4). |
| `EADDRINUSE :::3001` | Something else is using port 3001 — stop it or change `API_PORT` (and `VITE_API_URL` to match). |
| Frontend loads but shows no data / CORS errors | Backend isn't running, or `VITE_API_URL` / `CORS_ORIGIN` don't match the ports you're using. |

## Changing the database schema

The backend's TypeORM entities (`backend/src/modules/**/entities/*.entity.ts`) and
`000_initial_schema.sql` describe the same schema. When you change an entity, add a new
numbered file (e.g. `backend/database/migrations/001_add_x.sql`) with the matching
`ALTER TABLE`/`CREATE TABLE` statements, so that `npm run db:setup` keeps producing the
same database the code expects. New seed files go in `backend/database/seeds/` with the
next number.

## Running the tests

None of the tests need MySQL, an OpenAI key or the internet: the database, email and
OpenAI calls are mocked.

| Suite | Folder | Command |
|---|---|---|
| Backend unit tests (Jest) | `backend` | `npm test` |
| Backend integration tests (Jest + Supertest, real guards and validation) | `backend` | `npm run test:e2e` |
| Whole-backend coverage (unit + integration, every source file) | `backend` | `npm run test:cov:all` |
| Frontend unit tests (Vitest) | `servicehub` | `npm run test:run` |
| Frontend browser tests (Playwright, starts the dev server itself) | `servicehub` | `npm run test:e2e` |

`npm run test:cov:all` prints a summary and writes an HTML report to `backend/coverage-all/index.html`.
The first time you run the Playwright tests on a machine, install the browser with `npx playwright install chromium` (in `servicehub`).

All of these also run automatically on GitHub for every push and pull request
(`.github/workflows/ci.yml`), so a change that breaks a test shows up as a red
cross on the pull request before it is merged.
