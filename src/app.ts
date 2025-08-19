// src/app.ts
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { MonitoringService } from './services/monitoringService';
import { QueueService } from './services/queueService';
import { errorHandler } from './middleware/errorHandler';
import converterRoutes from './routes/converterRoutes';
import path from 'path';
// import { WorkerManagerService } from './services/workerManagerService';
import config from './config/config';
import { WorkerScalingManager } from './services/workerScalingManager';

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Initialize services
const queueService = new QueueService();
const monitoringService = new MonitoringService([queueService.getQueue()]);
const workerScalingManager = new WorkerScalingManager();


// Middleware
app.use(cors());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
}));
app.use(express.json());

// Serve static files from storage/output directory
app.use('/downloads', express.static(path.join(__dirname, '../storage/output')));

app.use('/admin/queues', monitoringService.getRouter());

// Routes
app.get('/', (_req: Request, res: Response) => {
    res.send('YouTube to MP3 Converter API');
});

// app.get('/metrics', async (_req, res) => {
//     const workerManager = new WorkerManagerService();
//     const metrics = await workerManager.getWorkerMetrics();

//     Object.keys(metrics).forEach(workerId => {
//         const workerMetrics = metrics[workerId];
//         if (workerMetrics.lastActive) {
//           // Convert lastActive to integer if stored as string
//           const lastActiveTimestamp = typeof workerMetrics.lastActive === 'string'
//             ? parseInt(workerMetrics.lastActive, 10)
//             : workerMetrics.lastActive;
    
//           // Convert to a human-readable date
//           const lastActiveDate = new Date(lastActiveTimestamp);
//           workerMetrics.lastActive = lastActiveDate.toISOString().replace('T', ' ').replace(/\..+/, '');
//         }
//       });
//     res.json(metrics);
//   });
  
app.get('/metrics', async (_req, res) => {
    const metrics = await workerScalingManager.workerManagerService.getWorkerMetrics();
    const workerCount = workerScalingManager.getWorkerCount();

    Object.keys(metrics).forEach(workerId => {
        const workerMetrics = metrics[workerId];
        if (workerMetrics.lastActive) {
          const lastActiveTimestamp = typeof workerMetrics.lastActive === 'string'
            ? parseInt(workerMetrics.lastActive, 10)
            : workerMetrics.lastActive;
    
          const lastActiveDate = new Date(lastActiveTimestamp);
          workerMetrics.lastActive = lastActiveDate.toISOString().replace('T', ' ').replace(/\..+/, '');
        }
    });

    res.json({
        metrics,
        workerCount,
        maxWorkers: config.scaling.maxWorkers || workerScalingManager.workerManagerService.getRecommendedWorkerCount()
    });
});

// API routes
// console.log('app.ts');
app.use('/api', converterRoutes);

// Admin routes (monitoring dashboard)

// Error handler (should be after all routes)
app.use(errorHandler);


if (process.env.NODE_ENV !== 'test') {
    workerScalingManager.start().catch(error => {
        console.error('Failed to start worker scaling manager:', error);
        process.exit(1);
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('Shutting down...');
        await workerScalingManager.stop();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

// Start server
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        console.log(`Admin dashboard available at http://localhost:${port}/admin/queues`);
    });
}

export default app;