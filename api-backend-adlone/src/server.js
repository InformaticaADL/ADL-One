import dotenv from 'dotenv';
// Initialize dotenv at the very beginning
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { getConnection } from './config/database.js';
import logger from './utils/logger.js';
import { requestLogger } from './middlewares/logger.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware.js';

// Import routes
import healthRoutes from './routes/health.routes.js';
import catalogosRoutes from './routes/catalogos.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import fichaRoutes from './routes/ficha.routes.js';
import authRoutes from './routes/auth.routes.js';
import rbacRoutes from './routes/rbac.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notificationRoutes from './routes/notification.routes.js';

const app = express();
import { initScheduler } from './utils/scheduler.js';

// Initialize Scheduler
initScheduler();

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Global Middlewares
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/fichas', fichaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: '🚀 ADL One API - Backend Server',
        version: '1.0.0',
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            health: '/api/health',
        },
    });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Try to test database connection
        try {
            await getConnection();
            logger.info('✅ Database connection successful');
        } catch (dbError) {
            logger.warn('⚠️  Database connection failed - server will start without database');
            logger.warn(`   Error: ${dbError.message}`);
        }

        app.listen(PORT, HOST, () => {
            logger.info('\n🚀 ADL One Backend Server Started!');
            logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            logger.info(`📡 Server running on:`);
            logger.info(`   - Local:    http://localhost:${PORT}`);
            logger.info(`   - Network:  http://192.168.10.152:${PORT}`);
            logger.info(`   - Network:  http://192.168.10.68:${PORT}`);
            logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`📊 Database: ${process.env.DB_DATABASE || 'Not configured'}`);
            const secret = process.env.JWT_SECRET;
            logger.info(`🔐 JWT Status: ${secret ? 'Configured' : 'Not configured'} (Length: ${secret ? secret.length : 0})`);
            logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        });
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
