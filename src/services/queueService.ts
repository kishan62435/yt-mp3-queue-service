// src/services/queueService.ts

import Queue from 'bull';
import { DownloadService } from './downloadService';
import config from '../config/config';
import path from 'path';
import fs from 'fs';
// import { AppError } from '../middleware/errorHandler';

export class QueueService {
  private static instance: QueueService;
  private queue: Queue.Queue;
  private downloadService: DownloadService;

  constructor() {
    this.queue = new Queue('audio-conversion', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        reconnectOnError: function(err) {
          console.log('Redis reconnect error:', err);
          return true;
        }
      },
      settings: {
        lockDuration: 300000, // 5 minutes
        stalledInterval: 30000,
        maxStalledCount: 1
      },
      limiter: {
        max: config.worker.rateLimit.max,
        duration: config.worker.rateLimit.duration,
      }
    });

    this.downloadService = new DownloadService();
    this.setupQueueProcessor();
    this.setupQueueEvents();
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  private setupQueueEvents() {
    this.queue.on('error', (error) => {
      console.error('Queue error:', error);
    });

    this.queue.on('waiting', (jobId) => {
      console.log('Job waiting:', jobId);
    });

    this.queue.on('active', (job) => {
      console.log('Job started:', job.id);
    });

    this.queue.on('completed', (job, result) => {
      console.log('Job completed:', job.id, result);
    });

    this.queue.on('failed', (job, error) => {
      console.error('Job failed:', job?.id, error);
    });

    this.queue.on('stalled', (job) => {
      console.warn('Job stalled:', job.id);
    });
  }

  public getQueue(): Queue.Queue {
    return this.queue;
  }

  private setupQueueProcessor() {
    this.queue.process(async (job) => {
      console.log('Processing job:', job.id);
      const { videoUrl, quality } = job.data;
      const outputPath = path.join(config.storage.outputDir);

      try {
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
          return {status: 400, message: 'Video duration exceeds maximum allowed length'}
        }
        fs.mkdirSync(config.storage.outputDir, { recursive: true });

        // Start download and conversion
        await job.progress(10);
        const downloadedPath = await this.downloadService.downloadVideo(videoUrl, outputPath, quality);

        // Verify downloaded file
        if (!fs.existsSync(downloadedPath) || fs.statSync(downloadedPath).size === 0) {
          throw new Error('Download failed: Empty or missing file');
        }

        await job.progress(100);
        
        return {
          status: 200,
          message: 'Conversion completed successfully',
          outputPath: downloadedPath,
          metadata: {
            quality,
            convertedAt: new Date().toISOString()
          }
        };
      } catch (error) {
          console.error('Job processing error:', error);
          throw new Error(`Processing failed: ${error.message}`);
      }
    });
  }

  async addToQueue(videoUrl: string, quality: number): Promise<{ status: number, message:string, videoLink: string, metadata: any }> {
    try {
      // Get active job count
      const activeCount = await this.queue.getActiveCount();
      const waitingCount = await this.queue.getWaitingCount();
      
      // Implement basic load shedding
      if (activeCount + waitingCount >= config.queue.maxConcurrentJobs) {
        throw new Error('Server is currently at capacity. Please try again later.');
      }

      console.log('Adding job to queue:', { videoUrl, quality });
      const job = await this.queue.add(
        {
          videoUrl,
          quality
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: true,
          removeOnFail: true,
          timeout: 300000 // 5 minute timeout
        }
      );

      // Wait for job completion
      const result = await job.finished();
      const videoLink = result.status == 200 ? result.outputPath.replace(config.storage.outputDir, '/static') : null;

      return {
        status: result.status,
        message: result.message,
        videoLink,
        metadata: result.metadata
      };
    } catch (error) {
      console.error('Error processing conversion:', error);
      if(error.code == 400){
        throw error;
      }
      else{
        throw new Error('Conversion failed: ' + error.message);
      }
    }
  }

}
// async getJobStatus(jobId: string) {
//   try {
//     const job = await this.queue.getJob(jobId);
//     if (!job) {
//       throw new Error('Job not found');
//     }
    
//     const state = await job.getState();
//     const progress = await job.progress();
    
//     return {
//       id: job.id,
//       state,
//       progress,
//       data: job.data,
//       timestamp: job.timestamp
//     };
//   } catch (error) {
//     console.error('Error getting job status:', error);
//     throw new Error('Failed to get job status: ' + error.message);
//   }
// }