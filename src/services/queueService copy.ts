// src/services/queueService.ts
import Queue from 'bull';
import { DownloadService } from './downloadService';
// import { ConverterService } from './converterService';
import config from '../config/config';
import path from 'path';
import fs from 'fs';

export class QueueService {
  private queue: Queue.Queue;
  private downloadService: DownloadService;
  // private converterService: ConverterService;

  constructor() {
    // Simplified Redis configuration for local development
    this.queue = new Queue('audio-conversion', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        maxRetriesPerRequest: null, // Disable retry limit
        enableReadyCheck: false,
        reconnectOnError: function(err) {
          console.log('Redis reconnect error:', err);
          return true; // Try to reconnect on all errors
        }
      },
      settings: {
        lockDuration: 30000, // 30 seconds
        stalledInterval: 30000, // 30 seconds
        maxStalledCount: 1
      }
    });

    this.downloadService = new DownloadService();
    // this.converterService = new ConverterService();

    this.setupQueueProcessor();
    this.setupQueueEvents();
  }

  private setupQueueEvents() {
    // Monitor queue events
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
      console.error('Job failed:', job.id, error);
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
      console.log(config, 'the config values');
      const tempPath = path.join(config.storage.tempDir);
      const outputPath = path.join(config.storage.outputDir);
  
      try {
        // Ensure directories exist
        fs.mkdirSync(config.storage.tempDir, { recursive: true });
        fs.mkdirSync(config.storage.outputDir, { recursive: true });
  
        // Validate video URL first
        console.log('Validating video URL...');
        await job.progress(5);
        // const metadata = await this.downloadService.getVideoMetadata(videoUrl);
        // console.log('Video metadata:', metadata);
  
        // Start download
        console.log('Starting video download...');
        await job.progress(10);
        const downloadedPath = await this.downloadService.downloadVideo(videoUrl, outputPath, quality);
        console.log(downloadedPath);
        // Verify downloaded file
        if (!fs.existsSync(downloadedPath) || fs.statSync(downloadedPath).size === 0) {
          throw new Error('Download failed: Empty or missing file');
        }
        
        // console.log('Download completed, starting conversion...');
        // await job.progress(50);
        // await this.converterService.convertToMp3(downloadedPath, outputPath, quality);
        
        // await job.progress(90);
        
        // // Cleanup temp file
        // if (fs.existsSync(tempPath)) {
        //   fs.unlinkSync(tempPath);
        // }
  
        console.log('Processing completed successfully');
        await job.progress(100);
        
        return { 
          outputPath,
        };
      } catch (error) {
        console.error('Job processing error:', error);
        
        // Cleanup on error
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        
        throw new Error(`Processing failed: ${error.message}`);
      }
    });
  }
  
  async addToQueue(videoUrl: string, quality: number): Promise<{ videoLink: string, metadata: any }> {
    try {
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
          removeOnComplete: false, // Keep completed jobs for tracking
          removeOnFail: false // Keep failed jobs for debugging
        }
      );
      
      console.log('Job added successfully:', job.id);
      // return job.id.toString();
      const result = await job.finished();

      // Return the result, which should include the video link
      return {
        videoLink: result.outputPath,  // Assuming outputPath contains the final file link
        metadata: result.metadata       // Any additional metadata you want to send back
      };
    } catch (error) {
      console.error('Error adding job to queue:', error);
      throw new Error('Failed to add job to queue: ' + error.message);
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

  // Utility method to clean up completed jobs
  async cleanupOldJobs() {
    try {
      const completedJobs = await this.queue.getCompleted();
      for (const job of completedJobs) {
        if (Date.now() - job.timestamp > 24 * 60 * 60 * 1000) { // Older than 24 hours
          await job.remove();
        }
      }
    } catch (error) {
      console.error('Error cleaning up old jobs:', error);
    }
  }
}