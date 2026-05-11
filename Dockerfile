# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy the entire monorepo
COPY . .

# Install dependencies at root level (this installs all workspace dependencies)
RUN npm install
RUN npx prisma generate --schema=/app/packages/database/prisma/schema.prisma

# Build the workers package
WORKDIR /app/apps/workers
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package.json files from root and apps/workers
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/workers/package.json ./apps/workers/

# Copy the built output
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist

# Copy prisma schema and generated client
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Install production dependencies only
RUN npm install --omit=dev

# Run the built workers service
CMD ["node", "apps/workers/dist/index.js"]
