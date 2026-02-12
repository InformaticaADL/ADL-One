import equipoService from '../services/equipo.service.js';

export const equipoController = {
    getEquipos: async (req, res) => {
        try {
            const result = await equipoService.getEquipos(req.query);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Controller getEquipos error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener equipos' });
        }
    },

    getNextCorrelativo: async (req, res) => {
        try {
            const { tipo } = req.params;
            const result = await equipoService.getNextCorrelativo(tipo);
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller getNextCorrelativo error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener el siguiente correlativo' });
        }
    },

    suggestNextCode: async (req, res) => {
        try {
            const { tipo, ubicacion, nombre } = req.query;
            if (!tipo || !ubicacion) {
                return res.status(400).json({ success: false, message: 'Faltan parámetros tipo y ubicacion' });
            }
            const result = await equipoService.suggestNextCode(tipo, ubicacion, nombre);
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller suggestNextCode error:', error);
            res.status(500).json({ success: false, message: 'Error al sugerir el código del equipo' });
        }
    },

    getEquipoById: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await equipoService.getEquipoById(id);
            if (!result) {
                return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
            }
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller getEquipoById error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener el equipo' });
        }
    },

    createEquipo: async (req, res) => {
        try {
            const userId = req.user?.id || null;
            const result = await equipoService.createEquipo(req.body, userId);
            res.json({ success: true, data: result, message: 'Equipo creado correctamente' });
        } catch (error) {
            console.error('Controller createEquipo error:', error);
            res.status(500).json({ success: false, message: 'Error al crear equipo' });
        }
    },

    updateEquipo: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user?.id || null;
            const result = await equipoService.updateEquipo(id, req.body, userId);
            res.json({ success: true, data: result, message: 'Equipo actualizado correctamente' });
        } catch (error) {
            console.error('Controller updateEquipo error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar equipo' });
        }
    },

    getEquipoHistorial: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await equipoService.getEquipoHistorial(id);
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller getEquipoHistorial error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener historial del equipo' });
        }
    },

    deleteEquipo: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user?.id || null;
            const result = await equipoService.deleteEquipo(id, userId);
            res.json({ success: true, data: result, message: 'Equipo dado de baja correctamente' });
        } catch (error) {
            console.error('Controller deleteEquipo error:', error);
            res.status(500).json({ success: false, message: 'Error al dar de baja el equipo' });
        }
    },



    checkExpiration: async (req, res) => {
        try {
            const result = await equipoService.inactivateExpiredEquipos();
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Controller checkExpiration error:', error);
            res.status(500).json({ success: false, message: 'Error checking expired equipment' });
        }
    },

    restoreVersion: async (req, res) => {
        try {
            const { id, idHistorial } = req.params;
            const userId = req.user?.id || null;
            const result = await equipoService.restoreEquipoVersion(id, idHistorial, userId);
            res.json({ success: true, data: result, message: 'Versión restaurada correctamente' });
        } catch (error) {
            console.error('Controller restoreVersion error:', error);
            res.status(500).json({ success: false, message: 'Error al restaurar versión del equipo' });
        }
    }
};

export default equipoController;
