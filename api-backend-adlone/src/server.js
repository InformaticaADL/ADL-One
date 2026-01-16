import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { getConnection } from './config/database.js';
import logger from './utils/logger.js';
import { requestLogger } from './middlewares/logger.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware.js';

// Import routes
import healthRoutes from './routes/health.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8002;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(helmet());
app.use(requestLogger);

// CORS Configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRoutes);

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
            logger.info(`🔐 JWT: ${process.env.JWT_SECRET ? 'Configured' : 'Not configured'}`);
            logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        });
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
