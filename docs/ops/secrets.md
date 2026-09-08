# Secrets Manager Mapping

All `CHANGE_ME_*` placeholders in `.env` must be replaced with values fetched
from AWS Secrets Manager at boot (or injected by the orchestrator). Paths
follow `/sophionix/{env}/{domain}/{key}` where `env ∈ {dev,staging,prod}`.

| Env key | Secrets Manager path |
|---|---|
| `DATABASE_URL` (password portion) | `/sophionix/prod/db/password` |
| `SHADOW_DATABASE_URL` (password portion) | `/sophionix/prod/db/shadow_password` |
| `UPSTASH_REDIS_REST_TOKEN` | `/sophionix/prod/redis/upstash_token` |
| `AUTH_SECRET` | `/sophionix/prod/auth/secret` |
| `AUTH_GOOGLE_ID` | `/sophionix/prod/auth/google/client_id` |
| `AUTH_GOOGLE_SECRET` | `/sophionix/prod/auth/google/client_secret` |
| `AUTH_APPLE_TEAM_ID` | `/sophionix/prod/auth/apple/team_id` |
| `AUTH_APPLE_KEY_ID` | `/sophionix/prod/auth/apple/key_id` |
| `AUTH_APPLE_PRIVATE_KEY` | `/sophionix/prod/auth/apple/p8_key` |
| `TOTP_SECRET_KEY` | `/sophionix/prod/auth/totp_aes_key` |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | `/sophionix/prod/recaptcha/site_key` |
| `RECAPTCHA_SECRET_KEY` | `/sophionix/prod/recaptcha/secret` |
| `STRIPE_SECRET_KEY` | `/sophionix/prod/stripe/secret_key` |
| `STRIPE_WEBHOOK_SECRET` | `/sophionix/prod/stripe/webhook_secret` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `/sophionix/prod/stripe/publishable_key` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `/sophionix/prod/firebase/web_api_key` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `/sophionix/prod/firebase/sender_id` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `/sophionix/prod/firebase/app_id` |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | `/sophionix/prod/firebase/vapid_public_key` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `/sophionix/prod/firebase/service_account_json` |
| `SMTP_USER` | `/sophionix/prod/smtp/user` |
| `SMTP_PASSWORD` | `/sophionix/prod/smtp/password` |
| `AWS_ACCESS_KEY_ID` | `/sophionix/prod/aws/access_key_id` |
| `AWS_SECRET_ACCESS_KEY` | `/sophionix/prod/aws/secret_access_key` |
| `CRON_SECRET` | `/sophionix/prod/cron/shared_secret` |
| `GUEST_SESSION_SECRET` | `/sophionix/prod/guest/cookie_hmac` |
| `SENTRY_DSN` | `/sophionix/prod/sentry/dsn` |

## Rotation

- Auth/OAuth secrets: 90 days.
- Stripe keys: on revocation only (via Stripe dashboard), then update here.
- Firebase service account: 180 days.
- TOTP AES key: never rotate without a re-encryption migration plan (see security runbook).
- Cron / HMAC secrets: 30 days.
