// src/controllers/converterController.ts

import { Request, Response, NextFunction } from 'express';
import { QueueService } from '../services/queueService';
// import { DownloadService } from '../services/downloadService';
import { AppError } from '../middleware/errorHandler';
// import config from '../config/config';

export class ConverterController {
  private queueService: QueueService;
  // private downloadService: DownloadService;

  constructor() {
    this.queueService = new QueueService();
    // this.downloadService = new DownloadService();
  }

  async startConversion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { videoUrl, quality } = req.body;
      console.log(req.body, 'videoUrl, quality');
      // Validate video metadata first
      // const metadata = await this.downloadService.getVideoMetadata(videoUrl);
      
      // if(metadata.duration == 0){
      //   res.status(400).json({
      //     error: "Live streams and Premieres are not allowed"
      //   });
      //   return;
      // }
      // if (metadata.duration > config.conversion.maxDuration) {
      //   res.status(400).json({
      //     error: 'Video duration exceeds maximum allowed length'
      //   });
      //   return;
      // }

      // Process conversion
      const result = await this.queueService.addToQueue(videoUrl, quality);

      if(result.status == 200){
        res.json({
          message: 'Conversion completed successfully',
          videoLink: result.videoLink,
          metadata: {
            ...result.metadata,
            // duration: metadata.duration
          }
        });
      }
      else{
        res.status(400).json({
          error: result.message
        });
      }
    } catch (error) {
      if (!res.headersSent) {
          next(new AppError(500, error.message));
      }
    }
  }

  // async getStatus(req: Request, res: Response, next: NextFunction) {
  //   try {
  //     const { jobId } = req.params;
  //     const status = await this.queueService.getJobStatus(jobId);
  //     res.json({ status });
  //   } catch (error) {
  //   //   res.status(404).json({ error: error.message });
  //       next(new AppError(500, error.message));

  //   }
  // }
}