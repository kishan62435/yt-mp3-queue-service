// src/types/config.ts
export interface RedisConfig {
    host: string;
    port: number;
    retryDelay: number;
    maxRetries: number;
  }
  
  export interface WorkerRateLimit {
    max: number;
    duration: number;
  }
  
  export interface WorkerConfig {
    concurrency: number;
    rateLimit: WorkerRateLimit;
  }
  
  export interface StorageConfig {
    outputDir: string;
    tempDir: string;
  }
  
  export interface ScalingConfig {
    queueThreshold: number;
    maxWorkers: number;
    scaleCheckInterval: number;
  }

  export interface ConversionConfig {
    defaultQuality: number;
    allowedQualities: number[];
    maxDuration: number;
  }

  export interface RateLimitConfig {
    windowMs: number;
    max: number;
  }
  
  export interface QueueConfig {
    maxConcurrentJobs: number;
    jobTimeout: number;
  }
  
  export interface MonitoringConfig {
    enabled: boolean;
    metricsInterval: number;
  }
  
  export interface AppConfig {
    redis: RedisConfig;
    worker: WorkerConfig;
    storage: StorageConfig;
    scaling: ScalingConfig;
    port: number;
    conversion: ConversionConfig;
    rateLimit: RateLimitConfig;
    queue: QueueConfig;
    monitoring: MonitoringConfig;
  }

  // Types for worker metrics
export interface WorkerMetrics {
  lastActive: number | string;
  status: WorkerStatus;
  jobsCompleted: number;
  jobsFailed: number;
  lastJobId: string;
  currentJobId?: string;
  cpuUsage?: number;
  memoryUsage?: number;
}

export enum WorkerStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

export type WorkerMetricsMap = {
  [workerId: string]: WorkerMetrics;
};

