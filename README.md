
# ServiceHub Frontend

---

## Tech Stack

- Vue 3 (Composition API)
- Vite (build tool)
- JavaScript (ES6+)
- CSS (custom styling)
- Node.js & npm

---
---

## How to Run the Frontend

### 1. Install Node.js

Make sure Node.js is installed:

```bash
node -v
npm -v 
```
### 2. cd servicehub
### 3. npm install
### 4. npm run dev

Run Vite URL into your web browser

---


# Local Setup From Scratch (Database + Backend + Frontend)

These steps build a complete, working copy of ServiceHub on your own computer:
a new MySQL database (schema + seed data), the NestJS backend and the Vue frontend.
Nothing depends on the team's shared database or on ngrok.

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
needed for email features, and `OPENAI_API_KEY` only for the AI chatbot.

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
| 2 | `backend/database/seeds/001_seed_data.sql` | Default admin account + general service categories |
| 3 | `backend/database/seeds/002_rajshahi_services_seed.sql` | Rajshahi service catalog + a demo provider with prices |

Expected output:

```
Running database/migrations/000_initial_schema.sql
Running database/seeds/001_seed_data.sql
Running database/seeds/002_rajshahi_services_seed.sql

Done. Database `servicehub` has 10 tables.
```

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
mysql -u root -p servicehub < database/seeds/001_seed_data.sql
mysql -u root -p servicehub < database/seeds/002_rajshahi_services_seed.sql
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
   2. `backend/database/seeds/001_seed_data.sql`
   3. `backend/database/seeds/002_rajshahi_services_seed.sql`

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

| Role | Email | Password |
|---|---|---|
| Admin | `admin@servicehub.com` | `Admin@123` |
| Provider (demo) | `demo.provider@servicehub.local` | `Provider@123` |

Customers can be created through the app's sign-up page
(or `POST /api/auth/register/customer` in Swagger).

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

---

# Connecting to the Team's Shared Database (optional)

Only needed if you want to use the host's live database instead of a local one.

1. Open DBeaver
2. Click **New Database Connection** (plug icon in top left)
3. Select **MySQL** → click **Next**
4. Fill in the fields:

| Field | Value |
|---|---|
| Host | provided by host |
| Port | provided by host |
| Database | `service_marketplace` |
| Username | database username (sent by the host) |
| Password | database password (sent by the host) |

5. Click **Test Connection** — if it says OK, click **Finish**

### Every Time the Host Restarts Ngrok

The host and port change on every restart. To update your connection:

1. Right click your existing connection in DBeaver
2. Click **Edit Connection**
3. Update **Host** and **Port** with the new values from the group chat
4. Click **Finish**

---
