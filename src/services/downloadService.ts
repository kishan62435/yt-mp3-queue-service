import ytdl from 'ytdl-core';
import fs from 'fs';
// import { pipeline } from 'stream/promises'; 
import * as youtubedl from 'youtube-dl-exec';
import path from 'path';
// import config from '../config/config';
import { VideoMetadata } from '../types';

export class DownloadService {
  async getVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
    try {
      const info = await ytdl.getInfo(videoUrl);
      return {
        title: info.videoDetails.title,
        duration: parseInt(info.videoDetails.lengthSeconds),
        author: info.videoDetails.author.name
      };
    } catch (error) {
      throw new Error(`Failed to get video metadata: ${error.message}`);
    }
  }

//   async downloadVideo(videoUrl: string, outputPath: string): Promise<string> {
//     try {
//       const videoStream = ytdl(videoUrl, {
//         quality: 'highestaudio',
//       });

//       const writeStream = fs.createWriteStream(outputPath);

//       return new Promise((resolve, reject) => {
//         videoStream.pipe(writeStream);
//         writeStream.on('finish', () => resolve(outputPath));
//         writeStream.on('error', reject);
//       });
//     } catch (error) {
//       throw new Error(`Download failed: ${error.message}`);
//     }
//   }
    // async downloadVideo(videoUrl: string, outputPath: string): Promise<string> {
    //     return new Promise<string>(async (resolve, reject) => {
    //     try {
    //         console.log('Starting download for:', videoUrl);
    //         console.log('Output path:', outputPath);

    //         // Verify the URL is valid
    //         if (!ytdl.validateURL(videoUrl)) {
    //         throw new Error('Invalid YouTube URL');
    //         }

    //         // Get video info first
    //         const videoInfo = await ytdl.getInfo(videoUrl);
    //         console.log('Video info retrieved:', videoInfo.videoDetails.title);


    //         // Create video stream with specific options
    //         const videoStream = ytdl(videoUrl, {
    //         quality: 'highestaudio',
    //         filter: 'audioonly',
    //         requestOptions: {
    //             headers: {
    //             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    //             }
    //         }
    //         });

    //         // Create write stream
    //         const writeStream = fs.createWriteStream(outputPath);

    //         // Handle video stream events
    //         videoStream.on('error', (error: Error) => {
    //         console.error('Error in video stream:', error);
    //         // Clean up the partial file
    //         if (fs.existsSync(outputPath)) {
    //             fs.unlinkSync(outputPath);
    //         }
    //         reject(new Error(`Video stream error: ${error.message}`));
    //         });

    //         videoStream.on('progress', (_chunkLength: number, downloaded: number, total: number) => {
    //         const percent = (downloaded / total * 100).toFixed(2);
    //         console.log(`Download progress: ${percent}%`);
    //         });

    //         // Handle write stream events
    //         writeStream.on('error', (error: Error) => {
    //         console.error('Error in write stream:', error);
    //         reject(new Error(`Write stream error: ${error.message}`));
    //         });

    //         writeStream.on('finish', () => {
    //         console.log('Download completed');
    //         // Verify file was actually written
    //         const stats = fs.statSync(outputPath);
    //         if (stats.size === 0) {
    //             fs.unlinkSync(outputPath);
    //             reject(new Error('Downloaded file is empty'));
    //         } else {
    //             resolve(outputPath);
    //         }
    //         });

    //         // Use pipeline with proper error handling
    //         try {
    //         await pipeline(videoStream, writeStream);
    //         console.log('Pipeline completed successfully');
    //         } catch (error: any) {
    //         console.error('Pipeline error:', error);
    //         reject(new Error(`Pipeline error: ${error.message}`));
    //         }

    //     } catch (error: any) {
    //         console.error('Download error:', error);
    //         // Clean up any partial file
    //         if (fs.existsSync(outputPath)) {
    //         fs.unlinkSync(outputPath);
    //         }
    //         reject(new Error(`Download failed: ${error.message}`));
    //     }
    //     });
    // }

    async downloadVideo(videoUrl: string, outputPath: string, quality: number): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                console.log('Starting download for:', videoUrl);
                console.log('Output path:', outputPath);
    
                // Ensure the output directory exists
                const dir = path.dirname(outputPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
    
                // Use youtube-dl-exec to download and convert to mp3
                const videoId = videoUrl.split('v=')[1]; // Extract video ID from URL
                const outputTemplate = path.join(outputPath, `${videoId}.%(ext)s`);
    
                await youtubedl.exec(videoUrl, {
                    format: 'bestaudio',
                    extractAudio: true,
                    audioFormat: 'mp3',
                    output: outputTemplate,
                    audioQuality: quality
                });
    
                console.log('Download completed successfully.');
                resolve(path.join(outputPath, `${videoId}.mp3`));
    
            } catch (error) {
                console.error('Download error:', error);
                reject(new Error(`Download failed: ${error.message}`));
            }
        });
    }
}