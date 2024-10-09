import ffmpeg from 'fluent-ffmpeg';
// import path from 'path';
// import config from '../config/config';

export class ConverterService {
  async convertToMp3(
    inputPath: string,
    outputPath: string,
    quality: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioBitrate(quality)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }
}