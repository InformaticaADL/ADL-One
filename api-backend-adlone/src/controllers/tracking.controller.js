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
            // La UI ya evita esto con minDate/maxDate cruzados en los date
            // pickers, pero el endpoint es invocable directo — sin este check
            // un rango invertido llega tal cual al BETWEEN de SQL (que
            // simplemente no matchea nada, no truena, pero es mejor devolver
            // un 400 claro que un array vacío sin explicación).
            if (fecha_desde > fecha_hasta) {
                return errorResponse(res, 'fecha_desde no puede ser posterior a fecha_hasta', 400);
            }
            // Tope de amplitud: un rango de 1 año trae TODOS los puntos GPS de
            // todas las jornadas del período a memoria solo para sumar km
            // (ver getHistorialJornadas) — 92 días (~3 meses) cubre cualquier
            // uso real (rendición mensual, revisión trimestral) sin abrir la
            // puerta a una consulta arbitrariamente pesada.
            const unDiaMs = 24 * 60 * 60 * 1000;
            const diasDeRango = (new Date(fecha_hasta) - new Date(fecha_desde)) / unDiaMs;
            if (diasDeRango > 92) {
                return errorResponse(res, 'El rango no puede superar 92 días — acota la búsqueda', 400);
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
