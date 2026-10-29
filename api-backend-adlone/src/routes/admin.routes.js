import express from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { equipoController } from '../controllers/equipo.controller.js';
import solicitudController from '../controllers/solicitud.controller.js';
import gemUsuariosController from '../controllers/gemUsuarios.controller.js';

import { authenticate as verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import { validateRequest, adminValidationSchemas } from '../middlewares/validate.middleware.js';
// Note: Middleware path usually plural 'middlewares' or 'middleware'. Checking file list earlier showed 'middlewares' dir.
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Multer para documentos de muestreador → <UPLOAD_PATH>/muestreadores/ (servido en /uploads/muestreadores/)
const muestreadorDocsDir = path.join(process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads'), 'muestreadores');
const docStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(muestreadorDocsDir, { recursive: true });
        cb(null, muestreadorDocsDir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `doc-${unique}${path.extname(file.originalname)}`);
    }
});
const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 20 * 1024 * 1024 } });

// Multer para documentos de equipo (informes de mantención, fotos del equipo
// intervenido) → <UPLOAD_PATH>/equipos/ (servido en /uploads/equipos/).
const equipoDocsDir = path.join(process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads'), 'equipos');
const equipoDocStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(equipoDocsDir, { recursive: true });
        cb(null, equipoDocsDir);
    },
    filename: (req, file, cb) => {
        // Nombre aleatorio en disco: dos adjuntos llamados "informe.pdf" no se
        // pisan entre sí. El nombre real del documento vive en la BD.
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `doc-${unique}${path.extname(file.originalname)}`);
    }
});
const TIPOS_DOC_EQUIPO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const uploadEquipoDoc = multer({
    storage: equipoDocStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (TIPOS_DOC_EQUIPO.includes(file.mimetype)) return cb(null, true);
        cb(new Error('Formato no permitido: adjunte un PDF o una imagen'));
    }
});

// Sin este wrapper, un archivo muy grande o de formato no permitido cae en el
// errorHandler global como 500 "File too large": el usuario merece un 400 que
// le diga qué corregir.
const subirDocumentoEquipo = (req, res, next) => uploadEquipoDoc.single('archivo')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el máximo de 20 MB'
        : (err.message || 'No se pudo procesar el archivo');
    return res.status(400).json({ success: false, message });
});

// Multer para la plantilla de importación/validación de equipos: solo se
// analiza en memoria, no se guarda en disco (a diferencia de los documentos
// de arriba, que sí son adjuntos permanentes del equipo).
const uploadEquiposExcel = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const okMime = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
        if (okMime.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.xlsx')) return cb(null, true);
        cb(new Error('Solo se permiten archivos Excel (.xlsx)'));
    }
});
const subirExcelEquipos = (req, res, next) => uploadEquiposExcel.single('archivo')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el máximo de 10 MB'
        : (err.message || 'No se pudo procesar el archivo');
    return res.status(400).json({ success: false, message });
});

// --- MUESTREADORES ---
router.get('/muestreadores', verifyToken, verifyPermission(['MA_MUESTREADORES', 'MA_A_GEST_EQUIPO']), validateRequest(adminValidationSchemas.getMuestreadores), adminController.getMuestreadores);

router.post('/muestreadores', verifyToken, verifyPermission('AI_MA_CREAR_NUEVO_MUESTREADOR'), validateRequest(adminValidationSchemas.createMuestreador), adminController.createMuestreador);
// Quien analiza un Excel y no tiene permiso para crear muestreadores puede
// igual pedirlo: notifica a quienes sí lo tienen, sin crear nada en la BD.
router.post('/muestreadores/solicitar', verifyToken, verifyPermission('EQ_IMPORT_EXCEL'), adminController.solicitarNuevoMuestreador);
router.put('/muestreadores/:id', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), validateRequest(adminValidationSchemas.updateMuestreador), adminController.updateMuestreador);
router.delete('/muestreadores/:id', verifyToken, verifyPermission('AI_MA_DESHABILITAR_MUESTREADOR'), validateRequest(adminValidationSchemas.disableMuestreador), adminController.disableMuestreador);
router.post('/muestreadores/:id/disable-with-reassignment', verifyToken, verifyPermission('AI_MA_DESHABILITAR_MUESTREADOR'), validateRequest(adminValidationSchemas.disableMuestreadorWithReassignment), adminController.disableMuestreadorWithReassignment);
router.put('/muestreadores/:id/enable', verifyToken, verifyPermission('AI_MA_DESHABILITAR_MUESTREADOR'), adminController.enableMuestreador);
router.get('/muestreadores/check-duplicate', verifyToken, adminController.checkDuplicateMuestreador);
// MS-04: contar muestreos futuros asignados al muestreador para advertir antes de deshabilitar
router.get('/muestreadores/:id/future-assignments', verifyToken, verifyPermission(['MA_MUESTREADORES', 'AI_MA_DESHABILITAR_MUESTREADOR']), adminController.getMuestreadorFutureAssignments);
// El perfil/rendimiento tiene su propio permiso (MU_PERFIL), separado de
// MA_MUESTREADORES (que solo gatea ver la lista) — así se puede prender/apagar
// el acceso al detalle de forma independiente desde el editor de roles.
router.get('/muestreadores/:id/estadisticas', verifyToken, verifyPermission('MU_PERFIL'), adminController.getEstadisticasMuestreador);
router.get('/muestreadores/:id/agenda', verifyToken, verifyPermission('MU_PERFIL'), adminController.getAgendaMuestreador);
router.get('/muestreadores/export-pdf', verifyToken, verifyPermission('MU_EXP'), adminController.downloadMuestreadoresPdf);

// --- ENTRENAMIENTO & DOCUMENTOS ---
router.patch('/muestreadores/:id/entrenamiento', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), adminController.setEntrenamiento);
// Documentos de muestreador: compartido entre Jefe Técnico (AI_MA_EDITAR_MUESTREADOR,
// desde el formulario completo) y Calidad (MU_COMPETENCIAS, desde el modal de
// competencias) — mismo listado para ambos, sin importar quién subió qué.
router.get('/muestreadores/:id/documentos', verifyToken, verifyPermission(['MA_MUESTREADORES', 'MA_A_GEST_EQUIPO', 'MU_COMPETENCIAS']), adminController.getDocumentosMuestreador);
router.post('/muestreadores/:id/documentos', verifyToken, verifyPermission(['AI_MA_EDITAR_MUESTREADOR', 'MU_COMPETENCIAS']), uploadDoc.single('archivo'), adminController.addDocumentoMuestreador);
router.delete('/muestreadores/documentos/:idDoc', verifyToken, verifyPermission(['AI_MA_EDITAR_MUESTREADOR', 'MU_COMPETENCIAS']), adminController.deleteDocumentoMuestreador);

// --- COMPETENCIAS (maestro) --- exclusivo de Calidad (MU_COMPETENCIAS), ver y editar.
router.get('/competencias', verifyToken, verifyPermission('MU_COMPETENCIAS'), adminController.getCompetencias);
router.post('/competencias', verifyToken, verifyPermission('MU_COMPETENCIAS'), adminController.createCompetencia);
router.put('/competencias/:id', verifyToken, verifyPermission('MU_COMPETENCIAS'), adminController.updateCompetencia);
router.delete('/competencias/:id', verifyToken, verifyPermission('MU_COMPETENCIAS'), adminController.deleteCompetencia);
router.put('/competencias/:id/reactivar', verifyToken, verifyPermission('MU_COMPETENCIAS'), adminController.reactivateCompetencia);

// --- COMPETENCIAS por muestreador --- editar es exclusivo de Calidad
// (MU_COMPETENCIAS); ver también se le permite a Jefe Técnico (MA_MUESTREADORES),
// para que vea un listado de solo lectura en el formulario de edición.
router.get('/muestreadores/:id/competencias', verifyToken, verifyPermission(['MU_COMPETENCIAS', 'MA_MUESTREADORES']), adminController.getCompetenciasMuestreador);
router.put('/muestreadores/:id/competencias', verifyToken, verifyPermission('MU_COMPETENCIAS'), adminController.setCompetenciasMuestreador);

// --- USUARIOS GEM --- gestión acotada para el Jefe Técnico: solo usuarios
// del rol "Área GEM MaM" (id 20), nunca el resto del sistema.
router.get('/gem-usuarios', verifyToken, verifyPermission('GEM_USUARIOS'), gemUsuariosController.getUsuarios);
router.post('/gem-usuarios', verifyToken, verifyPermission('GEM_USUARIOS'), gemUsuariosController.createUsuario);
router.put('/gem-usuarios/:id', verifyToken, verifyPermission('GEM_USUARIOS'), gemUsuariosController.updateUsuario);
router.put('/gem-usuarios/:id/password', verifyToken, verifyPermission('GEM_USUARIOS'), gemUsuariosController.updatePassword);
router.put('/gem-usuarios/:id/status', verifyToken, verifyPermission('GEM_USUARIOS'), gemUsuariosController.toggleStatus);
router.get('/gem-usuarios/:id/empresas', verifyToken, verifyPermission('GEM_USUARIOS'), gemUsuariosController.getEmpresas);
router.put('/gem-usuarios/:id/empresas', verifyToken, verifyPermission('GEM_USUARIOS'), gemUsuariosController.setEmpresas);

// --- DASHBOARD ---
router.get('/dashboard/stats', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), adminController.getDashboardStats);

// --- CALENDARIO REPLICA ---
router.get('/calendario', verifyToken, verifyPermission(['MA_MUESTREADORES', 'MA_A_GEST_EQUIPO']), validateRequest(adminValidationSchemas.getCalendario), adminController.getCalendario);

// --- EXPORT DATA ---
router.get('/export-table', verifyToken, validateRequest(adminValidationSchemas.getExportData), adminController.getExportData);
router.get('/export-pdf', verifyToken, verifyPermission('MU_EXP'), adminController.downloadBulkPdf);

// --- EQUIPOS ---
// A-09: usado durante asignación de remuestreos — permitir a usuarios con FI_GEST_ASIG, además del admin de equipos
router.get('/equipos/comparison-resampling', verifyToken, verifyPermission(['MA_A_GEST_EQUIPO', 'FI_GEST_ASIG']), equipoController.getEquipmentComparison);
router.get('/equipos/catalogo', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.getEquipoCatalogo);
router.post('/equipos/catalogo', verifyToken, verifyPermission('AI_MA_CREAR_EQUIPO'), equipoController.createEquipoCatalogo);
router.put('/equipos/catalogo/:id', verifyToken, verifyPermission('AI_MA_EDITAR_EQUIPO'), equipoController.updateEquipoCatalogo);
router.delete('/equipos/catalogo/:id', verifyToken, verifyPermission('EQ_DESACTIVAR'), equipoController.deleteEquipoCatalogo);
router.get('/equipos/suggest-code', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.suggestNextCode);
router.get('/equipos/next-correlativo/:tipo', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.getNextCorrelativo);
router.get('/equipos/export/excel', verifyToken, verifyPermission('EQ_EXP'), equipoController.exportExcel);
router.post('/equipos/import-excel/analizar', verifyToken, verifyPermission('EQ_IMPORT_EXCEL'), subirExcelEquipos, equipoController.analizarExcel);
router.post('/equipos/import-excel/analizar-temperatura', verifyToken, verifyPermission('EQ_IMPORT_EXCEL'), subirExcelEquipos, equipoController.analizarExcelTemperatura);
router.post('/equipos/import-excel/analizar-auto', verifyToken, verifyPermission('EQ_IMPORT_EXCEL'), subirExcelEquipos, equipoController.analizarExcelAuto);
router.get('/equipos', verifyToken, equipoController.getEquipos);
router.get('/equipos/:id', verifyToken, equipoController.getEquipoById);
router.post('/equipos', verifyToken, verifyPermission('AI_MA_CREAR_EQUIPO'), equipoController.createEquipo);
router.post('/equipos/bulk', verifyToken, verifyPermission('AI_MA_CREAR_EQUIPO'), equipoController.createEquiposBulk);
router.put('/equipos/:id', verifyToken, verifyPermission('AI_MA_EDITAR_EQUIPO'), equipoController.updateEquipo);
router.get('/equipos/:id/historial', verifyToken, verifyPermission('EQ_HISTORY'), equipoController.getEquipoHistorial);
router.post('/equipos/:id/restore/:idHistorial', verifyToken, verifyPermission('EQ_UPDATE'), equipoController.restoreVersion);
router.delete('/equipos/:id', verifyToken, verifyPermission('EQ_DESACTIVAR'), equipoController.deleteEquipo);
router.post('/equipos/check-expiration', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.checkExpiration);

// --- DOCUMENTO DE LA REVISIÓN / MANTENCIÓN DEL EQUIPO ---
// El archivo se sube aparte y la ruta se guarda al grabar el equipo, junto con
// la versión nueva (ver equipoController.subirArchivoDocumento).
router.post('/equipos/documentos/archivo', verifyToken, verifyPermission('AI_MA_EDITAR_EQUIPO'), subirDocumentoEquipo, equipoController.subirArchivoDocumento);
router.get('/equipos/historial/:idHistorial/documento', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.descargarDocumentoHistorial);
router.get('/equipos/:id/documento', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.descargarDocumentoEquipo);

// --- SOLICITUDES ---
router.get('/equipos/:id/solicitudes', verifyToken, verifyPermission('EQ_VER_SOLICITUD'), solicitudController.getSolicitudesByEquipo);
router.post('/solicitudes', verifyToken, solicitudController.create);
router.get('/solicitudes', verifyToken, solicitudController.getAll);
router.put('/solicitudes/:id/status', verifyToken, solicitudController.updateStatus);
router.put('/solicitudes/:id/technical-review', verifyToken, solicitudController.reviewTechnical);
router.post('/solicitudes/:id/accept-review', verifyToken, solicitudController.acceptForReview);
router.get('/solicitudes/:id/historial', verifyToken, solicitudController.getHistorial);

export default router;
