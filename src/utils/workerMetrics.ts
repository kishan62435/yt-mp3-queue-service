// Helper function to convert Redis hash to WorkerMetrics
import { WorkerMetrics, WorkerStatus } from '../types/config';

export function convertRedisHashToWorkerMetrics(hash: { [key: string]: string }): WorkerMetrics {
    return {
      lastActive: parseInt(hash.lastActive || '0'),
      status: (hash.status as WorkerStatus) || WorkerStatus.OFFLINE,
      jobsCompleted: parseInt(hash.jobsCompleted || '0'),
      jobsFailed: parseInt(hash.jobsFailed || '0'),
      lastJobId: hash.lastJobId || '',
      currentJobId: hash.currentJobId,
      cpuUsage: hash.cpuUsage ? parseFloat(hash.cpuUsage) : undefined,
      memoryUsage: hash.memoryUsage ? parseFloat(hash.memoryUsage) : undefined,
    };
  }