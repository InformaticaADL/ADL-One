import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response.js';

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
export const authenticate = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse(res, 'No token provided', 401);
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user info to request
        req.user = decoded;

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return errorResponse(res, 'Invalid token', 401);
        } else if (error.name === 'TokenExpiredError') {
            return errorResponse(res, 'Token expired', 401);
        }
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
