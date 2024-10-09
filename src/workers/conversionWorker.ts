// src/workers/conversionWorker.ts

import Queue from 'bull';
import { DownloadService } from '../services/downloadService';
import config from '../config/config';
import { createClient } from 'redis';

const downloadService = new DownloadService();

// Create Redis client for worker metrics
const redisClient = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port
  }
});

// Track worker metrics
const updateWorkerMetrics = async (workerId: string) => {
  try {
    await redisClient.hIncrBy('worker_metrics', `${workerId}_jobs_processed`, 1);
    await redisClient.hSet('worker_metrics', `${workerId}_last_active`, Date.now().toString());
  } catch (error) {
    console.error('Error updating worker metrics:', error);
  }
};

// Create the worker process
const startWorker = async (workerId: string) => {
  console.log(`Starting worker ${workerId}`);

  // Create a queue instance for processing with rate limiting
  const queue = new Queue('audio-conversion', {
    redis: {
      host: config.redis.host,
      port: config.redis.port
    },
    limiter: {
      max: config.worker.rateLimit.max,
      duration: config.worker.rateLimit.duration
    }
  });

  // console.log(queue, 'the queue');
  // Process jobs
  queue.process(config.worker.concurrency, async (job) => {
    const startTime = Date.now();
    console.log(`[Worker ${workerId}] Processing job ${job.id}`);

    try {
      // Update job progress
      await job.progress(10);
      
      const { videoUrl, quality } = job.data;
      const outputPath = await downloadService.downloadVideo(videoUrl, config.storage.outputDir, quality);

      // Update worker metrics
      await updateWorkerMetrics(workerId);

      // Log processing time
      const processingTime = Date.now() - startTime;
      await redisClient.hIncrBy('worker_metrics', `${workerId}_total_processing_time`, processingTime);

      return {
        outputPath,
        metadata: {
          processingTime,
          workerId,
          quality
        }
      };
    } catch (error) {
      console.error(`[Worker ${workerId}] Job ${job.id} failed:`, error);
      throw error;
    }
  });

  // Handle queue events
  queue.on('completed', (job) => {
    console.log(`[Worker ${workerId}] Job ${job.id} completed`);
  });

  queue.on('failed', async (job, error) => {
    console.error(`[Worker ${workerId}] Job ${job.id} failed:`, error);
    await redisClient.hIncrBy('worker_metrics', `${workerId}_failures`, 1);
  });

  queue.on('error', error => {
    console.error(`[Worker ${workerId}] Error:`, error);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log(`[Worker ${workerId}] Shutting down...`);
    await queue.close();
    process.exit(0);
  });

  return queue;
};

export { startWorker };