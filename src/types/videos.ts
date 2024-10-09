export interface VideoMetadata {
    title: string;
    duration: number;
  }
  
  export interface DownloadProgress {
    percent: number;
    downloaded: number;
    total: number;
  }
  
  export interface ConversionOptions {
    quality: string;
    format: string;
  }