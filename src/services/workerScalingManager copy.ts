import { WorkerManagerService } from './workerManagerService';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import config from '../config/config';
import { EventEmitter } from 'events';
import { WorkerMetrics } from '../types/config';

export class WorkerScalingManager extends EventEmitter {
  private workers: Map<string, ChildProcess> = new Map();
  public workerManagerService: WorkerManagerService;
  private isScaling: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.workerManagerService = new WorkerManagerService();
  }

  public async start(): Promise<void> {
    const initialWorkerCount = Math.min(
      config.worker.concurrency,
      this.workerManagerService.getRecommendedWorkerCount()
    );

    console.log(`Starting ${initialWorkerCount} initial workers...`);
    
    for (let i = 0; i < initialWorkerCount; i++) {
      await this.startNewWorker();
    }

    this.startAutoScaling();
  }

  private async startNewWorker(): Promise<void> {
    const workerPath = path.resolve(__dirname, '../workers/conversionWorker.ts');
    
    const worker = spawn('node', [workerPath], {
      stdio: 'pipe',
      env: {
        ...process.env,
        WORKER_ID: `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
    });

    this.workers.set(worker.pid?.toString() || '', worker);

    worker.stdout?.on('data', (data) => {
      console.log(`[Worker ${worker.pid}] ${data}`);
    });

    worker.stderr?.on('data', (data) => {
      console.error(`[Worker ${worker.pid}] Error: ${data}`);
    });

    worker.on('exit', (code) => {
      console.log(`Worker ${worker.pid} exited with code ${code}`);
      this.workers.delete(worker.pid?.toString() || '');
      this.emit('workerExit', worker.pid);
    });

    return new Promise((resolve) => {
      worker.stdout?.once('data', () => resolve());
    });
  }

  private async startAutoScaling(): Promise<void> {
    this.checkInterval = setInterval(async () => {
      if (this.isScaling) return;
      
      try {
        this.isScaling = true;
        
        // Get both current process count and actual worker metrics
        const currentWorkerCount = this.workers.size;
        const metrics = await this.workerManagerService.getWorkerMetrics();
        
        // Analyze worker health and activity
        const workerAnalysis = this.analyzeWorkerHealth(metrics);
        
        if (await this.shouldScale(currentWorkerCount, workerAnalysis)) {
          if (workerAnalysis.activeWorkers < currentWorkerCount) {
            // We have zombie or crashed workers, clean them up
            await this.cleanupInactiveWorkers(metrics);
          } else if (await this.workerManagerService.shouldScaleUp()) {
            console.log('Scaling up workers based on queue load and worker metrics...');
            await this.scaleUp();
          }
        } else if (await this.shouldScaleDown(currentWorkerCount, workerAnalysis)) {
          console.log('Scaling down workers based on low utilization...');
          await this.scaleDown();
        }
      } catch (error) {
        console.error('Error during auto-scaling check:', error);
      } finally {
        this.isScaling = false;
      }
    }, config.scaling.scaleCheckInterval);
  }

  private analyzeWorkerHealth(metrics: { [key: string]: WorkerMetrics }) {
    const now = Date.now();
    const healthCheck = {
      activeWorkers: 0,
      busyWorkers: 0,
      idleWorkers: 0,
      inactiveWorkers: 0
    };

    Object.values(metrics).forEach(metric => {
      const lastActiveTime = typeof metric.lastActive === 'string' 
        ? parseInt(metric.lastActive) 
        : metric.lastActive;
      
      const isRecent = (now - lastActiveTime) < config.scaling.scaleCheckInterval * 2;

      if (isRecent) {
        healthCheck.activeWorkers++;
        if (metric.status === 'busy') {
          healthCheck.busyWorkers++;
        } else if (metric.status === 'idle') {
          healthCheck.idleWorkers++;
        }
      } else {
        healthCheck.inactiveWorkers++;
      }
    });

    return healthCheck;
  }

  private async shouldScale(currentWorkerCount: number, health: ReturnType<typeof this.analyzeWorkerHealth>): Promise<boolean> {
    const queueLength = await this.workerManagerService.getQueueLength();
    const maxWorkers = config.scaling.maxWorkers || this.workerManagerService.getRecommendedWorkerCount();
    
    return (
      queueLength > config.scaling.queueThreshold && 
      health.busyWorkers === health.activeWorkers && 
      currentWorkerCount < maxWorkers
    );
  }

  private async shouldScaleDown(currentWorkerCount: number, health: ReturnType<typeof this.analyzeWorkerHealth>): Promise<boolean> {
    if (currentWorkerCount <= 1) return false;

    const queueLength = await this.workerManagerService.getQueueLength();
    return (
      queueLength < config.scaling.queueThreshold / 2 &&
      health.idleWorkers > 1
    );
  }

  private async cleanupInactiveWorkers(metrics: { [key: string]: WorkerMetrics }): Promise<void> {
    const now = Date.now();
    const inactiveTimeout = config.scaling.scaleCheckInterval * 2;

    for (const [workerId, metric] of Object.entries(metrics)) {
      const lastActiveTime = typeof metric.lastActive === 'string' 
        ? parseInt(metric.lastActive) 
        : metric.lastActive;

      if ((now - lastActiveTime) > inactiveTimeout) {
        console.log(`Cleaning up inactive worker: ${workerId}`);
        const pid = workerId.split(':')[1];
        const worker = this.workers.get(pid);
        if (worker) {
          worker.kill('SIGTERM');
          this.workers.delete(pid);
        }
      }
    }
  }

  private async scaleUp(): Promise<void> {
    const maxWorkers = config.scaling.maxWorkers || this.workerManagerService.getRecommendedWorkerCount();
    
    if (this.workers.size >= maxWorkers) {
      console.log('Already at maximum worker count');
      return;
    }

    await this.startNewWorker();
    this.emit('scaled', 'up', this.workers.size);
  }

  private async scaleDown(): Promise<void> {
    if (this.workers.size <= 1) {
      console.log('Cannot scale down: minimum worker count reached');
      return;
    }

    const [pid, worker] = Array.from(this.workers.entries())[this.workers.size - 1];
    worker.kill('SIGTERM');
    this.workers.delete(pid);
    this.emit('scaled', 'down', this.workers.size);
  }

  public async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    const terminationPromises = Array.from(this.workers.values()).map(worker => {
      return new Promise<void>((resolve) => {
        worker.once('exit', () => resolve());
        worker.kill('SIGTERM');
      });
    });

    await Promise.all(terminationPromises);
    await this.workerManagerService.cleanup();
  }

  public getWorkerCount(): number {
    return this.workers.size;
  }
}