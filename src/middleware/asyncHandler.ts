// src/middleware/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler => {
//     return (req, res, next) => {
//       Promise.resolve(fn(req, res, next)).catch(next);
//     };
//   };
// export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
//     return (req: Request, res: Response, next: NextFunction) => {
//         return Promise.resolve(fn(req, res, next)).catch(next);
//     };
// };