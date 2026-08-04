import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';
import trackingService from '../services/tracking.service.js';

class TrackingController {
    /**
     * POST /api/tracking/interno/posicion — llamado por api-app-mam
     * (servidor-a-servidor, protegido con protectInternalService) cada vez que
     * un muestreador reporta su ubicación GPS. La posición YA está guardada en
     * mam_ubicaciones_tracking por el lado api-app-mam; acá solo se difunde en
     * tiempo real a los supervisores conectados.
     */
    async recibirPosicion(req, res) {
        try {
            const { id_muestreador, id_jornada, lat, lon, timestamp } = req.body;

            if (!id_muestreador || !id_jornada || lat === undefined || lon === undefined) {
                return errorResponse(res, 'id_muestreador, id_jornada, lat y lon son requeridos', 400);
            }

            const payload = trackingService.broadcastPosicion({ id_muestreador, id_jornada, lat, lon, timestamp });
            return successResponse(res, payload, 'Posición difundida');
        } catch (err) {
            logger.error('Error in recibirPosicion controller:', err);
            return errorResponse(res, 'Error al procesar la posición', 500, err.message);
        }
    }

    /**
     * GET /api/tracking/hoy — snapshot inicial para la pantalla "Hoy en Vivo"
     * de un supervisor. Requiere el permiso AI_MA_HOY_EN_VIVO.
     */
    async getSnapshot(req, res) {
        try {
            const data = await trackingService.getSnapshotHoy();
            return successResponse(res, data, 'Snapshot obtenido');
        } catch (err) {
            logger.error('Error in getSnapshot controller:', err);
            return errorResponse(res, 'Error al obtener el snapshot de seguimiento', 500, err.message);
        }
    }
}

export default new TrackingController();
