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
import { contextMiddleware } from './middlewares/context.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import healthRoutes from './routes/health.routes.js';
import catalogosRoutes from './routes/catalogos.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import fichaRoutes from './routes/ficha.routes.js';
import authRoutes from './routes/auth.routes.js';
import rbacRoutes from './routes/rbac.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import ursRoutes from './routes/urs.routes.js';
import unsRoutes from './routes/notificacion.routes.js';
import userRoutes from './routes/user.routes.js';
import chatRoutes from './routes/chat.routes.js';
import generalChatRoutes from './routes/general-chat.routes.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Hacer io accesible globalmente
global.io = io;

io.on('connection', (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        logger.info(`User ${userId} joined their notification room`);
    });

    socket.on('disconnect', () => {
        logger.info('Client disconnected');
    });

    // General Chat: join/leave conversation rooms
    socket.on('joinChat', (conversationId) => {
        socket.join(`chat_${conversationId}`);
    });

    socket.on('leaveChat', (conversationId) => {
        socket.leave(`chat_${conversationId}`);
    });
});
import { initScheduler } from './utils/scheduler.js';

// Initialize Scheduler
initScheduler();

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Global Middlewares
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(contextMiddleware);
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
app.use('/api/upload', uploadRoutes);
app.use('/api/urs', ursRoutes);
app.use('/api/uns', unsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gchat', generalChatRoutes);

// Serve uploads directory as static
const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadPath));

// Serve fotos directory as static
const fotosPath = process.env.RUTA_FOTOS || 'C:\\Users\\vremolcoy\\Documents\\FOTOS APP';
app.use('/fotos', express.static(fotosPath));

// Serve profile pictures and avatars from custom path if defined
const profilePicsPath = process.env.PROFILE_PICS_PATH;
if (profilePicsPath) {
    app.use('/uploads/profile_pics', express.static(profilePicsPath));
    app.use('/uploads/avatars', express.static(profilePicsPath));
}

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

        httpServer.listen(PORT, HOST, () => {
            logger.info('\n🚀 ADL One Backend Server Started!');
            logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            logger.info(`📡 Server running on:`);
            logger.info(`   - Local:    http://localhost:${PORT}`);
            logger.info(`   - Network:  http://192.168.10.68:${PORT}`);
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
