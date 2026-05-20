import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnection } from '@priovex/queue';
import { runMonthlyQuotaReset } from '../processors/quota-reset';

const QUOTA_RESET_QUEUE = 'quota-reset';

export function createQuotaResetWorker(): Worker {
  const worker = new Worker(
    QUOTA_RESET_QUEUE,
    async (_job: Job) => {
      await runMonthlyQuotaReset();
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    }
  );

  worker.on('completed', () => console.log('[QuotaReset] Monthly quota reset completed'));
  worker.on('failed', (_job, err) => console.error('[QuotaReset] Reset failed:', err.message));

  return worker;
}

export async function scheduleMonthlyQuotaReset(): Promise<void> {
  const queue = new Queue(QUOTA_RESET_QUEUE, { connection: getRedisConnection() });

  // Remove any existing repeatable job before re-registering
  const repeatables = await queue.getRepeatableJobs();
  for (const job of repeatables) {
    if (job.name === 'monthly-reset') await queue.removeRepeatableByKey(job.key);
  }

  // Schedule: 00:05 on the 1st of every month (UTC)
  await queue.add(
    'monthly-reset',
    {},
    {
      repeat: { pattern: '5 0 1 * *' },
      jobId: 'monthly-quota-reset',
    }
  );

  await queue.close();
  console.log('[QuotaReset] Monthly quota reset scheduled (cron: 5 0 1 * *)');
}
