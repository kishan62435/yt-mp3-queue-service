// src/middleware/errorHandler.ts
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message
    });
  }

  console.error('Unhandled error:', err);
  
  res.status(500).json({
    error: 'Internal server error'
  });
};