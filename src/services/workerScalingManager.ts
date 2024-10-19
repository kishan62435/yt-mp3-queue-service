import { WorkerManagerService } from './workerManagerService';
import { ConversionWorker, startWorker } from '../workers/conversionWorker';
import config from '../config/config';
import { EventEmitter } from 'events';

export class WorkerScalingManager extends EventEmitter {
  private workers: Map<string, ConversionWorker> = new Map();
  public workerManagerService: WorkerManagerService;
  private isScaling: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  

  constructor() {
    super();
    this.workerManagerService = new WorkerManagerService();
  }

  public async start(): Promise<void> {
    await this.workerManagerService.cleanupStaleWorkers();

    setInterval(() => {
        this.workerManagerService.cleanupStaleWorkers().catch(console.error);
      }, 60000);
    // Start initial workers
    const initialWorkerCount = Math.min(
      config.worker.concurrency,
      this.workerManagerService.getRecommendedWorkerCount()
    );

    console.log(`Starting ${initialWorkerCount} initial workers...`);
    
    for (let i = 0; i < initialWorkerCount; i++) {
      await this.startNewWorker();
    }

    // Start monitoring for auto-scaling
    this.startAutoScaling();
  }

  private async startNewWorker(): Promise<void> {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const worker = await startWorker(workerId);
      this.workers.set(workerId, worker);
      
      this.emit('workerStarted', workerId);
      console.log(`Worker ${workerId} started successfully`);
      
      return;
    } catch (error) {
      console.error(`Failed to start worker ${workerId}:`, error);
      throw error;
    }
  }

  private async startAutoScaling(): Promise<void> {
    this.checkInterval = setInterval(async () => {
      if (this.isScaling) return;
      
      try {
        this.isScaling = true;
        
        // const metrics = await this.workerManagerService.getWorkerMetrics();
        // const currentWorkerCount = this.workers.size;
        
        
        if (await this.workerManagerService.shouldScaleUp()) {
          console.log('Scaling up workers...');
          await this.scaleUp();
        } 
        // else if (await this.workerManagerService.shouldScaleDown()) {
        //   console.log('Scaling down workers...');
        //   await this.scaleDown();
        // }
      } catch (error) {
        console.error('Error during auto-scaling check:', error);
      } finally {
        this.isScaling = false;
      }
    }, config.scaling.scaleCheckInterval);
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

//   private async scaleDown(): Promise<void> {
//     try{
//         if (this.workers.size <= 1) {
//           console.log('Cannot scale down: minimum worker count reached');
//           return;
//         }
    
//         // Get the last worker and terminate it
//         const lastWorkerId = Array.from(this.workers.keys())[this.workers.size - 1];
//         const worker = this.workers.get(lastWorkerId);
        
//         if (worker) {
//           // Trigger the worker's graceful shutdown
//           process.kill(process.pid, 'SIGTERM');
//           this.workers.delete(lastWorkerId);
//           this.emit('scaled', 'down', this.workers.size);
//         }
//     }
//     catch(error){
//         console.log(error);
//         throw error;
//     }
//   }

  public async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Gracefully terminate all workers
    for (const [workerId, _worker] of this.workers) {
      process.kill(process.pid, 'SIGTERM');
      this.workers.delete(workerId);
    }

    await this.workerManagerService.cleanup();
  }

  public getWorkerCount(): number {
    return this.workers.size;
  }
}