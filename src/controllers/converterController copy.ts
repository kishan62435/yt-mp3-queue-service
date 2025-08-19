import { Request, Response, NextFunction } from 'express';
import { QueueService } from '../services/queueService';
import { DownloadService } from '../services/downloadService';
import config from '../config/config';
import { AppError } from '../middleware/errorHandler';

export class ConverterController {
  private queueService: QueueService;
  private downloadService: DownloadService;

  constructor() {
    this.queueService = new QueueService();
    this.downloadService = new DownloadService();
  }

  async startConversion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { videoUrl, quality } = req.body;

      // Validate video
      const metadata = await this.downloadService.getVideoMetadata(videoUrl);
      if (metadata.duration > config.conversion.maxDuration) {
        console.log('a lot more than max duration');
        res.status(400).json({
          error: 'Video duration exceeds maximum allowed length'
        });
      }
      else console.log(metadata.duration > config.conversion.maxDuration);

      // Add to queue
      const result = await this.queueService.addToQueue(videoUrl, quality);

      console.log(result);
      res.json({
        message: 'Conversion completed successfully',
        videoLink: result.videoLink,
        metadata: result.metadata
      });
    } catch (error) {
        console.log(error, 'the error');
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