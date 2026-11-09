# Handover status

Where the project stands against the client's two reviews (code review and
handover documentation review, both of `main` on 2026-10-29).

## Code review checklist

| Item | Status | Where |
|---|---|---|
| Public booking endpoints removed or guarded | ✅ | `GET /bookings/all` removed; `PATCH /bookings/:id/status` is admin-only. Tested in `backend/test/bookings.e2e-spec.ts`. |
| `.env` files out of git; secrets checked at startup | ✅ | `backend/src/config/check-secrets.ts`. Past versions of `.env` only ever held placeholders. |
| Global rate limit, stricter limits on auth, phone-code attempt cap | ✅ | `backend/src/app.module.ts`, `@AuthThrottle()`, 5 attempts per code |
| `crypto.randomInt` codes, no code logging in production | ✅ | `backend/src/modules/auth/auth.service.ts` |
| Ownership check on payments-by-booking; proper 403s | ✅ | `payments.controller.ts`, `bookings.controller.ts` |
| Helmet; Swagger off in production | ✅ | `backend/src/main.ts` |
| CI running the tests | ✅ | `.github/workflows/ci.yml` |

## Documentation review checklist

| Item | Status | Where |
|---|---|---|
| Root README retitled; Vue template README replaced | ✅ | `README.md`, `servicehub/README.md` |
| What the root `package.json` is for | ✅ | `README.md` (it isn't an app; only editor lint packages) |
| Deployment guide (host, env, TLS, migrations, first admin) | ✅ | [DEPLOYMENT.md](DEPLOYMENT.md), sections 1–9 |
| Backup and restore | ✅ | [DEPLOYMENT.md](DEPLOYMENT.md), section 10 |
| Which seeds are safe for production | ✅ | Accounts moved out of seeds 001/002 into `005_demo_accounts_seed.sql`. `npm run db:setup -- --production` skips every `demo`/`test` seed. |
| Production admin procedure; seeded admin never used live | ✅ | `npm run admin:create` / `admin:reset-password` / `admin:deactivate`; `npm run db:disable-demo-accounts` for an old dev database. The README marks the seeded logins as local-only. |
| Shared ngrok database section | ✅ removed from the README | The data itself: see the questions below |
| `.env` removed from git | ✅ | |
| User manual for customers, providers and admins | ❌ **Still to write** | Needs the outgoing team's walkthrough of each role |
| Docker / compose | Not provided | Optional; the guide deploys directly on a server |

## Questions only the outgoing team can answer

1. **The shared database.** The old README described a "live" `service_marketplace`
   database on a team member's machine, shared over ngrok with credentials in
   the group chat. Whose machine is it on? Does it hold real users' data? Please
   confirm in writing that it has been deleted, or say what should be migrated,
   and change any passwords that were shared in the chat.
2. **Hosting.** Where should production run (e.g. the shared VPS), and who owns
   the domain?
3. **SMS provider.** Customer sign-up in the app needs a 6-digit SMS code, but no
   SMS provider is connected, so customers can't sign up in production. Which
   provider should be used, and who holds the account? (See
   [DEPLOYMENT.md, section 13](DEPLOYMENT.md#13-known-limitations-at-launch).)
4. **AI accounts.** Who owns the OpenAI (chatbot, voice search) and Anthropic
   ("Screen with AI") accounts, what is the expected monthly cost, and are they
   needed at launch? Both features are optional.
5. **Email.** Which SMTP provider and sender address should production use?
6. **Payments.** Is launch cash-only? The payments module only records payments;
   no gateway is integrated.
