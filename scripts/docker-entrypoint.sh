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
RESOLVED_DB_CONFIG="$(node /app/scripts/database-config.mjs startup)" || {
  exit 1
}

DB_HOST="$(printf '%s' "$RESOLVED_DB_CONFIG" | cut -f1)"
DB_PORT="$(printf '%s' "$RESOLVED_DB_CONFIG" | cut -f2)"
DB_SOURCE="$(printf '%s' "$RESOLVED_DB_CONFIG" | cut -f3)"

RESOLVED_DATABASE_URL="$(node /app/scripts/database-config.mjs connection-url)" || {
  exit 1
}
export DATABASE_URL="$RESOLVED_DATABASE_URL"

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
run_prisma() {
  if [ -n "${PRISMA_BIN:-}" ]; then
    "$PRISMA_BIN" "$@"
    return $?
  fi

  return 127
}

PRISMA_CLI_AVAILABLE="false"
PRISMA_BIN=""
if command -v prisma >/dev/null 2>&1; then
  PRISMA_BIN="$(command -v prisma)"
elif [ -x "/app/tools/node_modules/.bin/prisma" ]; then
  PRISMA_BIN="/app/tools/node_modules/.bin/prisma"
elif [ -x "/app/node_modules/.bin/prisma" ]; then
  PRISMA_BIN="/app/node_modules/.bin/prisma"
fi

if [ -n "$PRISMA_BIN" ]; then
  PRISMA_CLI_AVAILABLE="true"
  if [ "${SKIP_MIGRATE:-}" = "true" ]; then
    echo "⏭️  SKIP_MIGRATE=true — skipping migrations"
  else
    echo "🔄  Running Prisma migrations..."
    if ! run_prisma migrate deploy; then
      echo "❌  Prisma migrations failed"
      exit 1
    fi
    echo "✅  Migrations complete"
  fi
else
  echo "⏭️  Prisma CLI not found — skipping migrations"
fi
echo ""

# -----------------------------------------------------------------------------
# 3. Prisma Seed (seed.ts uses upserts for idempotency)
# -----------------------------------------------------------------------------
if [ "$PRISMA_CLI_AVAILABLE" != "true" ]; then
  echo "⏭️  Prisma CLI not found — skipping seed"
elif [ "${SKIP_SEED:-}" = "true" ]; then
  echo "⏭️  SKIP_SEED=true — skipping seed"
else
  echo "🌱  Running Prisma seed..."
  if ! run_prisma db seed; then
    echo "❌  Prisma seed failed"
    exit 1
  fi
  echo "✅  Seed complete"
fi
echo ""

# -----------------------------------------------------------------------------
# 4. Start application
# -----------------------------------------------------------------------------
echo "🚀  Starting Next.js application..."
echo ""

exec "$@"
