# =============================================================================
# Sophionix Next.js — Production-Optimized Multi-Stage Dockerfile
# =============================================================================
# BuildKit features used:
#   --mount=type=cache   : Persistent yarn cache across builds
#
# Stages:
#   1. base     : Common Alpine setup with system deps
#   2. deps     : Reproducible dependency installation
#   3. builder  : Full build + Prisma generation
#   4. runner   : Minimal production runtime with migration tooling
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — Base
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app

LABEL org.opencontainers.image.title="Sophionix" \
      org.opencontainers.image.description="Next.js production runtime" \
      org.opencontainers.image.vendor="Sophionix"

# Install system dependencies:
#   libc6-compat    : Required by Prisma on Alpine (musl compatibility)
#   netcat-openbsd  : For database connectivity checks in entrypoint
RUN apk add --no-cache libc6-compat netcat-openbsd

# Enable Corepack and pin Yarn 4 for deterministic behaviour
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare yarn@4.13.0 --activate

# -----------------------------------------------------------------------------
# Stage 2 — Dependencies
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

# Copy package manager manifests first (maximises layer cache hits)
COPY package.json yarn.lock ./

# Install dependencies with immutable lockfile.
# Uses BuildKit cache mount for Yarn's global cache.
RUN --mount=type=cache,id=s/bc04795c-8b17-4355-bbcc-d0c99cd6b9c7-/usr/local/share/.cache/yarn,target=/usr/local/share/.cache/yarn \
    yarn config set nodeLinker node-modules && \
    yarn install --immutable
# -----------------------------------------------------------------------------
# Stage 3 — Builder
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Copy pre-installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy remaining source
COPY . .

# Generate Prisma client before build (required by tsc & Next.js)
RUN yarn prisma generate

# Build Next.js standalone output
RUN yarn build

# -----------------------------------------------------------------------------
# Stage 4 — Production Runner
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user/group
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# --- Copy Next.js standalone output -----------------------------------------
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public            ./public

# --- Copy Prisma artefacts for runtime migrations & seeding -----------------
# Schema, migrations, seed script, config, and generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma             ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts   ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated/prisma ./src/generated/prisma

# --- Install migration tooling in isolated directory ------------------------
# We install Prisma CLI + tsx here so the runner can execute
# `prisma migrate deploy` and `prisma db seed` on startup without
# polluting the standalone node_modules.
RUN mkdir -p /app/tools && cd /app/tools && \
    yarn init -y 2>/dev/null && \
    yarn add prisma@7.7.0 tsx@4.21.0 --no-lockfile 2>/dev/null && \
    chown -R nextjs:nodejs /app/tools

ENV PATH="/app/tools/node_modules/.bin:${PATH}"

# --- Copy entrypoint --------------------------------------------------------
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Healthcheck: Next.js should respond on root
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
