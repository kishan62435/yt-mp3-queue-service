// src/app.ts
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
// import { MonitoringService } from './services/monitoringService';
// import { QueueService } from './services/queueService';
import { errorHandler } from './middleware/errorHandler';
import converterRoutes from './routes/converterRoutes';
import path from 'path';

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Initialize services
// const queueService = new QueueService();
// const monitoringService = new MonitoringService([queueService.getQueue()]);

// Middleware
app.use(cors());
// app.use(helmet());
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

// app.use('/admin/queues', monitoringService.getRouter());

// Routes
app.get('/', (_req: Request, res: Response) => {
    res.send('YouTube to MP3 Converter API');
});

// API routes
// console.log('app.ts');
app.use('/api', converterRoutes);

// Admin routes (monitoring dashboard)

// Error handler (should be after all routes)
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        console.log(`Admin dashboard available at http://localhost:${port}/admin/queues`);
    });
}

export default app;