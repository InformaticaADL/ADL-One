import jwt from 'jsonwebtoken';
import { getUserAuthState, invalidatePermVersionCache } from '../utils/permVersionCache.js';
import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
export const authenticate = async (req, res, next) => {
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

        // Verify token signature and expiry
        let decoded;
        try {
            const secret = process.env.JWT_SECRET;
            decoded = jwt.verify(token, secret);
        } catch (verifyError) {
            logger.error(`Auth Middleware: JWT Verification Error: ${verifyError.message}`);
            if (verifyError.name === 'JsonWebTokenError') {
                return errorResponse(res, 'Invalid token', 401);
            } else if (verifyError.name === 'TokenExpiredError') {
                return errorResponse(res, 'Token expired', 401);
            }
            throw verifyError;
        }

        // RB-04 / RB-07: Verificar permisos_version y estado habilitado en cada request (cache TTL=5s).
        try {
            const dbUser = await getUserAuthState(decoded.id);
            if (!dbUser) {
                return errorResponse(res, 'Sesión inválida: usuario no encontrado', 401);
            }

            // RB-04: usuario deshabilitado → forzar logout
            if (dbUser.habilitado === 'N' || dbUser.habilitado === false) {
                invalidatePermVersionCache(decoded.id);
                return errorResponse(res, 'Tu cuenta fue deshabilitada por un administrador', 401);
            }

            // RB-07: permisos cambiaron → forzar re-login para refrescar el JWT
            const dbVersion = dbUser.permisos_version ?? 0;
            if (decoded.permisos_version !== undefined && dbVersion !== decoded.permisos_version) {
                invalidatePermVersionCache(decoded.id);
                return errorResponse(res, 'Sesión expirada por cambio de permisos', 401);
            }
        } catch (dbErr) {
            // No fatal: si BD no responde, dejar pasar (no romper el sistema entero)
            logger.warn(`Auth Middleware: Could not verify habilitado/permisos_version for user ${decoded.id}: ${dbErr.message}`);
        }

        req.user = decoded;
        next();
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
