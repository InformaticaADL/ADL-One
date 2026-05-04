import adminService from '../services/admin.service.js';
import logger from '../utils/logger.js';

export const adminController = {
    // --- MUESTREADORES ---

    getMuestreadores: async (req, res) => {
        try {
            const { nombre, estado } = req.query;
            const result = await adminService.getMuestreadores(nombre, estado);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getMuestreadores error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener muestreadores' });
        }
    },

    createMuestreador: async (req, res) => {
        try {
            // Validate required fields
            const { nombre, correo, clave } = req.body;
            if (!nombre || !correo || !clave) {
                return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
            }

            const result = await adminService.createMuestreador(req.body);
            res.json({ success: true, data: result, message: 'Muestreador creado correctamente' });
        } catch (error) {
            logger.error('Controller createMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al crear muestreador' });
        }
    },

    updateMuestreador: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await adminService.updateMuestreador(id, req.body);
            res.json({ success: true, data: result, message: 'Muestreador actualizado correctamente' });
        } catch (error) {
            logger.error('Controller updateMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar muestreador' });
        }
    },

    disableMuestreador: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await adminService.disableMuestreador(id);
            res.json({ success: true, data: result, message: 'Muestreador deshabilitado correctamente' });
        } catch (error) {
            logger.error('Controller disableMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al deshabilitar muestreador' });
        }
    },

    disableMuestreadorWithReassignment: async (req, res) => {
        try {
            const { id } = req.params;
            const { reassignmentOptions } = req.body;
            
            if (!reassignmentOptions) {
                return res.status(400).json({ success: false, message: 'Faltan opciones de reasignación' });
            }

            const result = await adminService.disableMuestreadorWithReassignment(id, reassignmentOptions);
            res.json({ success: true, data: result, message: 'Muestreador deshabilitado y equipos reasignados correctamente' });
        } catch (error) {
            logger.error('Controller disableMuestreadorWithReassignment error:', error);
            res.status(500).json({ success: false, message: 'Error al deshabilitar muestreador con reasignación' });
        }
    },

    enableMuestreador: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await adminService.enableMuestreador(id);
            res.json({ success: true, data: result, message: 'Muestreador habilitado correctamente' });
        } catch (error) {
            logger.error('Controller enableMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al habilitar muestreador' });
        }
    },

    checkDuplicateMuestreador: async (req, res) => {
        try {
            const { nombre, correo } = req.query;
            if (!nombre && !correo) {
                return res.json({ success: true, data: [] });
            }
            const result = await adminService.checkDuplicateMuestreador(nombre, correo);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller checkDuplicateMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al verificar duplicados' });
        }
    },

    // --- DASHBOARD ---
    getDashboardStats: async (req, res) => {
        try {
            const result = await adminService.getDashboardStats();
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getDashboardStats error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener métricas del dashboard' });
        }
    },

    // --- CALENDARIO REPLICA ---
    getCalendario: async (req, res) => {
        try {
            const { mes, ano } = req.query;
            const result = await adminService.getCalendario(mes, ano);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getCalendario error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener datos del calendario' });
        }
    },

    getExportData: async (req, res) => {
        try {
            const { name, type = 'TABLE', params = '{}' } = req.query;
            if (!name) {
                return res.status(400).json({ success: false, message: 'Nombre de recurso requerido' });
            }

            let parsedParams = {};
            try {
                parsedParams = JSON.parse(params);
            } catch (e) {
                logger.error('Error parsing export params:', e);
            }

            const result = await adminService.getTableData(name, type, parsedParams);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error(`Controller getExportData error for ${req.query.name}:`, error);
            res.status(500).json({ success: false, message: error.message || 'Error al obtener datos para exportación' });
        }
    },

    downloadBulkPdf: async (req, res) => {
        try {
            const { params = '{}' } = req.query;
            let parsedParams = {};
            try {
                parsedParams = JSON.parse(params);
            } catch (e) {
                logger.error('Error parsing bulk pdf params:', e);
            }

            const pdfBuffer = await adminService.getExportPdf(parsedParams);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Reporte_Fichas_${new Date().toISOString().split('T')[0]}.pdf"`);
            res.send(pdfBuffer);
        } catch (error) {
            logger.error('Controller downloadBulkPdf error:', error);
            res.status(500).json({ success: false, message: error.message || 'Error al generar el PDF masivo' });
        }
    },

    downloadMuestreadoresPdf: async (req, res) => {
        try {
            const { nombre, estado } = req.query;
            const pdfBuffer = await adminService.generateMuestreadoresPdfBuffer(nombre, estado);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Muestreadores_${new Date().toISOString().split('T')[0]}.pdf"`);
            res.send(pdfBuffer);
        } catch (error) {
            logger.error('Controller downloadMuestreadoresPdf error:', error);
            res.status(500).json({ success: false, message: 'Error al generar PDF de muestreadores' });
        }
    }
};

export default adminController;
