import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Protege endpoints destinados a llamadas servidor-a-servidor desde
 * ADL WEB GO (WebClientesV2) hacia ADL ONE — p.ej. cuando el cliente sube
 * su OC/HES en el portal y WebClientesV2 lo reenvía aquí. Clave propia,
 * distinta de INTERNAL_API_KEY (esa es la relación con ADL SAMPLING): cada
 * sistema externo tiene su propio secreto, para no propagar un leak entre
 * integraciones que no tienen nada que ver entre sí.
 */
export const protectWebClientesService = (req, res, next) => {
    const key = req.headers['x-webclientes-key'];
    if (!process.env.WEBCLIENTES_INBOUND_KEY) {
        logger.error('WEBCLIENTES_INBOUND_KEY no está configurada en .env');
        return errorResponse(res, 'Servicio mal configurado.', 500);
    }
    if (!key || key !== process.env.WEBCLIENTES_INBOUND_KEY) {
        return errorResponse(res, 'Clave de ADL WEB GO inválida o ausente.', 401);
    }
    next();
};
