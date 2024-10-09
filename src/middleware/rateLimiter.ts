// src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import config from '../config/config';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too many requests, please try again later.'
  }
});