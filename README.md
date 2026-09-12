# Sophionix V3

Self-guided contemplation journal web app for emotional healing via visual oracle cards, journaling, and guided journeys.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Actions, React 19)
- **Language:** TypeScript (strict + exactOptionalPropertyTypes)
- **Database:** MySQL 8+ via Prisma ORM (MariaDB adapter)
- **Auth:** Auth.js v5 (email/password, Google OAuth, Apple ID, WebAuthn)
- **Payments:** Stripe (subscriptions + per-card $0.99 unlocks)
- **Storage:** Firebase Storage (voice notes, avatars)
- **Styling:** Tailwind CSS v4 (dark-only theme, token-based)
- **Package Manager:** Yarn Berry (PnP)

## Prerequisites

- Node.js 20+
- MySQL 8+
- Stripe CLI (for webhook testing)
- Yarn (`corepack enable`)

## Quick Start

```bash
git clone <repo-url> && cd sophionix
yarn install
cp .env.example .env          # fill in your values
yarn prisma:generate           # generate Prisma client
```

> **Important:** Prisma CLI and seed script do NOT auto-load `.env`.
> Always prefix commands with env loading (see below).

### Load .env for Prisma commands

```bash
# Option A: export vars into shell (recommended for session)
export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)

# Then run normally:
npx prisma migrate deploy
yarn prisma:seed
npx prisma studio
```

```bash
# Option B: one-liner per command
node --env-file=.env node_modules/.bin/prisma migrate deploy
```

### Full setup sequence

```bash
# 1. Install
yarn install

# 2. Generate Prisma client
yarn prisma:generate

# 3. Load env + apply migrations + seed
export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)
npx prisma migrate deploy
yarn prisma:seed

# 4. Run
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Required for local dev:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Real MySQL connection string (`******host:3306/db`); blank or placeholder values are invalid |
| `AUTH_SECRET` | Session signing key (`openssl rand -base64 32`) |
| `STRIPE_SECRET_KEY` | Stripe test secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI webhook secret |
| `GUEST_SESSION_SECRET` | Guest cookie HMAC key (`openssl rand -base64 32`) |
| `CRON_SECRET` | Cron endpoint auth token |
| `TOTP_SECRET_KEY` | Admin 2FA encryption key (`openssl rand -base64 32`) |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA v3 server key |
| `SEED_SUPER_ADMIN_EMAIL` | Admin user email for seed |
| `SEED_SUPER_ADMIN_PASSWORD` | Admin user password for seed |

Optional (features degrade gracefully without these):

| Variable | Feature |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Voice notes, push notifications |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Email delivery |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `AUTH_APPLE_*` | Apple Sign-In |

## Scripts

| Command | Description |
|---|---|
| `yarn dev` | Start dev server |
| `yarn build` | Production build |
| `yarn start` | Start production server |
| `yarn typecheck` | Run `tsc --noEmit` |
| `yarn lint` | ESLint |
| `yarn prisma:generate` | Regenerate Prisma client |
| `yarn prisma:migrate` | Create new migration (dev) |
| `yarn prisma:studio` | Open Prisma Studio GUI |
| `yarn prisma:seed` | Seed database (requires env loaded) |

## Deployment Guide

### Fresh machine setup

```bash
# 1. Clone + install
git clone <repo-url> && cd sophionix
corepack enable
yarn install

# 2. Environment
cp .env.example .env
# Fill all required vars (see table above)
# Generate secrets:
#   openssl rand -base64 32    (for AUTH_SECRET, GUEST_SESSION_SECRET, TOTP_SECRET_KEY, CRON_SECRET)

# 3. Database
# Ensure MySQL 8+ is running and the database exists:
#   mysql -u root -e "CREATE DATABASE sophionix;"
#   mysql -u root -e "CREATE USER 'sophionix'@'localhost' IDENTIFIED BY 'your_password';"
#   mysql -u root -e "GRANT ALL ON sophionix.* TO 'sophionix'@'localhost';"

# 4. Generate client + migrate + seed
yarn prisma:generate
export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)
npx prisma migrate deploy
yarn prisma:seed

# 5. Stripe (local webhook testing)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the webhook signing secret to STRIPE_WEBHOOK_SECRET in .env

# 6. Build + run
yarn build
yarn start
```

### Docker

```bash
# Production
docker compose up -d --build
```

| Service | What it does |
|---|---|
| `db` | MariaDB 11 with persistent volume |
| `redis` | Cache / sessions / job queue with AOF persistence |
| `app` | Next.js standalone — waits for DB, runs `prisma migrate deploy` + `prisma db seed`, then starts |
| `nginx` | Reverse proxy, gzip, static asset caching |
| `worker` | Background job processor (`--profile worker` to enable) |

```bash
# Development (hot reload, bind mounts, skips migrate/seed on restart)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Worker (placeholder — enable when implemented)
docker compose --profile worker up -d --build

# View logs
docker compose logs -f app
```

After first deploy, set `SKIP_MIGRATE=true` and `SKIP_SEED=true` in `.env` to skip on restarts.

### Production checklist

- [ ] All required env vars set (no `CHANGE_ME` placeholders)
- [ ] `NODE_ENV=production`
- [ ] `AUTH_TRUST_HOST=true` if behind a reverse proxy
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Stripe keys switched from `sk_test_` to `sk_live_`
- [ ] `STRIPE_CHECKOUT_SUCCESS_URL` / `STRIPE_CHECKOUT_CANCEL_URL` use production domain
- [ ] Database migrations applied (`npx prisma migrate deploy`)
- [ ] Seed run at least once for Stripe product sync
- [ ] Stripe webhook endpoint configured in Stripe Dashboard pointing to `/api/webhooks/stripe`
- [ ] SMTP credentials configured (or emails will be logged only)
- [ ] Firebase service account JSON set (or voice notes / push disabled)

## Project Structure

```
src/
  app/
    (auth)/            # login, signup, forgot-password, verify-email
    (marketing)/       # welcome, guest flow, guest card preview
    (user)/            # dashboard, journal, cards, journeys, settings, billing
    api/               # route handlers (auth, guest, webhooks, cron)
  components/
    brand/             # LavaBackground, Logo, BrandGradient
    features/          # auth forms, onboarding, admin panels
    layout/            # AppShell, Sidebar, PageHeader, AdminShell
    ui/                # primitives (Button, Modal, Tabs, etc.)
  lib/
    auth/              # Auth.js config, guards, session helpers
    dto/               # data transfer objects (card, journal, journey)
    ui/                # cn(), icons, variants, constants
    validation/        # Zod schemas for all boundaries
  server/
    actions/           # server actions (content, journal, billing, profile)
    actions/admin/     # admin-only actions (users, decks, campaigns)
prisma/
  schema.prisma        # data model
  migrations/          # SQL migrations
  seed.ts              # seed script
```

## Core Features

- **Card Library** -- browse decks, draw random cards (flip animation), save favorites, free vs premium
- **Guided Journeys** -- multi-day series with daily card/prompt/quote, enrollment, day-by-day progress
- **Journal** -- rich-text entries, voice notes, tags, calendar view, search, PDF/CSV export
- **Guest Flow** -- blurred card previews, $0.99 per-card unlock via Stripe, unlocks transfer on signup
- **Dashboard** -- daily card draw, journal summary, mood check-in
- **Admin Panel** -- user management, content CRUD, billing, campaigns, audit logs, 2FA required

## Auth & Security

- Database sessions via Auth.js v5 + Prisma adapter
- Admin 2FA required (TOTP with encrypted secrets)
- WebAuthn / Face ID support (optional)
- Rate limiting on all sensitive endpoints (in-memory store)
- Zod validation at every boundary
- HMAC-signed guest session cookies

## Stripe

```bash
# Local webhook testing
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Products and prices are synced during `prisma:seed` (find-or-create).

## Design System

- Dark-only theme, tokens in `src/app/globals.css` `@theme` block
- No `tailwind.config.*` -- Tailwind v4 CSS-first config
- Semantic tokens (`bg-primary`, `text-muted-foreground`) over raw hex
- Icons: import only from `@/lib/ui/icons`
- Reference: `.claude/DESIGN-SYSTEM.md`

## Known Limitations (MVP)

- In-memory rate-limit store resets on deploy (acceptable for low traffic)
- Firebase credentials needed for voice notes and push notifications
- SMTP credentials needed for email delivery
- No automated test suite -- correctness enforced by TypeScript strict + Zod
