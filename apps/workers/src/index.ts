import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { prisma } from '@priovex/database';
import { createSearchWorker } from './workers/search.worker';
import { createQuotaResetWorker, scheduleMonthlyQuotaReset } from './workers/quota-reset.worker';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0.1,
  });
}

async function main() {
  console.log('🚀 PrioVex.AI Workers starting...');

  // Verify database connection
  await prisma.$connect();
  console.log('✅ Database connected');

  // Start workers
  const searchWorker = createSearchWorker();
  console.log(`✅ Search worker started (concurrency: ${process.env.WORKER_CONCURRENCY ?? '3'})`);

  const quotaResetWorker = createQuotaResetWorker();
  await scheduleMonthlyQuotaReset();
  console.log('✅ Quota reset worker started (runs 1st of each month)');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down workers...`);
    await searchWorker.close();
    await quotaResetWorker.close();
    await prisma.$disconnect();
    console.log('✅ Workers shut down gracefully');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('✅ All workers running. Waiting for jobs...');
}

main().catch((err) => {
  console.error('❌ Fatal worker error:', err);
  Sentry.captureException(err);
  process.exit(1);
});
