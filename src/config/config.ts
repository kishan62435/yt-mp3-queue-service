// src/config/config.ts

import { AppConfig } from '../types/config';
import dotenv from 'dotenv';

dotenv.config();

const config: AppConfig = {
    port: Number(process.env.PORT) || 3000,
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelay: 2000,
      maxRetries: 3
    },
    storage: {
      tempDir: process.env.TEMP_DIR || 'temp',
      outputDir: process.env.OUTPUT_DIR || 'output',
    },
    conversion: {
      defaultQuality: 192,
      // allowedQualities: ['64k', '128k', '192k', '256k', '320k'],
      allowedQualities: [64, 128, 192, 256, 320],
      maxDuration: 300, // 1 hour in seconds
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000 // limit each IP to 100 requests per windowMs
    },
    queue: {
      maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '5'),
      jobTimeout: parseInt(process.env.JOB_TIMEOUT || '900000') // 5 minutes
    },
    // Worker configuration
    worker: {
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3'),
      rateLimit: {
        max: parseInt(process.env.WORKER_RATE_LIMIT_MAX || '10'),
        duration: parseInt(process.env.WORKER_RATE_LIMIT_DURATION || '600000') // 1 minute
      }
    },
    scaling: {
      queueThreshold: parseInt(process.env.QUEUE_THRESHOLD || '5'),
      maxWorkers: parseInt(process.env.MAX_WORKERS || '0'), // 0 means auto-detect based on CPU cores
      scaleCheckInterval: parseInt(process.env.SCALE_CHECK_INTERVAL || '60000') // 1 minute
    },
    monitoring: {
      enabled: process.env.ENABLE_MONITORING === 'true',
      metricsInterval: parseInt(process.env.METRICS_INTERVAL || '15000') // 15 seconds
    }
  };
 export default config;