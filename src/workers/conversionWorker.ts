// src/workers/conversionWorker.ts
import Queue from "bull";
// import { QueueService } from "../services/queueService";
import { DownloadService } from "../services/downloadService";
import config from "../config/config";
import { createClient } from "redis";
import { v4 as uuidv4 } from "uuid";
// import { AppError } from "../middleware/errorHandler";

export class ConversionWorker {
  private queue!: Queue.Queue;
  private redisClient : any;
  private downloadService: DownloadService;
  private workerId: string;
  private isShuttingDown: boolean = false;
  private static readonly WORKER_TTL = 300; // 5 minutes in seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(workerId?: string) {
    this.workerId = workerId || uuidv4();
    this.downloadService = new DownloadService();
    // this.queue = QueueService.getInstance().getQueue();
    // this.queue = new Queue('conversion-queue'); // Initialize the queue property
  }

  private async registerWorker() {
    try {
      const workerKey = `worker:${this.workerId}`;
      await this.redisClient.hSet(workerKey, {
        status: 'active',
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        jobsCompleted: 0,
        jobsFailed: 0
      });
      
      // Set TTL on worker key
      await this.redisClient.expire(workerKey, ConversionWorker.WORKER_TTL);
    } catch (error) {
      console.error('Error registering worker:', error);
      throw error;
    }
  }

  private async updateHeartbeat() {
    try {
      const workerKey = `worker:${this.workerId}`;
      await this.redisClient.hSet(workerKey, 'lastHeartbeat', Date.now());
      await this.redisClient.expire(workerKey, ConversionWorker.WORKER_TTL);
    } catch (error) {
      console.error('Error updating heartbeat:', error);
    }
  }

  private startHeartbeat() {
    // Send heartbeat every minute
    this.heartbeatInterval = setInterval(() => {
      this.updateHeartbeat().catch(console.error);
    }, 60000); // 1 minute
  }

  private async deregisterWorker() {
    try {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      const workerKey = `worker:${this.workerId}`;
      await this.redisClient.del(workerKey);
    } catch (error) {
      console.error('Error deregistering worker:', error);
    }
  }

  private async connectRedis() {
    this.redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            console.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      },
      // Add retry strategy for connection
    });

    // Handle Redis connection events
    this.redisClient.on("error", (err: any) => {
      console.error("Redis connection error:", err);
      if (!this.isShuttingDown) {
        this.reconnectRedis();
      }
    });

    this.redisClient.on("connect", () => {
      console.log(`Redis connected for worker ${this.workerId}`);
    });

    await this.redisClient.connect();
  }

  private async reconnectRedis() {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      await this.connectRedis();
    } catch (error) {
      console.error("Redis reconnection failed:", error);
    }
  }

  private async updateWorkerMetrics(
    jobId: string,
    status: "processing" | "completed" | "failed"
  ) {
    if (!this.redisClient?.isOpen) {
      await this.reconnectRedis();
    }

    try {
      const now = Date.now();
      const multi = this.redisClient.multi();

      multi.hSet(`worker:${this.workerId}`, {
        lastActive: now,
        status,
        lastJobId: jobId,
      });

      if (status === "completed") {
        multi.hIncrBy(`worker:${this.workerId}`, "jobsCompleted", 1);
      } else if (status === "failed") {
        multi.hIncrBy(`worker:${this.workerId}`, "jobsFailed", 1);
      }

      await multi.exec();
    } catch (error) {
      console.error("Error updating worker metrics:", error);
      // Don't throw - metrics updates shouldn't break the main flow
    }
  }

  async start() {
    try {
      // Connect to Redis first
      await this.connectRedis();
      await this.registerWorker();
      this.startHeartbeat();
      // // Create the queue
      this.queue = new Queue("audio-conversion", {
        redis: {
          host: config.redis.host,
          port: config.redis.port,
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            console.log('[Worker] Retry strategy called', times);
            if (times > 3) return null; // Stop retrying after 3 attempts
            return Math.min(times * 100, 3000);
          },
        },
        limiter: {
          max: config.worker.rateLimit.max,
          duration: config.worker.rateLimit.duration,
        },
      });

      
      // Process jobs
      this.queue.process( async (job) => {
        console.log(`[Worker ${this.workerId}] Processing job ${job.id}`);
        await this.updateWorkerMetrics(job.id.toString(), "processing");

        try {
          const { videoUrl, quality } = job.data;

          console.log('in the conversion worker');
          const metadata = await this.downloadService.getVideoMetadata(videoUrl);
      
          if(metadata.duration == 0){
            await job.log('Invalid job: Bad request');
            await job.progress(100); 
            // throw new AppError(400, 'Live streams and Premieres are not allowed');
            return {status: 400, message: 'Live streams and Premieres are not allowed'}
          }
          if (metadata.duration > config.conversion.maxDuration) {
            // throw new AppError(400, "Video duration exceeds maximum allowed length");
            await job.log('Invalid job: Bad request');
            await job.progress(100); 
            return {status: 400, message: 'Live streams and Premieres are not allowed'}
          }
          // Update job progress
          await job.progress(10);

          const outputPath = await this.downloadService.downloadVideo(
            videoUrl,
            config.storage.outputDir,
            quality
          );

          await this.updateWorkerMetrics(job.id.toString(), "completed");

          return {
            outputPath,
            metadata: {
              workerId: this.workerId,
              quality,
            },
          };
        } catch (error) {
          await this.updateWorkerMetrics(job.id.toString(), "failed");
          throw error;
        }
      });

      // Handle queue events
      this.queue.on("completed", (job) => {
        console.log(`[Worker ${this.workerId}] Job ${job.id} completed`);
      });

      this.queue.on("failed", (job, error) => {
        console.error(`[Worker ${this.workerId}] Job ${job.id} failed:`, error);
      });

      this.queue.on("error", (error) => {
        console.error(`[Worker ${this.workerId}] Queue error:`, error);
      });

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      console.log(`Worker ${this.workerId} started successfully`);
    } catch (error) {
      await this.deregisterWorker();
      console.error(`Failed to start worker ${this.workerId}:`, error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown() {
    const shutdown = async () => {
      this.isShuttingDown = true;
      console.log(`[Worker ${this.workerId}] Shutting down...`);

      try {
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
  
        await this.deregisterWorker();
        
        if (this.queue) {
          await this.queue.close();
        }
        if (this.redisClient?.isOpen) {
          await this.redisClient.quit();
        }
        console.log(`[Worker ${this.workerId}] Shutdown complete`);
        process.exit(0);
      } catch (error) {
        console.error(
          `[Worker ${this.workerId}] Error during shutdown:`,
          error
        );
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
    process.on("SIGUSR2", shutdown); // For nodemon restarts
    process.on("uncaughtException", async (error) => {
      console.error(`[Worker ${this.workerId}] Uncaught exception:`, error);
      await shutdown();
    });
  }
}

// Export a function to start the worker
export const startWorker = async (workerId?: string) => {
  const worker = new ConversionWorker(workerId);
  await worker.start();
  return worker;
};
