import solicitudService from '../services/solicitud.service.js';
import logger from '../utils/logger.js';

class SolicitudController {
    async create(req, res) {
        try {
            const { tipo_solicitud, datos_json } = req.body;
            const usuario_solicita = req.user?.id;

            if (!usuario_solicita) {
                return res.status(401).json({ message: 'Usuario no identificado' });
            }

            const result = await solicitudService.create({
                tipo_solicitud,
                datos_json,
                usuario_solicita
            });

            res.status(201).json(result);
        } catch (error) {
            logger.error('Controller Error creating solicitud:', error);
            res.status(500).json({ message: 'Error al crear la solicitud' });
        }
    }

    async getAll(req, res) {
        try {
            const filters = {
                estado: req.query.estado,
                usuario_solicita: req.query.solo_mias === 'true' ? req.user?.id : null,
                usuario_excluir: req.query.excluir_mias === 'true' ? req.user?.id : null
            };


            const solicitudes = await solicitudService.getSolicitudes(filters);
            res.json(solicitudes);
        } catch (error) {
            logger.error('Controller Error fetching solicitudes:', error);
            res.status(500).json({ message: 'Error al obtener las solicitudes' });
        }
    }

    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { estado, feedback_admin, datos_json } = req.body;
            const adminId = req.user?.id;

            const result = await solicitudService.updateStatus(id, estado, feedback_admin, adminId, datos_json);
            res.json(result);
        } catch (error) {
            logger.error('Controller Error updating status:', error);
            res.status(500).json({ message: 'Error al actualizar el estado de la solicitud' });
        }
    }
}

export default new SolicitudController();
