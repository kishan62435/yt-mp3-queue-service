// src/middleware/validator.ts
import { Request, Response, NextFunction } from 'express';
import ytdl from 'ytdl-core';
import config from '../config/config';

export const validateConversionRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
):Promise<void> => {
  const { videoUrl, quality } = req.body;

  if (!videoUrl) {
    res.status(400).json({ error: 'Video URL is required' });
    return;
  }

  if (!ytdl.validateURL(videoUrl)) {
    res.status(400).json({ error: 'Invalid YouTube URL' });
    return;
  }

  if (quality && !config.conversion.allowedQualities.includes(quality)) {
    res.status(400).json({ 
      error: `Invalid quality. Allowed values: ${config.conversion.allowedQualities.join(', ')}` 
    });
    return;
  }

  next();
};
