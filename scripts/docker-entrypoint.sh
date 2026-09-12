#!/bin/sh
set -e

# =============================================================================
# Sophionix Docker Entrypoint
# Waits for MySQL/MariaDB, runs Prisma migrations, seeds, then starts app.
# =============================================================================

DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Sophionix Container Startup Sequence                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# -----------------------------------------------------------------------------
# 1. Wait for database
# -----------------------------------------------------------------------------
RESOLVED_DB_CONFIG="$(node /app/scripts/database-config.mjs startup 2>&1)" || {
  echo "❌  ${RESOLVED_DB_CONFIG}"
  exit 1
}

DB_HOST="$(printf '%s' "$RESOLVED_DB_CONFIG" | cut -f1)"
DB_PORT="$(printf '%s' "$RESOLVED_DB_CONFIG" | cut -f2)"
DB_SOURCE="$(printf '%s' "$RESOLVED_DB_CONFIG" | cut -f3)"

echo "⏳  Waiting for database at ${DB_HOST}:${DB_PORT} (source: ${DB_SOURCE}, timeout: ${DB_WAIT_TIMEOUT}s)..."

wait_start=$(date +%s)
while ! nc -z "$DB_HOST" "$DB_PORT" >/dev/null 2>&1; do
  now=$(date +%s)
  elapsed=$((now - wait_start))
  if [ "$elapsed" -ge "$DB_WAIT_TIMEOUT" ]; then
    echo "❌  Database connection timed out after ${DB_WAIT_TIMEOUT}s"
    exit 1
  fi
  echo "    ... still waiting (${elapsed}s elapsed)"
  sleep 2
done
echo "✅  Database is ready"
echo ""

# -----------------------------------------------------------------------------
# 2. Prisma Migrate Deploy
# -----------------------------------------------------------------------------
if [ "${SKIP_MIGRATE:-}" = "true" ]; then
  echo "⏭️  SKIP_MIGRATE=true — skipping migrations"
else
  echo "🔄  Running Prisma migrations..."
  prisma migrate deploy
  echo "✅  Migrations complete"
fi
echo ""

# -----------------------------------------------------------------------------
# 3. Prisma Seed (seed.ts uses upserts for idempotency)
# -----------------------------------------------------------------------------
if [ "${SKIP_SEED:-}" = "true" ]; then
  echo "⏭️  SKIP_SEED=true — skipping seed"
else
  echo "🌱  Running Prisma seed..."
  prisma db seed
  echo "✅  Seed complete"
fi
echo ""

# -----------------------------------------------------------------------------
# 4. Start application
# -----------------------------------------------------------------------------
echo "🚀  Starting Next.js application..."
echo ""

exec "$@"
