FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ── Install stage: copy only package manifests for cache-efficient layer ──────
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/types/package.json ./packages/types/
COPY packages/queue/package.json ./packages/queue/
COPY packages/database/package.json ./packages/database/
COPY packages/ai-providers/package.json ./packages/ai-providers/
COPY packages/bigquery/package.json ./packages/bigquery/
COPY packages/npl-engine/package.json ./packages/npl-engine/
COPY packages/report-generator/package.json ./packages/report-generator/
RUN npm ci

# ── Build stage: compile the worker bundle via esbuild ────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build --workspace=apps/workers

# ── Runtime stage: minimal image with bundle + external npm deps ──────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# External npm packages (Prisma client, bullmq, puppeteer, etc.) + workspace symlinks
COPY --from=builder /app/node_modules ./node_modules
# esbuild bundle (single file — all @priovex/* code is inlined)
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist
# Prisma schema (needed for prisma migrate on deploy)
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

RUN adduser --system --uid 1001 worker
USER worker

CMD ["node", "apps/workers/dist/index.js"]
