// src/routes/converterRoutes.ts
import { Router } from 'express';
import { ConverterController } from '../controllers/converterController';
import { validateConversionRequest } from '../middleware/validator';
import { rateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const converterController = new ConverterController();

// Add async handler middleware to handle promise rejections
router.post(
    '/convert',
    rateLimiter,
    validateConversionRequest,
    asyncHandler(converterController.startConversion.bind(converterController))
);

// router.get(
//     '/status/:jobId',
//     rateLimiter,
//     asyncHandler(converterController.getStatus.bind(converterController))
// );

// router.get(
//     '/download/:jobId',
//     rateLimiter,
//     asyncHandler(converterController.downloadFile.bind(converterController))
// );

export default router;
