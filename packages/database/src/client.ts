import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Supabase connection pooler (Supavisor) runs in Transaction mode which does
// not support prepared statements. Prisma uses them by default, causing
// PostgreSQL error 42P05 ("prepared statement already exists") on Vercel
// serverless where multiple function instances share pooled connections.
// Adding pgbouncer=true switches Prisma to simple query protocol (no
// prepared statements), fixing the conflict.
function buildDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes('pgbouncer=true')) return url;
  return url + (url.includes('?') ? '&' : '?') + 'pgbouncer=true';
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: buildDatasourceUrl(),
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    errorFormat: 'pretty',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
