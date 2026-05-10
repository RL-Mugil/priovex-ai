FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont
WORKDIR /app

# Puppeteer config for Alpine
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/workers/package.json ./apps/workers/
COPY apps/workers/package-lock.json ./apps/workers/
COPY packages/*/package.json ./packages/
COPY packages/*/package-lock.json ./packages/
RUN npm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build --workspace=apps/workers

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/workers/dist ./dist
COPY --from=builder /app/packages/database/prisma ./prisma

RUN adduser --system --uid 1001 worker
USER worker

CMD ["node", "dist/index.js"]
