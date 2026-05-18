import auditService from '../services/audit.service.js';
import logger from '../utils/logger.js';

// Routes that have explicit audit calls in their controllers — skip these to avoid duplicates
const EXPLICITLY_AUDITED_ROUTES = [
    { method: 'POST', pattern: /^\/api\/auth\/login/ },
    { method: 'POST', pattern: /^\/api\/auth\/change-password/ },
    { method: 'POST', pattern: /^\/api\/rbac\/roles$/ },
    { method: 'PUT',  pattern: /^\/api\/rbac\/roles\/\d+$/ },
    { method: 'PUT',  pattern: /^\/api\/rbac\/roles\/\d+\/status$/ },
    { method: 'POST', pattern: /^\/api\/rbac\/roles\/\d+\/permissions/ },
    { method: 'POST', pattern: /^\/api\/rbac\/users\/\d+\/roles/ },
    { method: 'POST', pattern: /^\/api\/rbac\/users\/create/ },
    { method: 'PUT',  pattern: /^\/api\/rbac\/users\/\d+$/ },
    { method: 'PUT',  pattern: /^\/api\/rbac\/users\/\d+\/password/ },
    { method: 'PUT',  pattern: /^\/api\/rbac\/users\/\d+\/status/ },
    { method: 'POST', pattern: /^\/api\/notifications\/config/ },
    // Fichas — audited in ficha.service.js
    { method: 'POST', pattern: /^\/api\/fichas/ },
    { method: 'PUT',  pattern: /^\/api\/fichas\/\d+\/(approve|reject|comercial|asignar)/ },
    // Solicitudes — audited in solicitud.service.js
    { method: 'POST', pattern: /^\/api\/solicitudes/ },
    { method: 'PUT',  pattern: /^\/api\/solicitudes\/\d+\/(revisar|derivar|resolver)/ },
];

const isExplicitlyAudited = (method, path) =>
    EXPLICITLY_AUDITED_ROUTES.some(r => r.method === method && r.pattern.test(path));

// Derive a human-readable action description from method + path
const describeAction = (method, path) => {
    const clean = path.replace(/\/\d+/g, '/{id}');
    return `${method} ${clean}`;
};

const deriveAreaKey = (path) => {
    if (path.includes('/fichas') || path.includes('/medio-ambiente') || path.includes('/rutas')) return 'coordinacion';
    if (path.includes('/rbac') || path.includes('/auth') || path.includes('/notifications')) return 'it';
    if (path.includes('/solicitudes') || path.includes('/urs')) return 'urs';
    if (path.includes('/chat')) return 'chat';
    return 'it';
};

/**
 * Middleware that captures write operations (POST/PUT/DELETE) not already
 * handled by explicit audit calls in controllers/services. Uses res.json()
 * interception to know the final HTTP status before logging.
 */
export const auditMiddleware = (req, res, next) => {
    const { method, path } = req;

    // Only intercept write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

    // Skip if this route has explicit audit
    if (isExplicitlyAudited(method, path)) return next();

    // Skip unauthenticated requests — no actor to log
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        // Only audit after response is determined, and only for authenticated users
        const userId = req.user?.id || req.user?.id_usuario;
        if (userId && res.statusCode < 400) {
            try {
                auditService.log({
                    usuario_id: userId,
                    area_key: deriveAreaKey(path),
                    modulo_nombre: 'HTTP Write',
                    evento_tipo: `HTTP_${method}`,
                    entidad_nombre: path.split('/').filter(Boolean).slice(1, 3).join('/'),
                    entidad_id: req.params?.id || req.params?.userId || req.params?.fichaId || '-',
                    descripcion_humana: `${req.user?.nombre_usuario || `ID:${userId}`} → ${describeAction(method, path)}`,
                    datos_nuevos: method !== 'DELETE' ? req.body : null,
                    severidad: method === 'DELETE' ? 2 : 1
                });
            } catch (err) {
                logger.warn('[AuditMiddleware] Failed to log:', err.message);
            }
        }
        return originalJson(body);
    };

    next();
};
