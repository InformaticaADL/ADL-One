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

    /**
     * GET /api/tracking/historial?fecha_desde=YYYY-MM-DD&fecha_hasta=YYYY-MM-DD&id_muestreador=123
     * Historial de jornadas por día, dentro de "Hoy en Vivo" (pestaña
     * Historial). Mismo permiso que el snapshot en vivo — es la misma
     * pantalla, no una sección aparte con control de acceso propio.
     */
    async getHistorial(req, res) {
        try {
            const { fecha_desde, fecha_hasta, id_muestreador } = req.query;

            if (!fecha_desde || !fecha_hasta) {
                return errorResponse(res, 'fecha_desde y fecha_hasta son requeridos (YYYY-MM-DD)', 400);
            }
            const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;
            if (!formatoFecha.test(fecha_desde) || !formatoFecha.test(fecha_hasta)) {
                return errorResponse(res, 'fecha_desde y fecha_hasta deben tener formato YYYY-MM-DD', 400);
            }

            const data = await trackingService.getHistorialJornadas({
                fechaDesde: fecha_desde,
                fechaHasta: fecha_hasta,
                idMuestreador: id_muestreador ? Number(id_muestreador) : undefined,
            });
            return successResponse(res, data, 'Historial obtenido');
        } catch (err) {
            logger.error('Error in getHistorial controller:', err);
            return errorResponse(res, 'Error al obtener el historial de jornadas', 500, err.message);
        }
    }
}

export default new TrackingController();
