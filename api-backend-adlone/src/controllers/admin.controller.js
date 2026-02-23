import adminService from '../services/admin.service.js';

export const adminController = {
    // --- MUESTREADORES ---

    getMuestreadores: async (req, res) => {
        try {
            const { nombre, estado } = req.query;
            const result = await adminService.getMuestreadores(nombre, estado);
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller getMuestreadores error:', error);
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
            console.error('Controller createMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al crear muestreador' });
        }
    },

    updateMuestreador: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await adminService.updateMuestreador(id, req.body);
            res.json({ success: true, data: result, message: 'Muestreador actualizado correctamente' });
        } catch (error) {
            console.error('Controller updateMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar muestreador' });
        }
    },

    disableMuestreador: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await adminService.disableMuestreador(id);
            res.json({ success: true, data: result, message: 'Muestreador deshabilitado correctamente' });
        } catch (error) {
            console.error('Controller disableMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al deshabilitar muestreador' });
        }
    },

    // --- DASHBOARD ---
    getDashboardStats: async (req, res) => {
        try {
            const result = await adminService.getDashboardStats();
            res.json({ success: true, data: result });
        } catch (error) {
            console.error('Controller getDashboardStats error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener métricas del dashboard' });
        }
    }
};

export default adminController;
