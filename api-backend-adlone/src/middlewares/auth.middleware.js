import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
export const authenticate = (req, res, next) => {
    try {
        // Get token from header or query string (for direct downloads)
        let token = null;
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            logger.warn('Auth Middleware: No token provided');
            return errorResponse(res, 'No token provided', 401);
        }

        // Verify token
        try {
            const secret = process.env.JWT_SECRET;
            const decoded = jwt.verify(token, secret);
            // Attach user info to request
            req.user = decoded;
            next();
        } catch (verifyError) {
            logger.error(`Auth Middleware: JWT Verification Error: ${verifyError.message}`);

            if (verifyError.name === 'JsonWebTokenError') {
                return errorResponse(res, 'Invalid token', 401);
            } else if (verifyError.name === 'TokenExpiredError') {
                return errorResponse(res, 'Token expired', 401);
            }
            throw verifyError;
        }
    } catch (error) {
        logger.error('Auth Middleware: General error:', error);
        return errorResponse(res, 'Authentication failed', 401);
    }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if no token
 */
export const optionalAuthenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }

        next();
    } catch (error) {
        // Continue without user
        next();
    }
};

/**
 * Role-based authorization middleware
 * @param {Array<string>} roles - Allowed roles
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, 'Unauthorized', 401);
        }

        if (!roles.includes(req.user.role)) {
            return errorResponse(res, 'Forbidden - Insufficient permissions', 403);
        }

        next();
    };
};
