import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Global error handler middleware
 * Catches all errors and sends standardized error responses
 */
export const errorHandler = (err, req, res, next) => {
    // Log error
    logger.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
    });

    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
    } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Unauthorized';
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        message = 'Forbidden';
    } else if (err.name === 'NotFoundError') {
        statusCode = 404;
        message = 'Not Found';
    }

    // Send error response
    return errorResponse(
        res,
        message,
        statusCode,
        process.env.NODE_ENV === 'development' ? { stack: err.stack } : null
    );
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res) => {
    return errorResponse(res, `Route ${req.originalUrl} not found`, 404);
};
