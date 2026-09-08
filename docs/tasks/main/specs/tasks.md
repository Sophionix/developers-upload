# Tasks — Sophionix V3 Backend
*Generated 2026-04-16*

## Objective
Deliver the complete full-stack Next.js 16 backend (APIs, Prisma schema on MySQL, Auth.js v5, Stripe, Firebase Storage + FCM, Nodemailer, BullMQ workers) for the Sophionix Contemplation Journal — user web app, guest flow, and super admin panel — per `docs/tasks/main/specs/plan.md`.

## Scope
**In Scope**
- Prisma schema + migrations + seed
- Auth.js v5 (credentials, Google, Apple, WebAuthn, admin TOTP 2FA)
- All user + guest + admin API endpoints and server actions
- Stripe subscriptions + $0.99 card unlocks + coupons + webhooks
- Firebase Storage signed uploads; FCM web push
- Nodemailer email pipeline + templates
- BullMQ sidecar worker (email, push, export, scheduler, rollup, purge)
- Redis cache, rate-limit, tag invalidation
- RBAC middleware, CSRF, CAPTCHA, audit log, GDPR export/delete
- PWA service worker scaffolding + FCM SW

**Out of Scope**
- UI/UX design and frontend screens (separate workstream)
- Native mobile, in-app messaging, AI-generated content
- ClickHouse/warehouse migration, A/B framework
- Voice-note transcription

## Requirements Traced
| ID | Description | Source | Tasks |
|----|-------------|--------|-------|
| REQ-001 | Email/password + Google + Apple sign-up/login, email verification, password recovery | TRD §Users — Auth | 2.1, 2.2 |
| REQ-002 | Optional WebAuthn/Face ID login | TRD §Users — Face ID | 2.3 |
| REQ-003 | Onboarding flag + preferences (theme, tone, reminders) | TRD §Users — Onboarding | 3.1 |
| REQ-004 | Guest session, blurred card preview, $0.99 card unlock | TRD §Guest Login | 2.4, 7.3 |
| REQ-005 | Daily card draw (scheduled or random) with mood check-in | TRD §Home Dashboard | 4.2, 6.1 |
| REQ-006 | Journal CRUD (rich text, tags, voice notes, auto-save, versions) | TRD §Journal | 5.1–5.4 |
| REQ-007 | Journal calendar/timeline/search with filters | TRD §Journal — Past Entries | 5.5 |
| REQ-008 | Card Library (decks, free/premium, random, flip, filter) | TRD §Card Library | 4.1 |
| REQ-009 | Profile mgmt, avatar upload, email/password update | TRD §Profile & Settings | 3.2 |
| REQ-010 | Notification prefs + FCM push + email + export (PDF/CSV) | TRD §Notifications, §Profile Export | 3.1, 8.1, 10.3 |
| REQ-011 | Admin auth with 2FA + RBAC (super admin / content manager) | TRD §Admin Auth | 2.5, 9.1 |
| REQ-012 | Admin dashboards (users, subs, activity, mood, retention, DAU/WAU/MAU) | TRD §Admin Dashboard, §Analytics | 9.2, 10.1 |
| REQ-013 | Admin user mgmt (list, filter, soft/hard delete, premium grants, trial extension) | TRD §User Management | 9.3 |
| REQ-014 | Admin content mgmt (cards, decks, prompts, journeys, daily scheduler) | TRD §Content Management, §Guided Journeys | 9.4 |
| REQ-015 | Admin notifications (push segmentation, email campaigns, templates) | TRD §Notifications | 8.2 |
| REQ-016 | Admin billing (plans CRUD, coupons, Stripe/RevenueCat webhooks, refunds) | TRD §Subscription & Payments | 7.1, 7.2, 9.5 |
| REQ-017 | Admin system settings (branding, defaults, audit, flags) | TRD §System Settings | 9.6 |
| REQ-018 | Analytics exports (CSV/PDF) + scheduled email | TRD §Analytics — Export | 10.3 |
| REQ-019 | Non-functional: encryption, GDPR, RBAC, audit, <2s, WCAG, 99.9%, CI/CD | TRD §Non-Functional | 0.x, 11.x, 12.x |
| REQ-020 | PWA support (installable, offline shell, push) | CLAUDE.md | 12.1 |

---

## Architecture Context

### Where This Fits
- Greenfield Next.js 16.2.3 App Router monolith at repo root. User, admin, auth, and marketing surfaces coexist in one `app/` tree with route groups.
- Sidecar Node worker (`src/workers/`) shares the Prisma schema and Redis instance with the Next.js app.
- External integrations isolated behind adapters in `src/lib/{stripe,firebase-admin,mailer,push,storage}.ts` so callers never import vendor SDKs directly.

### Technical Approach
- **One schema, two surfaces** — same Prisma models feed user and admin; DTO mappers in `src/lib/dto/` prevent leaking server-only fields.
- **Server Actions for in-app mutations; Route Handlers for webhooks, cron, Auth.js, and upload-URL issuance.** This matches Next.js 16 conventions and keeps CSRF handling centralized.
- **Zod at every boundary.** Schemas colocated in `src/lib/validation/<domain>.ts` and reused on the client.
- **Cache twin pattern.** Reads wrapped in `cache.withTag(tag, loader)` which coordinates Redis and `revalidateTag`; writes call a single `invalidate(tag)` helper.
- **Cursor pagination everywhere user-facing; keyset for admin tables.** Shared helpers in `src/lib/pagination.ts`.

### Key Decisions
- **cuid() IDs, cents for money, UTC timestamps, `utf8mb4`.** See `plan.md §5.10`.
- **Admin 2FA required on MVP** (user clarification) — enforced by Auth.js callback and admin middleware.
- **PricingPlan is source of truth, mirrored to Stripe** via a sync job; enables admin CRUD and local joins.
- **Guest unlocks claimable on signup** — `GuestSession.claimedByUserId` + atomic migration in signup action.
- **MySQL rollup tables** (`DailyPlatformStat`, `RetentionCohort`, `CardUsageStat`) populated nightly; admin analytics reads only from rollups.
- **Firebase Storage signed URLs from server**, with post-upload metadata re-validation to close the MIME-spoofing gap.

---

## Tasks

### Phase 0: Foundation

#### [0.1] Dependency & tooling setup
- [x] **0.1.1** Install runtime deps per plan §9 Phase 0
  - **Produces**: updated `package.json` with prisma, `@auth/prisma-adapter`, `next-auth@beta`, bcrypt, zod, ioredis, bullmq, stripe, firebase-admin, nodemailer, pino, otplib, `@simplewebauthn/server`, `@react-pdf/renderer`, zxcvbn, `@upstash/ratelimit` (optional)
  - **Consumed by**: every later task
  - **Replaces**: N/A (greenfield)
  - [x] Yarn install succeeds under current PnP config
  - [x] `prisma -v` and `stripe --version` resolve via `yarn exec`
- [x] **0.1.2** Add TypeScript strict options, path aliases (`@/lib/*`, `@/server/*`), and ESLint rules for server-only imports
  - **Produces**: `tsconfig.json` paths + `eslint.config.mjs` rules
  - **Consumed by**: every module
  - [x] `tsc --noEmit` passes on empty project
  - [x] ESLint blocks `firebase-admin` imports outside `src/lib` and `src/workers`
- [x] **0.1.3** Scaffold `src/` directory tree per plan §4.2
  - **Produces**: empty directories for `app/(auth|user|admin|marketing)`, `lib/*`, `server/actions`, `workers`, `emails`, `types`
  - **Consumed by**: every later task
  - [x] `README` or comment in each dir states its purpose

#### [0.2] Environment & secrets
- [x] **0.2.1** Wire `src/lib/env.ts` Zod-validated env loader (fails fast on missing keys)
  - **Produces**: `env` typed object
  - **Consumed by**: every lib module (db, auth, stripe, firebase, mailer)
  - [x] Missing required key throws at boot, not at first use
  - [x] Public vars namespaced with `NEXT_PUBLIC_` are passed through unchanged
- [x] **0.2.2** Document rotation + Secrets Manager mapping for prod
  - **Produces**: `docs/ops/secrets.md` (internal)
  - [x] Every `CHANGE_ME_*` key in `.env` listed with its Secrets Manager path

#### [0.3] Core singletons
- [x] **0.3.1** Implement Prisma client singleton `src/lib/db.ts` with dev hot-reload guard
  - **Produces**: `prisma` export
  - **Consumed by**: all server actions, route handlers, workers
  - [x] No duplicate clients in dev; single instance in prod
  - [x] Logs slow queries (>100ms) via pino
- [x] **0.3.2** Implement Redis client `src/lib/redis.ts` (cache + bullmq connections)
  - **Produces**: `redis`, `bullConnection`
  - **Consumed by**: cache, rate-limit, queues
  - [x] Separate connection for BullMQ per its requirements
  - [x] Reconnect + retry policies configured
- [x] **0.3.3** Implement pino logger `src/lib/logger.ts` with request-id propagation helper
  - **Produces**: `logger`, `withRequestId()`
  - **Consumed by**: middleware, route handlers, workers
  - [x] Redaction list includes password, token, cookie headers
- [x] **0.3.4** Implement cache helper `src/lib/cache.ts` with tag registry
  - **Produces**: `withCache(key, tag, ttl, loader)`, `invalidateTag(tag)`
  - **Consumed by**: read actions, admin write actions
  - [x] Invalidate also calls `revalidateTag()` so RSC cache stays in sync
  - [x] Tag→keys mapping maintained atomically via Redis set
- [x] **0.3.5** Implement pagination helpers `src/lib/pagination.ts`
  - **Produces**: `paginateCursor()`, `paginateKeyset()`
  - **Consumed by**: every list endpoint user + admin
  - [x] Cursor helper encodes/decodes `(createdAt,id)` safely (base64)
  - [x] Keyset helper returns `{rows, nextCursor, prevCursor}`
- [x] **0.3.6** Implement rate-limit helper `src/lib/rate-limit.ts` (Redis sliding window)
  - **Produces**: `rateLimit(key, limit, windowSec)`
  - **Consumed by**: middleware, sensitive route handlers, server actions
  - [x] Returns remaining + resetAt for header surfacing
  - [x] Namespaced keys: `rl:{bucket}:{identifier}`

#### [0.4] CI & migrations bootstrap
- [x] **0.4.1** Configure `scripts/` and CI jobs: typecheck, lint, `prisma validate`, `prisma migrate diff` (tests optional — add only when they guard real risk)
  - **Produces**: GitHub Actions workflow + yarn scripts
  - [x] PR check fails if schema drift vs `main`
  - [x] Test job spins up MySQL 8 + Redis via services

---

### Phase 1: Schema & Migrations

#### [1.1] Prisma schema authoring
- [x] **1.1.1** Author `prisma/schema.prisma` per plan §5.1–5.9 (all enums + models)
  - **Produces**: committed schema file
  - **Consumed by**: every data-touching task
  - [x] `prisma validate` passes
  - [x] All FKs declare `onDelete`; cuid defaults on every id; `@db.*` annotations present
- [x] **1.1.2** Enable MySQL `fullTextIndex` preview feature and add `@@fulltext([bodyPlain])` on `JournalEntry`
  - **Produces**: preview feature entry in generator block
  - **Consumed by**: journal search action (5.5)
  - [x] Migration emits `ALTER TABLE ... ADD FULLTEXT` statement
- [x] **1.1.3** Generate initial migration + apply against local MySQL
  - **Produces**: `prisma/migrations/00000000_init/`
  - [x] `prisma migrate deploy` idempotent on fresh DB
  - [x] No destructive warnings in baseline diff

#### [1.2] Seed data
- [x] **1.2.1** Author `prisma/seed.ts` with reference data
  - **Produces**: seeded decks (Mindfulness, Confidence, Relationships), themes, categories, a few free + premium cards, 1 journey, baseline `SystemSetting` rows (guest_login_enabled, card_unlock_price_cents)
  - **Consumed by**: local dev + e2e tests
  - [x] `yarn prisma db seed` is idempotent
  - [x] Seeds a super admin only if `SEED_SUPER_ADMIN_EMAIL` env set
- [x] **1.2.2** Add one default `PricingPlan` row and a matching `NotificationTemplate` set (welcome, verify, reset, weekly newsletter)
  - **Produces**: plan + template rows
  - **Consumed by**: billing (Phase 7) + email (Phase 8)
  - [x] Templates reference variable keys declared in `variables` JSON

---

### Phase 2: Auth, RBAC, Guest

#### [2.1] Auth.js v5 core
- [x] **2.1.1** Configure Auth.js with Prisma adapter, database sessions, JWT fallback disabled
  - **Produces**: `src/lib/auth/index.ts` exporting `auth`, `signIn`, `signOut`
  - **Consumed by**: middleware, server actions, route handlers
  - [x] Session cookie is HTTP-only, Secure (prod), `SameSite=Lax`
  - [x] Callbacks populate `session.user.role` and `session.user.status`
- [x] **2.1.2** Implement Credentials provider (bcrypt) with email-verification gate
  - **Produces**: credentials provider config
  - **Consumed by**: login page form
  - [x] Unverified emails rejected with typed error code
  - [x] `LoginAttempt` rows written on success and failure
- [x] **2.1.3** Add Google + Apple OAuth providers
  - **Produces**: provider configs sourced from env
  - **Consumed by**: login page social buttons
  - [x] First Apple sign-in persists email; subsequent logins don't overwrite
  - [x] OAuth linking rejects if another verified account owns that email

#### [2.2] Email-based account flows
- [x] **2.2.1** Implement `POST /api/auth/signup` route handler
  - **Produces**: new `User` + `EmailVerificationToken` + welcome/verify email enqueued
  - **Consumed by**: signup page
  - **Replaces**: N/A
  - [x] Zod validates name/email/password/consent; zxcvbn ≥ 3 required
  - [x] Transaction creates `User`, `UserPreference`, `NotificationPreference`, `Subscription(FREE)` atomically
  - [x] Duplicate email returns generic success (no user enumeration)
- [x] **2.2.2** Implement verify-email, forgot-password, reset-password handlers
  - **Produces**: token consumption + password update
  - **Consumed by**: corresponding pages
  - [x] All tokens stored as SHA-256 hashes; single-use; time-limited
  - [x] Password reset rate-limited per email and per IP

#### [2.3] WebAuthn
- [x] **2.3.1** Implement WebAuthn register/login endpoints using `@simplewebauthn/server`
  - **Produces**: `Authenticator` rows; session login on verify
  - **Consumed by**: profile security section + login page "Use Face ID" button
  - [x] Challenges stored in Redis with 5-min TTL
  - [x] Counter increment enforced to detect cloned authenticators
- [x] **2.3.2** Feature-flag gate (`FEATURE_WEBAUTHN`) + graceful fallback
  - **Produces**: runtime check in handlers + UI hint
  - **Consumed by**: login page
  - [x] When disabled, endpoints return 404

#### [2.4] Guest sessions
- [x] **2.4.1** Implement `POST /api/guest/session` to mint signed guest cookie + `GuestSession` row
  - **Produces**: HMAC-signed cookie, `GuestSession.cookieHash`
  - **Consumed by**: `/api/guest/cards/*` and Stripe unlock flow (7.3)
  - [x] Cookie HTTP-only + Secure + 30-day rolling; HMAC verified server-side
  - [x] Same cookie reused across visits if unexpired
- [x] **2.4.2** Implement guest card browse + blurred preview endpoints
  - **Produces**: `GET /api/guest/cards`, `GET /api/guest/cards/:id/preview`
  - **Consumed by**: guest home + card detail UI
  - [x] Only cards with `guestPreview=true` and `isActive=true` returned
  - [x] Preview response omits full `message`/`prompt`; includes blurred image URL
- [x] **2.4.3** Implement `claimGuestUnlocks` server action called during signup
  - **Wires**: guest cookie → new `User.id`; migrates `CardUnlock` + `Payment` rows
  - **Removes**: guest-only pointer on those rows (`guestSessionId → null`, `userId ← new`)
  - [x] Transactional; handles zero unlocks as no-op
  - [x] Only claims when guest `email` matches signup email OR cookie is presented

#### [2.5] Admin 2FA + RBAC middleware
- [x] **2.5.1** Implement TOTP setup/verify/disable endpoints with AES-GCM-encrypted secrets
  - **Produces**: `User.totpSecretEnc`, `User.totpEnabled=true`
  - **Consumed by**: admin login step-up
  - [x] Secret encrypted with `TOTP_SECRET_KEY`; decrypted only in verify path
  - [x] Backup: email OTP via `AdminTotpChallenge` on device loss
- [x] **2.5.2** Gate admin login with 2FA step after password/OAuth success
  - **Wires**: successful first-factor → `requires2FA=true` session state → `/admin/2fa` page
  - **Removes**: direct admin dashboard access without 2FA
  - [x] Session marked `mfaAt` timestamp; middleware rejects admin routes without it
  - [x] First admin login forces TOTP enrollment
- [x] **2.5.3** Implement RBAC matrix + `requireRole` guard in `src/lib/rbac.ts`
  - **Produces**: permission table + guard function
  - **Consumed by**: every admin server action + `/admin/*` middleware
  - [x] Content Manager cannot mutate `User`, `Subscription`, `AdminAuditLog`
  - [x] Super Admin has full access; role mismatch returns typed 403
- [x] **2.5.4** Wire `src/middleware.ts` with RBAC matcher, rate-limit hook, maintenance flag, `session_blocklist` Redis check
  - **Produces**: middleware covering `/admin/:path*`, `/api/admin/:path*`, sensitive auth routes
  - **Consumed by**: every incoming request
  - [x] Node runtime mode set (Prisma/Firebase need it)
  - [x] Revoked sessions rejected within one request of logout

#### [2.6] Audit logger
- [x] **2.6.1** Implement `src/lib/audit.ts` with `logAdminAction(actor, action, entity, entityId, meta, ip)`
  - **Produces**: `AdminAuditLog` rows
  - **Consumed by**: all admin mutating actions (Phase 9)
  - [x] Destructive actions persist before response; non-destructive may enqueue
  - [x] PII redacted from `meta` via scrubber

---

### Phase 3: Preferences, Profile, Storage

#### [3.1] Preferences + notification settings + FCM tokens
- [x] **3.1.1** Implement `completeOnboarding`, `updatePreferences`, `updateNotificationPrefs` server actions
  - **Produces**: upserts on `UserPreference`, `NotificationPreference`; sets `hasCompletedOnboarding`
  - **Consumed by**: onboarding + settings pages
  - [x] Zod bounds check on `dailyCardAtHour` (0–23), `scheduleCron` cron string
  - [x] Revalidate `settings` cache tag after write
- [x] **3.1.2** Implement `registerFcmToken`, `revokeFcmToken` server actions
  - **Produces**: `FcmToken` rows with deduped `(userId, token)`
  - **Consumed by**: push fan-out worker (8.1)
  - [x] Stale tokens pruned on FCM "not-registered" error
  - [x] `lastSeenAt` updated on every heartbeat

#### [3.2] Profile & avatar
- [x] **3.2.1** Implement `getProfile`, `updateProfile`, `setAvatar` actions
  - **Produces**: `User.avatarUrl`, `User.fullName` updates
  - **Consumed by**: profile page
  - [x] `email` change requires re-auth (new `VerificationToken`) before persisting
  - [x] Display name length + sanitation enforced
- [x] **3.2.2** Implement `POST /api/profile/avatar/upload-url` issuing Firebase signed URL
  - **Produces**: `{url, path, headers}` response
  - **Consumed by**: client uploader → `setAvatar(path)`
  - [x] Validates MIME allowlist + size limit server-side
  - [x] Signed URL TTL from `FIREBASE_UPLOAD_URL_TTL`
- [x] **3.2.3** Implement session management actions (`listActiveSessions`, `revokeSession`)
  - **Produces**: session list + revocation (adds to Redis blocklist)
  - **Consumed by**: profile → Security tab
  - [x] Current session flagged; revoking current signs user out

#### [3.3] GDPR surface (user-side)
- [x] **3.3.1** Implement `requestDataExport` action
  - **Produces**: `ExportRequest(scope=JOURNAL_FULL)` + enqueue export job
  - **Consumed by**: export worker (10.3)
  - [x] Rate-limited to 1 per 24h per user
- [x] **3.3.2** Implement `requestAccountDeletion` + `cancelAccountDeletion`
  - **Produces**: `DataDeletionRequest`, sets `User.status=PENDING_DELETION`
  - **Consumed by**: nightly purge worker (10.4)
  - [x] Grace window = `GDPR_DELETION_GRACE_DAYS`
  - [x] Cancel only allowed before `scheduledAt`

---

### Phase 4: Content Read Side (User)

#### [4.1] Decks, cards, saved cards
- [x] **4.1.1** Implement `listDecks`, `listCards(cursor, filters)`, `getCard(id)` actions
  - **Produces**: cached paginated lists; single card with entitlement check
  - **Consumed by**: home + card library pages
  - [x] Filters: deckId, themeId, tagId, mood, accessType; cursor on `(sortOrder,id)` then `(createdAt,id)`
  - [x] Premium card without entitlement returns 402-shaped error (no body leak)
  - [x] Cached under `cards` tag; invalidated by admin card CRUD
- [x] **4.1.2** Implement `drawRandomFromDeck`, `saveCard`, `unsaveCard`, `listSavedCards`
  - **Produces**: `SavedCard` upsert/delete; list of saves with cursor
  - **Consumed by**: library UI
  - [x] Random draw excludes cards drawn in last N hours (configurable)
  - [x] Saved list uses `SavedCard.createdAt` as cursor

#### [4.2] Daily card + mood + draws
- [x] **4.2.1** Implement `drawDailyCard` action honoring `ScheduledDailyCard` then falling back to random
  - **Produces**: `CardDraw(source=DAILY|SCHEDULED)`
  - **Consumed by**: home dashboard
  - [x] Cached per user-day (`cache:v1:daily:{userId}:{yyyy-mm-dd}`)
  - [x] Transaction writes `CardDraw` + updates `CardUsageStat` counter (increment)
- [x] **4.2.2** Implement `logMoodCheckIn`, `getMoodTrends(range)`
  - **Produces**: `MoodCheckIn` rows; aggregated series keyed by day
  - **Consumed by**: home + trends UI
  - [x] Trends query uses `[userId, createdAt]` index; returns `{date, moodDistribution}`
  - [x] Prevents duplicate check-in within a minute window
- [x] **4.2.3** Implement `drawRandomCard(filters?)` for ad-hoc draws
  - **Produces**: `CardDraw(source=RANDOM)`
  - **Consumed by**: card library random button
  - [x] Respects entitlement + active flag

#### [4.3] Guided Journeys
- [x] **4.3.1** Implement `listJourneys`, `getJourney`, `enrollInJourney`, `getEnrollmentProgress`, `advanceJourneyDay`
  - **Produces**: `JourneyEnrollment` rows + progress
  - **Consumed by**: journeys pages
  - [x] Premium gating via `Subscription` + `grantExpiresAt`
  - [x] `advanceJourneyDay` idempotent per day; sets `completedAt` when last day done

---

### Phase 5: Journal + Voice Notes

#### [5.1] Entry CRUD
- [x] **5.1.1** Implement `createJournalEntry`, `updateJournalEntry` with versioning
  - **Produces**: `JournalEntry` + `JournalEntryVersion` on body change
  - **Consumed by**: editor page
  - [x] HTML sanitized server-side (`isomorphic-dompurify` or equivalent); plain copy for FT index
  - [x] Tag upsert + link in same transaction
- [x] **5.1.2** Implement `autosaveJournalDraft` (upsert with `isDraft=true`) and `deleteJournalEntry` (soft)
  - **Produces**: draft row; `deletedAt` set
  - **Consumed by**: editor autosave; list filters out deleted
  - [x] Autosave debounced by rate limit; last-write-wins per entry
- [x] **5.1.3** Implement `getJournalEntry`, `listTagSuggestions`
  - **Produces**: entry DTO including tags + voice notes metadata
  - **Consumed by**: editor + tag picker
  - [x] Tag suggestions use `Tag.slug LIKE ?` with index; caps at 10

#### [5.2] Voice notes
- [x] **5.2.1** Implement `POST /api/journal/voice-notes/upload-url` (signed URL)
  - **Produces**: signed URL + storage path
  - **Consumed by**: client recorder
  - [x] MIME allowlist: `audio/mpeg`, `audio/ogg`; size ≤ `UPLOAD_MAX_VOICE_BYTES`
- [x] **5.2.2** Implement `attachVoiceNote` action with post-upload metadata re-validation
  - **Produces**: `VoiceNote` row linked to entry
  - **Consumed by**: editor + entry view
  - [x] Reads Firebase object metadata via Admin SDK; rejects if mime/size mismatch
  - [x] Enforces duration ≤ `UPLOAD_MAX_VOICE_DURATION_MS`
- [x] **5.2.3** Implement `deleteVoiceNote` with orphan object cleanup job enqueue
  - **Produces**: row delete + enqueue storage-cleanup job
  - **Consumed by**: editor delete button
  - [x] Storage object deleted by worker (retry-safe)

#### [5.3] Timeline, calendar, search, export
- [x] **5.3.1** Implement `listJournalEntries(cursor, filters)` using `[userId, deletedAt, createdAt]` index
  - **Produces**: paginated feed DTOs
  - **Consumed by**: timeline page
  - [x] Filters: tagIds, cardId, moods, dateRange; query composable
  - [x] No N+1: tags fetched in bounded second query
- [x] **5.3.2** Implement `getJournalCalendar(month)` returning per-day counts
  - **Produces**: `Map<yyyy-mm-dd, count>` for the month
  - **Consumed by**: calendar UI
  - [x] Query uses `DATE(createdAt)` group-by with index range scan
- [x] **5.3.3** Implement `searchJournal(q, cursor)` over MySQL fulltext
  - **Produces**: paginated ranked results
  - **Consumed by**: search bar
  - [x] Uses `MATCH(bodyPlain) AGAINST(?)`; falls back to LIKE for <3-char terms
- [x] **5.3.4** Implement `requestJournalExport(format, filters)`
  - **Produces**: `ExportRequest` + enqueued job
  - **Consumed by**: export worker (10.3)
  - [x] Filters validated + persisted; format ∈ {CSV, PDF}

---

### Phase 6: Mood Trend Rollup Signals

#### [6.1] Engagement signal writes
- [x] **6.1.1** Update `CardDraw` / `MoodCheckIn` / `JournalEntry` writes to increment `CardUsageStat` and queue `rollup` signals
  - **Produces**: real-time counters (Redis) that nightly rollup reads
  - **Consumed by**: rollup worker (10.1)
  - [x] Counters idempotent under retries (use Redis `INCR` with dedup key)
  - [x] Failure to increment never fails the primary write

---

### Phase 7: Billing

#### [7.1] Plans & coupons (admin-authored, Stripe-mirrored)
- [x] **7.1.1** Implement `adminListPlans`, `adminCreatePlan`, `adminUpdatePlan`, `adminDeletePlan`
  - **Produces**: `PricingPlan` rows + `stripe-sync` job enqueued
  - **Consumed by**: Stripe via sync worker
  - [x] Soft-delete via `isActive=false`; refuses if active subscribers
  - [x] Audit logged
- [x] **7.1.2** Implement plan sync worker that upserts Stripe Products & Prices
  - **Produces**: `PricingPlan.stripePriceId`, `stripeProductId`
  - **Consumed by**: checkout session creation
  - [x] Idempotent on retry; price immutability respected (new price on change)
- [x] **7.1.3** Implement `adminListCoupons` CRUD with Stripe Coupon sync
  - **Produces**: `Coupon.stripeCouponId`
  - **Consumed by**: checkout + validate
  - [x] Redemption limits enforced locally before Stripe call

#### [7.2] User-facing billing
- [x] **7.2.1** Implement `listPublicPlans`, `getCurrentSubscription`, `validateCoupon`
  - **Produces**: DTOs for plans page
  - **Consumed by**: upgrade UI
  - [x] Public filter hides INTERNAL + TEST_ONLY
- [x] **7.2.2** Implement `createCheckoutSession` and `createBillingPortalSession`
  - **Produces**: Stripe Checkout/Portal URLs
  - **Consumed by**: upgrade + manage-billing buttons
  - [x] Idempotency key per user+plan prevents duplicate subs
  - [x] Success/cancel URLs sourced from env

#### [7.3] Card unlocks ($0.99)
- [x] **7.3.1** Implement `POST /api/guest/cards/:id/unlock-intent` and `createCardUnlockCheckout`
  - **Produces**: Stripe PaymentIntent + pending `CardUnlock` row
  - **Consumed by**: guest + logged-in unlock UI
  - [x] Reuses price from `SystemSetting.card_unlock_price_cents`
  - [x] Unique `(userId, cardId)` or `(guestSessionId, cardId)` prevents duplicates
- [x] **7.3.2** On webhook success, mark `CardUnlock.status=SUCCEEDED`, set `unlockedAt`, and expose card content
  - **Wires**: `payment_intent.succeeded` → unlock row → `getCard(id)` now returns full details
  - **Replaces**: blurred preview for that specific card
  - [x] Transactional update; idempotent via `StripeWebhookEvent`

#### [7.4] Stripe webhooks
- [x] **7.4.1** Implement `POST /api/webhooks/stripe` with signature verification + idempotency
  - **Produces**: `StripeWebhookEvent` insert-or-skip; dispatched handler per event type
  - **Consumed by**: subscription + payment + unlock state
  - [x] Unknown event types logged + ignored (not errored)
  - [x] Handler table covers: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- [x] **7.4.2** Subscription lifecycle writes to `Subscription` atomic with `Payment`
  - **Produces**: `tier`, `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`
  - **Consumed by**: entitlement checks across cards + journeys
  - [x] Past-due after grace transitions tier to FREE; premium features gate off

#### [7.5] Admin billing ops
- [x] **7.5.1** Implement `adminGetBillingOverview`, `adminListPayments`, `adminRefundPayment`
  - **Produces**: Stripe Refund + audit log
  - **Consumed by**: admin billing page
  - [x] Refund reason enum persisted; audit captures actor + target
- [x] **7.5.2** Implement `adminGrantPremium`, `adminRevokePremium`, `adminExtendTrial`
  - **Produces**: `Subscription` rows mutated; audit trail
  - **Consumed by**: admin user profile actions
  - [x] Grants don't touch Stripe; `grantedByAdminId` + `grantExpiresAt` set
  - [x] Revocation clears grant fields and re-evaluates tier

---

### Phase 8: Notifications & Email

#### [8.1] Push + email adapters
- [x] **8.1.1** Implement `src/lib/push.ts` (FCM Admin) with batched send + dead-token pruning
  - **Produces**: `sendPush(userIds, template, data)`
  - **Consumed by**: notification worker + scheduler
  - [x] Chunks of 500 tokens; removes `not-registered` tokens transactionally
  - [x] Topic helper reserved for marketing (opt-in only)
- [x] **8.1.2** Implement `src/lib/mailer.ts` (Nodemailer) with pool transport + template renderer
  - **Produces**: `sendEmail(to, template, vars)`
  - **Consumed by**: email worker
  - [x] Supports SMTP and SES transports via env
  - [x] Templates rendered from `src/emails/*` (React Email or MJML)

#### [8.2] Campaigns (admin)
- [x] **8.2.1** Implement `adminListTemplates` + CRUD
  - **Produces**: `NotificationTemplate` rows with variable manifest
  - **Consumed by**: campaign composer
  - [x] Validates that template body references only declared variables
- [x] **8.2.2** Implement `adminCreateCampaign`, `adminScheduleCampaign`, `adminSendCampaignNow`, `adminPreviewCampaignAudience`, `adminGetCampaignStats`
  - **Produces**: `NotificationCampaign` + enqueued fan-out
  - **Consumed by**: push + email workers
  - [x] Segment evaluator handles mood, activity, subscription filters
  - [x] `DRAFT → SCHEDULED → SENT | FAILED` transitions enforced; failures retried

#### [8.3] In-app reminders
- [x] **8.3.1** Implement scheduled reminder fan-out from `NotificationPreference.scheduleCron`
  - **Produces**: cron-driven enqueue into push/email queues
  - **Consumed by**: workers
  - [x] Honors `channel` (PUSH/EMAIL/BOTH/NONE) and user timezone
  - [x] Suppresses reminders if user journaled in last 24h (optional flag)

---

### Phase 9: Admin APIs (beyond content/billing above)

#### [9.1] Admin dashboard
- [x] **9.1.1** Implement `adminGetOverview`, `adminGetSubscriptionSummary`, `adminGetActivityFeed`
  - **Produces**: DTOs derived from rollup tables + recent events
  - **Consumed by**: admin home
  - [x] Activity feed paginated by cursor; polls every 30s safely
  - [x] Overview cached 60s via `admin-overview` tag
- [x] **9.1.2** Implement analytics reads from rollup tables: `adminGetDauWauMau`, `adminGetRetentionCohorts`, `adminGetMoodTrends`, `adminGetCardUsage`, `adminGetChurnIndicators`
  - **Produces**: time-series DTOs
  - **Consumed by**: analytics charts
  - [x] All reads hit rollup tables, never raw events
  - [x] Range param validated (≤ 365d)

#### [9.2] Admin user management
- [x] **9.2.1** Implement `adminListUsers` (keyset pagination) with search, filters, sort
  - **Produces**: `{rows, nextCursor, prevCursor}`
  - **Consumed by**: admin users table
  - [x] Search uses email/name prefix index; sort on created/subscription/lastLogin
- [x] **9.2.2** Implement `adminGetUser`, `adminDeactivateUser`, `adminReactivateUser`, `adminResetUserPassword`, `adminSoftDeleteUser`, `adminHardDeleteUser`, `adminAssignRole`
  - **Produces**: mutations + audit log rows
  - **Consumed by**: admin user profile
  - [x] Hard delete gated to SUPER_ADMIN + requires confirmation token
  - [x] Deactivate flips `status`, blocks session via blocklist

#### [9.3] Admin content management
- [x] **9.3.1** Implement `adminListCards` + CRUD; `adminListDecks`, `adminListThemes`, `adminListCategories`, `adminListTags` + CRUD
  - **Produces**: content rows + `cards`/`decks` tag invalidations
  - **Consumed by**: content UI
  - [x] Deleting an active deck requires reassign flow
  - [x] Card `accessType` change invalidates entitlement caches
- [x] **9.3.2** Implement `adminListPrompts` CRUD with category + theme links
  - **Produces**: `JournalPrompt` rows with many-to-many links
  - **Consumed by**: prompt picker
  - [x] Prompt body must reference at least one category or theme
- [x] **9.3.3** Implement `adminListJourneys` CRUD and `JourneyDay` editing
  - **Produces**: Journey + ordered days
  - **Consumed by**: journey UI
  - [x] Day index uniqueness enforced; reorder updates in one transaction
- [x] **9.3.4** Implement `adminListScheduledDailyCards(month)`, `adminScheduleDailyCard`, `adminUnscheduleDailyCard`
  - **Produces**: `ScheduledDailyCard` rows + push notification enqueue on day-of
  - **Consumed by**: scheduler worker
  - [x] Cannot schedule past dates; future dates allow override until midnight
- [x] **9.3.5** Implement `POST /api/admin/content/upload-url` (signed URL for artwork)
  - **Produces**: signed URL
  - **Consumed by**: card/journey form uploader
  - [x] MIME allowlist: `image/png|jpeg|webp`; max size `UPLOAD_MAX_CARD_ART_BYTES`

#### [9.4] System settings, audit, flags, admin accounts
- [x] **9.4.1** Implement `adminGetSettings`, `adminUpdateSetting(key, value)`
  - **Produces**: `SystemSetting` rows + `settings` tag invalidation
  - **Consumed by**: branding + guest config + unlock price runtime
  - [x] Value JSON validated per-key via Zod registry
- [x] **9.4.2** Implement `adminListAuditLogs` with filters + keyset pagination
  - **Produces**: audit DTOs
  - **Consumed by**: audit UI
  - [x] Filters: actor, entity, action, date range
- [x] **9.4.3** Implement `adminListFeatureFlags`, `adminUpsertFeatureFlag`
  - **Produces**: `FeatureFlag` rows + broadcast to Redis for instant effect
  - **Consumed by**: all flag consumers
  - [x] Rollout percentage hashed by userId for stable bucketing
- [x] **9.4.4** Implement `adminListAdmins`, `adminCreateAdmin`
  - **Produces**: `User(role=SUPER_ADMIN|CONTENT_MANAGER)`
  - **Consumed by**: admin team UI
  - [x] Invite flow issues verification + forces 2FA enrollment on first login

---

### Phase 10: Workers, Rollups, Exports, Purge

#### [10.1] Worker runtime
- [x] **10.1.1** Author `src/workers/index.ts` bootstrap + queue registration
  - **Produces**: long-running Node process that registers all workers
  - **Consumed by**: ECS worker task
  - [x] Graceful shutdown on SIGTERM; drains in-flight jobs
  - [x] Concurrency sourced from env

#### [10.2] Nightly rollups
- [x] **10.2.1** Implement `rollup.worker.ts` producing `DailyUserStat`, `DailyPlatformStat`, `RetentionCohort`, `CardUsageStat`
  - **Produces**: rollup rows
  - **Consumed by**: admin analytics (9.1.2)
  - [x] Idempotent per date key; re-runs upsert
  - [x] Reads raw events only in bounded windows to avoid long scans

#### [10.3] Exports
- [x] **10.3.1** Implement `export.worker.ts` supporting CSV (stream) and PDF (`@react-pdf/renderer`)
  - **Produces**: signed URL on `ExportRequest.fileUrl`; `status=READY`
  - **Consumed by**: user + admin "download export" UIs
  - [x] TTL enforced via `expiresAt`
  - [x] Memory bounded: CSV streamed; PDF paginated
- [x] **10.3.2** Implement scheduled admin analytics exports via email
  - **Produces**: nightly job that generates + emails report
  - **Consumed by**: admins configured in `SystemSetting`
  - [x] Configurable schedule; fails gracefully with audit entry

#### [10.4] Purge + storage cleanup
- [x] **10.4.1** Implement `purge.worker.ts` processing due `DataDeletionRequest`s
  - **Produces**: hard-deleted user + cascaded personal data + Firebase objects
  - **Consumed by**: GDPR workflow
  - [x] Audit log entries anonymize `targetUserId` (preserve history)
  - [x] Rerun safe: re-queries due rows
- [x] **10.4.2** Implement `storage-cleanup` queue for orphaned avatars + voice notes
  - **Produces**: Firebase object deletions
  - **Consumed by**: voice note delete (5.2.3) + avatar replace
  - [x] Dead-letter queue after 5 failures

#### [10.5] Cron glue
- [x] **10.5.1** Implement `POST /api/cron/*` route handlers (token-guarded) that enqueue jobs
  - **Produces**: job enqueues for daily-rollup, scheduled-notifications, purge-deletions
  - **Consumed by**: AWS EventBridge schedule
  - [x] Token in `Authorization: Bearer $CRON_SECRET`
  - [x] Refuses if job already running (Redis lock)

---

### Phase 11: Hardening

#### [11.1] Security surface
- [x] **11.1.1** Enforce CSP + HSTS + Permissions-Policy + Referrer-Policy in `next.config.ts`
  - **Produces**: response headers
  - [x] CSP allows only required third-party origins; no `unsafe-inline` in scripts
  - [x] HSTS preload-ready
- [x] **11.1.2** Verify brute-force + CAPTCHA thresholds end-to-end
  - **Produces**: tuned limits per plan §8.7
  - [x] Failing login beyond threshold demands CAPTCHA on next attempt
  - [x] Reset-password can't be used to probe emails

#### [11.2] Performance validation
- [x] **11.2.1** Run `EXPLAIN` on hot queries (journal feed, daily card, admin users)
  - **Produces**: index adjustments if any query doesn't use intended index
  - [x] No full scans on top-10 hot queries at 100k-row seed
- [x] **11.2.2** k6 load test for hot endpoints
  - **Produces**: baseline report under `/docs/perf/`
  - [x] P95 < 2s for user reads; webhook handler < 500ms

#### [11.3] GDPR manual verification
- [x] **11.3.1** Manual run-through: signup → journal → export → request deletion → fast-forward scheduledAt → purge worker
  - **Produces**: verified clean-up; audit log + storage both empty for that user
  - [x] No orphaned Firebase objects; payments retained with user=null per policy
  - [x] Document the steps in `docs/ops/gdpr-runbook.md` for future re-verification

---

### Phase 12: PWA & Observability

#### [12.1] PWA shell
- [x] **12.1.1** Add `public/manifest.webmanifest`, icons, and Workbox-based `sw.js` for offline shell
  - **Produces**: installable PWA
  - **Consumed by**: browser install prompt
  - [x] Lighthouse PWA audit ≥ 90
  - [x] Offline routes: home shell + last-viewed journal entry

#### [12.2] FCM SW
- [x] **12.2.1** Add `public/firebase-messaging-sw.js` wired to VAPID key
  - **Produces**: web push reception
  - **Consumed by**: FCM notifications
  - [x] Background message handler surfaces notifications with deep links

#### [12.3] Observability
- [x] **12.3.1** Wire Sentry (server + client) with PII scrubber
  - **Produces**: exception capture
  - [x] Releases tagged per deploy; source maps uploaded
- [x] **12.3.2** Emit CloudWatch metrics (queue depth, cache hit rate, webhook duration)
  - **Produces**: dashboards
  - [x] Alarms on queue depth and webhook failure rate

---

## Execution Strategies

### Sequential Execution (single-contributor order)
1. **0.1–0.4** Foundation (deps, env, singletons, CI)
2. **1.1–1.2** Schema + seed
3. **2.1** Auth.js core
4. **2.6** Audit logger (needed by 2.5 admin mutations and later admin work)
5. **2.2** Email flows
6. **2.3** WebAuthn
7. **2.4** Guest sessions
8. **2.5** Admin 2FA + RBAC middleware
9. **3.1–3.3** Preferences, profile, GDPR surface
10. **4.1–4.3** Content read (decks, daily card, journeys)
11. **5.1–5.3** Journal + voice + timeline/search/export-request
12. **6.1** Rollup signals
13. **7.1–7.5** Billing (plans, user checkout, unlocks, webhooks, admin ops)
14. **8.1–8.3** Push + email + campaigns + reminders
15. **9.1–9.4** Admin APIs (dashboards, users, content, settings/audit/flags)
16. **10.1–10.5** Workers, rollups, exports, purge, cron
17. **11.1–11.3** Hardening
18. **12.1–12.3** PWA + FCM SW + observability

### Parallel Execution (multi-contributor waves)

**Wave 1 — Foundation (1 contributor)**
- 0.1 · 0.2 · 0.3 · 0.4 — no upstream deps.
- Rationale: every other task imports `db`, `env`, `cache`, `pagination`, `rate-limit`.

**Wave 2 — Schema + auth core (parallel)**
- 1.1 Schema · 1.2 Seed (after 1.1) · 2.1 Auth.js core (after 1.1) · 2.6 Audit logger (after 1.1).
- Rationale: schema unblocks everything; seed, auth, and audit can be built in parallel once models exist.

**Wave 3 — Account surfaces (parallel)**
- 2.2 Email flows · 2.3 WebAuthn · 2.4 Guest sessions · 2.5 Admin 2FA + RBAC middleware · 3.1 Preferences · 3.2 Profile · 3.3 GDPR surface.
- Rationale: all depend on 2.1 + 1.1; independent of each other.

**Wave 4 — Content + journal + billing plans (parallel)**
- 4.1 Decks/cards · 4.2 Daily/mood/draws · 4.3 Journeys · 5.1 Journal CRUD · 5.2 Voice notes · 7.1 Plans & coupons.
- Rationale: share DB + auth foundation; no cross-dependencies.

**Wave 5 — Timeline/search + billing flows + notifications adapters**
- 5.3 Timeline/calendar/search/export-request · 6.1 Rollup signals · 7.2 User billing · 7.3 Card unlocks · 8.1 Push + email adapters.
- Rationale: need cards + journal entries + plans to exist.

**Wave 6 — Webhooks + admin ops + campaigns + reminders**
- 7.4 Stripe webhooks · 7.5 Admin billing ops · 8.2 Campaigns · 8.3 Reminders · 9.2 Admin user mgmt · 9.3 Admin content mgmt.
- Rationale: all require Wave 5 outputs (templates, plans, schema for payments).

**Wave 7 — Admin analytics + settings + workers + cron**
- 9.1 Dashboard + analytics reads · 9.4 Settings/audit/flags · 10.1 Worker runtime · 10.2 Rollups · 10.3 Exports · 10.4 Purge · 10.5 Cron glue.
- Rationale: rollup tables are populated by 10.2, consumed by 9.1; workers can be built alongside admin reads.

**Wave 8 — Hardening**
- 11.1 Security surface · 11.2 Performance validation · 11.3 GDPR E2E.
- Rationale: run against a complete backend.

**Wave 9 — PWA + observability**
- 12.1 PWA shell · 12.2 FCM SW · 12.3 Sentry + CloudWatch.
- Rationale: end-of-line polish; independent of backend logic.

---

## Coverage Summary
- Total Requirements Extracted: **20** (REQ-001..REQ-020)
- Requirements with Task Coverage: **20 (100%)**
- Phases: **13** (0 through 12)
- Parent Tasks: **45**
- Sub-tasks: **110**
