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

    // --- ENTRENAMIENTO ---
    setEntrenamiento: async (req, res) => {
        try {
            const { id } = req.params;
            const { en_entrenamiento } = req.body;
            if (en_entrenamiento !== 'S' && en_entrenamiento !== 'N') {
                return res.status(400).json({ success: false, message: "en_entrenamiento debe ser 'S' o 'N'" });
            }
            const result = await adminService.setEntrenamiento(id, en_entrenamiento);
            res.json({ success: true, data: result, message: 'Estado de entrenamiento actualizado' });
        } catch (error) {
            logger.error('Controller setEntrenamiento error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar estado de entrenamiento' });
        }
    },

    // --- DOCUMENTOS DE MUESTREADOR ---
    getDocumentosMuestreador: async (req, res) => {
        try {
            const result = await adminService.getDocumentosMuestreador(req.params.id);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getDocumentosMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener documentos' });
        }
    },

    addDocumentoMuestreador: async (req, res) => {
        try {
            const { id } = req.params;
            if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió archivo' });
            const ruta_archivo = `/uploads/muestreadores/${req.file.filename}`;
            const nombre_documento = req.body.nombre_documento || req.file.originalname;
            const result = await adminService.addDocumentoMuestreador(id, {
                nombre_documento,
                descripcion: req.body.descripcion,
                ruta_archivo,
                id_usuario_subida: req.user ? (req.user.id_usuario || req.user.id) : null
            });
            res.json({ success: true, data: { ...result, ruta_archivo, nombre_documento }, message: 'Documento agregado' });
        } catch (error) {
            logger.error('Controller addDocumentoMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al subir documento' });
        }
    },

    deleteDocumentoMuestreador: async (req, res) => {
        try {
            await adminService.deleteDocumentoMuestreador(req.params.idDoc);
            res.json({ success: true, message: 'Documento eliminado' });
        } catch (error) {
            logger.error('Controller deleteDocumentoMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar documento' });
        }
    },

    // --- COMPETENCIAS ---
    getCompetencias: async (req, res) => {
        try {
            const incluir = req.query.incluirInactivas === '1' || req.query.incluirInactivas === 'true';
            const result = await adminService.getCompetencias(incluir);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getCompetencias error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener competencias' });
        }
    },
    createCompetencia: async (req, res) => {
        try {
            const { nombre_competencia } = req.body;
            if (!nombre_competencia || !nombre_competencia.trim()) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
            const result = await adminService.createCompetencia(req.body);
            res.json({ success: true, data: result, message: 'Competencia creada' });
        } catch (error) {
            logger.error('Controller createCompetencia error:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Error al crear competencia' });
        }
    },
    updateCompetencia: async (req, res) => {
        try {
            await adminService.updateCompetencia(req.params.id, req.body);
            res.json({ success: true, message: 'Competencia actualizada' });
        } catch (error) {
            logger.error('Controller updateCompetencia error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar competencia' });
        }
    },
    deleteCompetencia: async (req, res) => {
        try {
            const result = await adminService.deactivateCompetencia(req.params.id);
            res.json({ success: true, data: result, message: `Competencia desactivada${result.asignados ? ` (la conservan ${result.asignados} muestreador(es))` : ''}` });
        } catch (error) {
            logger.error('Controller deleteCompetencia error:', error);
            res.status(500).json({ success: false, message: 'Error al desactivar competencia' });
        }
    },
    reactivateCompetencia: async (req, res) => {
        try {
            await adminService.reactivateCompetencia(req.params.id);
            res.json({ success: true, message: 'Competencia reactivada' });
        } catch (error) {
            logger.error('Controller reactivateCompetencia error:', error);
            res.status(500).json({ success: false, message: 'Error al reactivar competencia' });
        }
    },
    getCompetenciasMuestreador: async (req, res) => {
        try {
            const result = await adminService.getCompetenciasMuestreador(req.params.id);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getCompetenciasMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener competencias del muestreador' });
        }
    },
    setCompetenciasMuestreador: async (req, res) => {
        try {
            await adminService.setCompetenciasMuestreador(req.params.id, req.body.ids || []);
            res.json({ success: true, message: 'Competencias actualizadas' });
        } catch (error) {
            logger.error('Controller setCompetenciasMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar competencias del muestreador' });
        }
    },

    checkDuplicateMuestreador: async (req, res) => {
        try {
            const nombre = req.query.nombre?.trim() || null;
            const correo = req.query.correo?.trim() || null;
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

    // MS-04: contar muestreos futuros asignados a este muestreador
    getMuestreadorFutureAssignments: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await adminService.getMuestreadorFutureAssignments(id);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getMuestreadorFutureAssignments error:', error);
            res.status(500).json({ success: false, message: 'Error al consultar asignaciones futuras' });
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
