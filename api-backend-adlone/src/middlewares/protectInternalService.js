import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Protege endpoints destinados a llamadas servidor-a-servidor (api-app-mam ->
 * ADL ONE Web), distintas de los endpoints de usuario web (authenticate, que
 * exige un JWT de sesión de un usuario logueado). Se valida una clave
 * compartida fija en vez de un JWT porque el llamador es otro backend, no un
 * usuario autenticado. Mismo contrato y mismo valor de INTERNAL_API_KEY que
 * ya usa api-app-mam para el sentido inverso (regeneración de FoMa/Cadena).
 */
export const protectInternalService = (req, res, next) => {
    const key = req.headers['x-internal-key'];
    if (!process.env.INTERNAL_API_KEY) {
        logger.error('INTERNAL_API_KEY no está configurada en .env');
        return errorResponse(res, 'Servicio mal configurado.', 500);
    }
    if (!key || key !== process.env.INTERNAL_API_KEY) {
        return errorResponse(res, 'Clave interna inválida o ausente.', 401);
    }
    next();
};
