import fs from 'fs';
import path from 'path';
import equipoService from '../services/equipo.service.js';
import logger from '../utils/logger.js';

// La descarga pasa por la API (y no por el /uploads estático) para que respete
// el token y devuelva el nombre real del documento en vez del nombre aleatorio
// con que se guardó en disco.
const enviarDocumento = (res, doc) => {
    const abs = equipoService.resolveDocumentoPath(doc.documento_ruta);
    if (!abs || !fs.existsSync(abs)) {
        return res.status(404).json({ success: false, message: 'El archivo ya no está disponible en el servidor' });
    }
    const nombre = doc.documento_nombre || path.basename(abs);
    const nombreDescarga = path.extname(nombre) ? nombre : `${nombre}${path.extname(abs)}`;
    return res.download(abs, nombreDescarga);
};

export const equipoController = {
    getEquipos: async (req, res) => {
        try {
            const result = await equipoService.getEquipos(req.query);
            res.json({ success: true, ...result });
        } catch (error) {
            logger.error('Controller getEquipos error:', error);
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
            logger.error('Controller exportExcel error:', error);
            res.status(500).json({ success: false, message: 'Error al exportar a Excel' });
        }
    },

    getNextCorrelativo: async (req, res) => {
        try {
            const { tipo } = req.params;
            const result = await equipoService.getNextCorrelativo(tipo);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getNextCorrelativo error:', error);
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
            logger.error('Controller suggestNextCode error:', error);
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
            logger.error('Controller getEquipoById error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener el equipo' });
        }
    },

    createEquipo: async (req, res) => {
        try {
            const userId = req.user?.id || null;
            const result = await equipoService.createEquipo(req.body, userId);
            res.json({ success: true, data: result, message: 'Equipo creado correctamente' });
        } catch (error) {
            logger.error('Controller createEquipo error:', error);
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
            logger.error('Controller updateEquipo error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar equipo' });
        }
    },

    getEquipoHistorial: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await equipoService.getEquipoHistorial(id);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getEquipoHistorial error:', error);
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
            logger.error('Controller deleteEquipo error:', error);
            res.status(500).json({ success: false, message: 'Error al dar de baja el equipo' });
        }
    },



    checkExpiration: async (req, res) => {
        try {
            const result = await equipoService.inactivateExpiredEquipos();
            res.json({ success: true, ...result });
        } catch (error) {
            logger.error('Controller checkExpiration error:', error);
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
            logger.error('Controller restoreVersion error:', error);
            res.status(500).json({ success: false, message: 'Error al restaurar versión del equipo' });
        }
    },

    createEquiposBulk: async (req, res) => {
        try {
            const userId = req.user?.id || null;
            const result = await equipoService.createEquiposBulk(req.body, userId);
            res.json({ success: true, data: result, message: `${result.length} equipos creados correctamente` });
        } catch (error) {
            logger.error('Controller createEquiposBulk error:', error);
            res.status(500).json({ success: false, message: error.message || 'Error al crear equipos' });
        }
    },

    getEquipoCatalogo: async (req, res) => {
        try {
            const result = await equipoService.getEquipoCatalogo();
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getEquipoCatalogo error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener el catálogo de equipos' });
        }
    },

    createEquipoCatalogo: async (req, res) => {
        try {
            const result = await equipoService.createEquipoCatalogo(req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller createEquipoCatalogo error:', error);
            res.status(500).json({ success: false, message: 'Error al crear el equipo en el catálogo' });
        }
    },

    updateEquipoCatalogo: async (req, res) => {
        try {
            const result = await equipoService.updateEquipoCatalogo(req.params.id, req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller updateEquipoCatalogo error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar el equipo en el catálogo' });
        }
    },

    deleteEquipoCatalogo: async (req, res) => {
        try {
            const result = await equipoService.deleteEquipoCatalogo(req.params.id);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller deleteEquipoCatalogo error:', error);
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
            logger.error('Controller getEquipmentComparison error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener la comparación de equipos' });
        }
    },

    // --- DOCUMENTO DE LA REVISIÓN / MANTENCIÓN ---

    // Sube el archivo y devuelve su ruta, SIN tocar la base. La ruta se guarda
    // recién al grabar el equipo (PUT /equipos/:id), que es cuando se crea la
    // versión nueva: así el informe queda pegado a la revisión correcta y no a
    // la anterior, que en ese momento todavía es la vigente.
    subirArchivoDocumento: async (req, res) => {
        if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió archivo' });
        res.json({
            success: true,
            data: {
                documento_nombre: (req.body.nombre_documento || '').trim() || req.file.originalname,
                documento_ruta: `/uploads/equipos/${req.file.filename}`,
                tamano_bytes: req.file.size
            },
            message: 'Archivo cargado'
        });
    },

    descargarDocumentoEquipo: async (req, res) => {
        try {
            const doc = await equipoService.getDocumentoEquipo(req.params.id);
            if (!doc) return res.status(404).json({ success: false, message: 'Este equipo no tiene documento adjunto' });
            return enviarDocumento(res, doc);
        } catch (error) {
            logger.error('Controller descargarDocumentoEquipo error:', error);
            res.status(500).json({ success: false, message: 'Error al descargar el documento' });
        }
    },

    descargarDocumentoHistorial: async (req, res) => {
        try {
            const doc = await equipoService.getDocumentoHistorial(req.params.idHistorial);
            if (!doc) return res.status(404).json({ success: false, message: 'Esta versión no tiene documento adjunto' });
            return enviarDocumento(res, doc);
        } catch (error) {
            logger.error('Controller descargarDocumentoHistorial error:', error);
            res.status(500).json({ success: false, message: 'Error al descargar el documento' });
        }
    }
};

export default equipoController;
