# ServiceHub frontend

The Vue 3 + Vite web app for ServiceHub: the customer site, the provider
dashboard and the admin dashboard, all in one single-page app. It talks to the
NestJS API in [`../backend`](../backend/).

For the full local setup (database, backend and this app), see the
[root README](../README.md). For production, see
[docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## Run it

```bash
npm install
cp .env.example .env      # Windows (cmd): copy .env.example .env
npm run dev               # http://localhost:5173
```

The backend must be running for sign-in, bookings and the admin pages.

## Settings (`.env`)

| Variable | Meaning |
|---|---|
| `VITE_API_URL` | The API's address, including `/api`. Locally `http://localhost:3001/api`. |
| `VITE_GOOGLE_CLIENT_ID` | Optional. Google OAuth web client ID for "Continue with Google". Must match `GOOGLE_CLIENT_ID` in the backend. |

These values are baked in when the app is built. After changing them, restart
`npm run dev` or run `npm run build` again.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` (plain static files) |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run test:run` | Unit and component tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright). Starts the dev server itself. Run `npx playwright install chromium` once first. |

## Where things are

| Path | Contents |
|---|---|
| `src/App.vue` | Page switching (`#/page` links), sign-in state, and the customer flows |
| `src/components/User/` | Customer-facing pages: home, service catalog, booking, tracking, reviews, sign-in and sign-up |
| `src/components/Provider/` | Provider dashboard |
| `src/components/Admin/` | Admin dashboard: bookings, users, provider verification, moderation |
| `src/components/AI/` | Chatbot and voice search |
| `src/services/api.js` | Every call to the backend API, with token refresh |
| `src/services/googleIdentity.js` | Google sign-in button |
| `src/data/` | Static fallback data for the service catalog, and price formatting |
| `src/_tests_/` | Vitest unit and component tests |
| `tests/` | Playwright browser tests |
