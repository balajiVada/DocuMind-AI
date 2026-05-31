import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger';

// Default Redis connection for queues
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

class QueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

  constructor() {}

  /**
   * Get or create a queue by name
   */
  public getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, { connection: redisConnection as any });
      this.queues.set(queueName, queue);
      logger.info(`Queue initialized: ${queueName}`);
    }
    return this.queues.get(queueName)!;
  }

  /**
   * Add a job to a specific queue
   */
  public async addJob(queueName: string, jobName: string, data: any, opts: any = {}): Promise<Job> {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: { count: 100, age: 24 * 3600 }, // Clean up failed jobs after 24 hours or 100 jobs
      ...opts,
    });
  }

  /**
   * Register a worker to process jobs for a specific queue
   */
  public registerWorker(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    concurrency: number = 1
  ): Worker {
    if (this.workers.has(queueName)) {
      logger.warn(`Worker already registered for queue: ${queueName}`);
      return this.workers.get(queueName)!;
    }

    const worker = new Worker(queueName, processor, {
      connection: redisConnection as any,
      concurrency,
    });

    worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed successfully in queue ${queueName}`);
    });

    worker.on('failed', (job, err) => {
      logger.error({ err }, `Job ${job?.id} failed in queue ${queueName}`);
    });

    this.workers.set(queueName, worker);
    logger.info(`Worker registered for queue: ${queueName} with concurrency ${concurrency}`);
    return worker;
  }
}

export const queueService = new QueueService();
