import { Worker } from 'bullmq';
import type { SearchJobData, SearchJobResult } from '@priovex/types';
import { getRedisConnection, QUEUE_NAMES } from '@priovex/queue';
import { runSearchPipeline } from '../processors/search-pipeline';

export function createSearchWorker(): Worker<SearchJobData, SearchJobResult> {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? '3');

  const worker = new Worker<SearchJobData, SearchJobResult>(
    QUEUE_NAMES.SEARCH,
    async (job) => {
      console.log(`[Worker] Processing search job ${job.id} (search: ${job.data.searchId})`);
      return runSearchPipeline(job);
    },
    {
      connection: getRedisConnection(),
      concurrency,
      lockDuration: 300000,    // 5-minute lock — renewed every 2.5 min automatically
      maxStalledCount: 0,      // stalled job goes straight to FAILED — prevents double run
      stalledInterval: 30000,  // check for stalls every 30s
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} completed. Report: ${result.reportId}`);
  });

  worker.on('failed', (job, err) => {
    if (err.message === 'SEARCH_CANCELLED') {
      console.log(`[Worker] Job ${job?.id} was cancelled by user`);
    } else {
      console.error(`[Worker] Job ${job?.id} FAILED:`, err.message);
    }
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled — will retry`);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });

  return worker;
}
