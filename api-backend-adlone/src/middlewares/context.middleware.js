
import { randomUUID } from 'crypto';
import { requestContext } from '../utils/context.js';

/**
 * Middleware that initializes the request context for each incoming request.
 */
export const contextMiddleware = (req, res, next) => {
    // Generate or capture Trace ID
    const traceId = req.headers['x-trace-id'] || req.headers['x-correlation-id'] || randomUUID();
    
    // Get IP - Improved detection for proxies
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
               req.headers['x-real-ip'] || 
               req.ip || 
               req.connection?.remoteAddress || 
               '0.0.0.0';

    // Store in context
    const context = {
        traceId,
        ip,
        method: req.method,
        path: req.path,
        user: req.user || null,
        userAgent: req.headers['user-agent'] || 'Unknown'
    };

    // Run the rest of the request within this context
    requestContext.run(context, () => {
        // Also attach traceId to response for debugging
        res.setHeader('X-Trace-Id', traceId);
        next();
    });
};
