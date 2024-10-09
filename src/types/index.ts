export interface ConversionJob {
    id: string;
    videoUrl: string;
    quality: string;
    outputFormat: 'mp3';
    status: 'pending' | 'processing' | 'completed' | 'failed';
  }
  
  export interface VideoMetadata {
    title: string;
    duration: number;
    author: string;
  }
  
  export interface ConversionResult {
    jobId: string;
    downloadUrl: string;
    expiresAt: Date;
  }