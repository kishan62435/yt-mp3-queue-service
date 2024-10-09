// src/services/cleanupService.ts
import fs from 'fs';
import path from 'path';
import config from '../config/config';

export class CleanupService {
  private readonly tempDir: string;
  private readonly outputDir: string;
  private readonly maxAge: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.tempDir = config.storage.tempDir;
    this.outputDir = config.storage.outputDir;
  }

  public startCleanupJob() {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  private async cleanup() {
    try {
      await this.cleanDirectory(this.tempDir);
      await this.cleanDirectory(this.outputDir);
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  private async cleanDirectory(directory: string) {
    const files = await fs.promises.readdir(directory);
    const now = Date.now();

    for (const file of files) {
      if (file === '.gitkeep') continue;

      const filePath = path.join(directory, file);
      const stats = await fs.promises.stat(filePath);

      if (now - stats.mtimeMs > this.maxAge) {
        await fs.promises.unlink(filePath);
        console.log(`Deleted old file: ${filePath}`);
      }
    }
  }

  // Call this method when a conversion fails to clean up any temporary files
  public async cleanupFailedJob(jobId: string) {
    const tempFile = path.join(this.tempDir, `${jobId}.mp4`);
    const outputFile = path.join(this.outputDir, `${jobId}.mp3`);

    try {
      if (fs.existsSync(tempFile)) {
        await fs.promises.unlink(tempFile);
      }
      if (fs.existsSync(outputFile)) {
        await fs.promises.unlink(outputFile);
      }
    } catch (error) {
      console.error(`Failed to cleanup files for job ${jobId}:`, error);
    }
  }
}