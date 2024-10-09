// src/services/workerManagerService.ts

import { createClient } from 'redis';
import config from '../config/config';
import { cpus } from 'os';

export class WorkerManagerService {
  private redisClient;

  constructor() {
    this.redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port
      }
    });
  }

  async getWorkerMetrics() {
    const metrics = await this.redisClient.hGetAll('worker_metrics');
    return metrics;
  }

  async shouldScaleUp(): Promise<boolean> {
    const metrics = await this.getWorkerMetrics();
    const activeWorkers = Object.keys(metrics).filter(key => key.endsWith('_last_active')).length;
    const totalCPUs = cpus().length;
    
    // Check if queue is backing up
    const queueLength = await this.redisClient.lLen('bull:audio-conversion:waiting');
    
    // Scale up if queue is backing up and we haven't hit CPU limit
    return queueLength > config.scaling.queueThreshold && activeWorkers < totalCPUs;
  }

  async shouldScaleDown(): Promise<boolean> {
    const metrics = await this.getWorkerMetrics();
    console.log(metrics, 'the metrics');
    const queueLength = await this.redisClient.lLen('bull:audio-conversion:waiting');
    
    // Scale down if queue is small and processing times are fast
    return queueLength < config.scaling.queueThreshold / 2;
  }

  getRecommendedWorkerCount(): number {
    const totalCPUs = cpus().length;
    // Reserve some CPU for the main application
    return Math.max(1, totalCPUs - 1);
  }
}