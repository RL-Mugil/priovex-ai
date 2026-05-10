import { Queue, Worker, QueueEvents, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { SearchJobData, SearchJobResult, ReportJobData } from '@priovex/types';

export const QUEUE_NAMES = {
  SEARCH: 'patent-search',
  REPORT: 'report-generation',
  NOTIFICATION: 'notifications',
} as const;

let _redis: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is not set');

  _redis = new IORedis(url, {
    maxRetriesPerRequest: null,  // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  _redis.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  return _redis;
}

export function getConnectionOptions(): ConnectionOptions {
  return {
    host: new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname,
    port: parseInt(new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').port || '6379'),
    password: new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').password || undefined,
  };
}

// ─── QUEUES ──────────────────────────────────────────────────────────────────

export function createSearchQueue(): Queue<SearchJobData, SearchJobResult> {
  return new Queue<SearchJobData, SearchJobResult>(QUEUE_NAMES.SEARCH, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400, count: 100 },
      removeOnFail: { age: 604800, count: 500 },
      timeout: parseInt(process.env.SEARCH_TIMEOUT_MS ?? '2700000'),
    },
  });
}

export function createReportQueue(): Queue<ReportJobData> {
  return new Queue<ReportJobData>(QUEUE_NAMES.REPORT, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600 },
    },
  });
}

export function createSearchQueueEvents(): QueueEvents {
  return new QueueEvents(QUEUE_NAMES.SEARCH, {
    connection: getRedisConnection(),
  });
}

// ─── JOB HELPERS ─────────────────────────────────────────────────────────────

export async function enqueueSearch(
  data: SearchJobData
): Promise<string> {
  const queue = createSearchQueue();
  const job = await queue.add('run-search', data, {
    jobId: data.searchId,
    priority: getPriority(data),
  });
  await queue.close();
  return job.id!;
}

function getPriority(data: SearchJobData): number {
  // Lower number = higher priority in BullMQ
  // Enterprise gets priority 1, Pro gets 5, Free gets 10
  return 5; // Default, can be extended with subscription tier
}

export async function cancelSearch(searchId: string): Promise<boolean> {
  const queue = createSearchQueue();
  const job = await queue.getJob(searchId);
  if (!job) {
    await queue.close();
    return false;
  }

  const state = await job.getState();
  if (state === 'waiting' || state === 'delayed') {
    await job.remove();
    await queue.close();
    return true;
  }

  await queue.close();
  return false; // Active jobs are cancelled via cancellation flag in DB
}

export async function getSearchJobStatus(searchId: string) {
  const queue = createSearchQueue();
  const job = await queue.getJob(searchId);
  if (!job) {
    await queue.close();
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;
  await queue.close();

  return { state, progress, attemptsMade: job.attemptsMade };
}

export { Queue, Worker, QueueEvents } from 'bullmq';
export type { Job } from 'bullmq';
