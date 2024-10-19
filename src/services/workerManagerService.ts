// src/services/workerManagerService.ts
import { WorkerMetrics } from '../types/config';
import { convertRedisHashToWorkerMetrics } from '../utils/workerMetrics';
import { createClient, RedisClientType } from 'redis';
import config from '../config/config';
import { cpus } from 'os';
import Queue from "bull";
import { QueueService } from "../services/queueService";
interface WorkerMetricsMap {
  [key: string]: WorkerMetrics;
}

export class WorkerManagerService {
  private queue: Queue.Queue;
  private redisClient!: RedisClientType;
  private isConnected = false;
  private static readonly STALE_WORKER_THRESHOLD = 180000;

  constructor() {
    // this.initializeRedis();
    this.queue = QueueService.getInstance().getQueue();
  }

  private async initializeRedis() {
    this.redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        reconnectStrategy: (retries: number) => {
          console.log(`Redis connection failed, retrying in ${retries * 100}ms...`);
          if (retries > 10) {
            console.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      },
    });

    this.redisClient.on('error', (err:any) => {
      console.error('WorkerManager Redis error:', err);
      this.isConnected = false;
    });

    this.redisClient.on('connect', () => {
      console.log('WorkerManager Redis connected');
      this.isConnected = true;
    });

    try {
      await this.redisClient.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async getWorkerMetrics(): Promise<WorkerMetricsMap> {
    if (!this.isConnected) {
      await this.initializeRedis();
    }
  
    try {
      const workers = await this.redisClient.keys('worker:*');
      const metrics: WorkerMetricsMap = {};
      
      for (const workerKey of workers) {
        const workerMetricsHash = await this.redisClient.hGetAll(workerKey);
        metrics[workerKey] = convertRedisHashToWorkerMetrics(workerMetricsHash);
      }
      
      return metrics;
    } catch (error) {
      console.error('Error fetching worker metrics:', error);
      return {};
    }
  }

  async getActiveWorkerCount(): Promise<number> {
    try {
      const redisClient = this.redisClient; // Your Redis client
      const now = Date.now();
      let activeCount = 0;

      // Get all worker keys
      const workerKeys = await redisClient.keys('worker:*');
      
      for (const key of workerKeys) {
        const workerData = await redisClient.hGetAll(key);
        
        if (workerData) {
          const lastHeartbeat = parseInt(workerData.lastHeartbeat || '0');
          const timeSinceHeartbeat = now - lastHeartbeat;

          // Consider worker active only if heartbeat is recent
          if (timeSinceHeartbeat < WorkerManagerService.STALE_WORKER_THRESHOLD) {
            activeCount++;
          } else {
            // Clean up stale worker data
            await redisClient.del(key);
            console.log(`Cleaned up stale worker: ${key}`);
          }
        }
      }

      return activeCount;
    } catch (error) {
      console.error('Error getting active worker count:', error);
      return 0;
    }
  }

  async cleanupStaleWorkers(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.initializeRedis();
      }

      // const redisClient = this.redisClient;
      const now = Date.now();
      const workerKeys = await this.redisClient.keys('worker:*');

      for (const key of workerKeys) {
        const workerData = await this.redisClient.hGetAll(key);
        
        if (workerData) {
          const lastHeartbeat = parseInt(workerData.lastHeartbeat || '0');
          const timeSinceHeartbeat = now - lastHeartbeat;

          if (timeSinceHeartbeat >= WorkerManagerService.STALE_WORKER_THRESHOLD) {
            await this.redisClient.del(key);
            console.log(`Cleaned up stale worker: ${key}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up stale workers:', error);
    }
  }

  async shouldScaleUp(): Promise<boolean> {
    if (!this.isConnected) {
      await this.initializeRedis();
    }

    try {
      const metrics = await this.getWorkerMetrics();
      // console.log(metrics, 'the metrics');
      const activeWorkers = Object.keys(metrics).length;
      const totalCPUs = cpus().length;

      // const queueLength = await this.redisClient.lLen('bull:audio-conversion');
      // console.log('queueLength', queueLength);
       // Get waiting + active jobs count
       const jobCounts = await this.queue.getJobCounts();
       const queueLength = jobCounts.waiting + jobCounts.active;
       
       console.log('Queue state:', {
         waiting: jobCounts.waiting,
         active: jobCounts.active,
         total: queueLength,
         activeWorkers,
         totalCPUs
       });
      const result = queueLength > config.scaling.queueThreshold && activeWorkers < totalCPUs;
      console.log('result', result);
      // return queueLength > config.scaling.queueThreshold && activeWorkers < totalCPUs;
      return result;
    } catch (error) {
      console.error('Error checking scale up conditions:', error);
      return false;
    }
  }

  // async shouldScaleUp(): Promise<boolean> {
  //   if (!this.isConnected) {
  //     await this.initializeRedis();
  //   }
  
  //   try {
  //     const metrics = await this.getWorkerMetrics();
  //     const activeWorkers = Object.keys(metrics).length;
  //     const totalCPUs = cpus().length;
      
  //     // Get all Redis keys related to the Bull queues
  //     const queueKeys = await this.redisClient.keys('bull:*');
  //     console.log(queueKeys, 'the queue keys');
  
  //     // Iterate over the keys and fetch data based on the key's type
  //     const queueDetails = await Promise.all(queueKeys.map(async (queueKey) => {
  //       const keyType = await this.redisClient.type(queueKey);
        
  //       if (keyType === 'hash') {
  //         // Fetch hash fields and values
  //         const queueFields = await this.redisClient.hKeys(queueKey);
  //         const queueData = await Promise.all(queueFields.map(async (field) => {
  //           const value = await this.redisClient.hGet(queueKey, field);
  //           return { field, value };
  //         }));
  //         console.log(queueData, 'queueData');
  //         return { queueKey, queueData };
  
  //       } else if (keyType === 'list') {
  //         // Fetch list length if it's a list (e.g., waiting jobs)
  //         const listLength = await this.redisClient.lLen(queueKey);
  //         return { queueKey, listLength };
  
  //       } else {
  //         // For other types (string, set, etc.), just return the type and key
  //         return { queueKey, type: keyType };
  //       }
  //     }));
  
  //     console.log(queueDetails, 'the queue details');
  
  //     // Get the length of the waiting jobs list in Bull queue
  //     const queueLength = await this.redisClient.lLen('bull:audio-conversion:waiting');
  //     console.log('queueLength', queueLength);
  
  //     const result = queueLength > config.scaling.queueThreshold && activeWorkers < totalCPUs;
  //     console.log('result', result);
      
  //     return result;
  //   } catch (error) {
  //     console.error('Error checking scale up conditions:', error);
  //     return false;
  //   }
  // }
  

    async shouldScaleDown(): Promise<boolean> {
      if (!this.isConnected) {
        await this.initializeRedis();
      }

      try {
        const queueLength = await this.redisClient.lLen('bull:audio-conversion:waiting');
        return queueLength < config.scaling.queueThreshold / 2;
      } catch (error) {
        console.error('Error checking scale down conditions:', error);
        return false;
      }
    }

    async getQueueLength(): Promise<number> {
      if (!this.isConnected) {
        await this.initializeRedis();
      }
    
      try {
        const waitingCount = await this.redisClient.lLen('bull:audio-conversion:waiting');
        const activeCount = await this.redisClient.lLen('bull:audio-conversion:active');
        return waitingCount + activeCount;
      } catch (error) {
        console.error('Error getting queue length:', error);
        return 0;
      }
    }

  getRecommendedWorkerCount(): number {
    return Math.max(1, cpus().length - 1);
  }

  async cleanup() {
    if (this.redisClient?.isOpen) {
      await this.redisClient.quit();
    }
  }
}