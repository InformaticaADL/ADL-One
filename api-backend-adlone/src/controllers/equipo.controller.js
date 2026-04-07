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

    exportExcel: async (req, res) => {
        try {
            const buffer = await equipoService.exportEquiposExcel(req.query);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Reporte_Equipos_${new Date().toISOString().split('T')[0]}.xlsx`);
            res.send(buffer);
        } catch (error) {
            console.error('Controller exportExcel error:', error);
            res.status(500).json({ success: false, message: 'Error al exportar a Excel' });
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
    },

    createEquiposBulk: async (req, res) => {
        try {
            const userId = req.user?.id || null;
            const result = await equipoService.createEquiposBulk(req.body, userId);
            res.json({ success: true, data: result, message: `${result.length} equipos creados correctamente` });
        } catch (error) {
            console.error('Controller createEquiposBulk error:', error);
            res.status(500).json({ success: false, message: error.message || 'Error al crear equipos' });
        }
    },

    getEquipoCatalogo: async (req, res) => {
        try {
            const result = await equipoService.getEquipoCatalogo();
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller getEquipoCatalogo error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener el catálogo de equipos' });
        }
    },

    createEquipoCatalogo: async (req, res) => {
        try {
            const result = await equipoService.createEquipoCatalogo(req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller createEquipoCatalogo error:', error);
            res.status(500).json({ success: false, message: 'Error al crear el equipo en el catálogo' });
        }
    },

    updateEquipoCatalogo: async (req, res) => {
        try {
            const result = await equipoService.updateEquipoCatalogo(req.params.id, req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller updateEquipoCatalogo error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar el equipo en el catálogo' });
        }
    },

    deleteEquipoCatalogo: async (req, res) => {
        try {
            const result = await equipoService.deleteEquipoCatalogo(req.params.id);
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller deleteEquipoCatalogo error:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar el equipo del catálogo' });
        }
    },

    getEquipmentComparison: async (req, res) => {
        try {
            const { idOriginal, idNueva, idMuestreador } = req.query;
            if (!idOriginal || !idNueva || !idMuestreador) {
                return res.status(400).json({ success: false, message: 'Faltan parámetros idOriginal, idNueva e idMuestreador' });
            }
            const result = await equipoService.getEquipmentComparisonForResampling(idOriginal, idNueva, idMuestreador);
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller getEquipmentComparison error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener la comparación de equipos' });
        }
    }
};

export default equipoController;
