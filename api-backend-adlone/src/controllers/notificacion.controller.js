import unsService from '../services/uns.service.js';
import logger from '../utils/logger.js';

class NotificacionController {
    async getMyNotifications(req, res) {
        try {
            // El token JWT usa 'id' para el identificador del usuario
            // Logueamos req.user completo para estar 100% seguros si algo falla
            const idUsuario = req.user.id || req.user.id_usuario;
            const { soloNoLeidas } = req.query;
            const notificaciones = await unsService.getUserNotifications(idUsuario, soloNoLeidas !== 'false');
            
            // Map for frontend compatibility (fecha_creacion -> fecha)
            const mappedNotifs = notificaciones.map(n => ({
                ...n,
                fecha: n.fecha_creacion
            }));

            logger.info(`[UNS] Fetch: Usuario ID ${idUsuario} (del token: ${req.user.id}) obtuvo ${mappedNotifs.length} notificaciones`);
            
            res.json(mappedNotifs);
        } catch (error) {
            logger.error('Error in NotificacionController.getMyNotifications:', error);
            res.status(500).json({ error: 'Error al obtener notificaciones' });
        }
    }

    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const result = await unsService.markAsRead(id);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Error al marcar como leída' });
        }
    }

    async markAsReadByRef(req, res) {
        try {
            const idUsuario = req.user.id || req.user.id_usuario;
            const { idReferencia } = req.params;
            const result = await unsService.markAsReadByReference(idUsuario, idReferencia);
            res.json(result);
        } catch (error) {
            logger.error('Error in NotificacionController.markAsReadByRef:', error);
            res.status(500).json({ error: 'Error al marcar notificaciones como leídas' });
        }
    }
}

export default new NotificacionController();
