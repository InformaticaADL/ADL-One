import morgan from 'morgan';
import logger from '../utils/logger.js';

// Custom token for response time in milliseconds
morgan.token('response-time-ms', (req, res) => {
    if (!req._startAt || !res._startAt) {
        return '';
    }
    const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
        (res._startAt[1] - req._startAt[1]) * 1e-6;
    return ms.toFixed(3);
});

// Custom format
const morganFormat = ':method :url :status :response-time-ms ms - :res[content-length]';

// Stream to winston logger
const stream = {
    write: (message) => {
        logger.info(message.trim());
    },
};

// Morgan middleware with winston integration
export const requestLogger = morgan(morganFormat, { stream });

// Detailed request logger for development
export const detailedRequestLogger = (req, res, next) => {
    logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        body: req.body,
        query: req.query,
        params: req.params,
    });
    next();
};
