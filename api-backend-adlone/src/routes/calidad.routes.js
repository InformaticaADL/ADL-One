import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermisoGc } from '../middlewares/requirePermisoGc.js';
import { PERMISOS_GC } from '../utils/permisosCalidad.js';
import calidadArchivoService from '../services/calidadArchivo.service.js';
import calidadProgramaService from '../services/calidadPrograma.service.js';
import calidadAuditoriaService from '../services/calidadAuditoria.service.js';
import calidadAccionCorrectivaService from '../services/calidadAccionCorrectiva.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

// G. Calidad → Calidad, montado en /api/calidad (junto a /api/calidad/quejas-apelaciones):
//   archivo de quejas y apelaciones cerradas, Listado OI-FoGe-06 y (próximas fases) auditorías internas.
// Ver pide GC_AUDITORIAS; sincronizar a mano pide GC_AUDITORIAS_EDITAR.
const router = express.Router();
router.use(authenticate);

const manejar = (fn, mensaje) => async (req, res) => {
    try {
        return await fn(req, res);
    } catch (e) {
        if (e.statusCode && e.statusCode < 500) return errorResponse(res, e.message, e.statusCode);
        if (e.statusCode === 503) return errorResponse(res, e.message, 503);
        logger.error(`${mensaje}:`, e);
        return errorResponse(res, mensaje, 500);
    }
};

const ver = requirePermisoGc(PERMISOS_GC.AUDITORIAS);
const editar = requirePermisoGc(PERMISOS_GC.AUDITORIAS_EDITAR);

const enviarPdf = (res, { buffer, nombre }) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(nombre)}`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
};

// ── Archivo de quejas y apelaciones cerradas ──
router.get('/archivo-qa', ver, manejar(async (req, res) =>
    successResponse(res, await calidadArchivoService.archivo(req.query)), 'No se pudo leer el archivo de quejas y apelaciones'));
router.post('/archivo-qa/sincronizar', editar, manejar(async (req, res) =>
    successResponse(res, await calidadArchivoService.sincronizar(), 'Archivo sincronizado'), 'No se pudo sincronizar el archivo'));
router.get('/archivo-qa/:id', ver, manejar(async (req, res) =>
    successResponse(res, await calidadArchivoService.casoArchivado(req.params.id)), 'No se pudo leer el caso archivado'));

// ── Listado OI-FoGe-06 ──
router.get('/listado-qa', ver, manejar(async (req, res) =>
    successResponse(res, await calidadArchivoService.listado(req.query)), 'No se pudo armar el listado'));
router.get('/listado-qa/pdf', ver, manejar(async (req, res) =>
    enviarPdf(res, await calidadArchivoService.listadoPdf(req.query)), 'No se pudo generar el listado OI-FoGe-06'));

// ── Elementos del sistema de calidad (ISO 17020), editables ──
router.get('/iso-elementos', ver, manejar(async (req, res) =>
    successResponse(res, await calidadProgramaService.listarElementos({ soloActivos: req.query.todos !== '1' })), 'No se pudieron leer los elementos'));
router.post('/iso-elementos', editar, manejar(async (req, res) =>
    successResponse(res, await calidadProgramaService.crearElemento(req.body, req.user), 'Elemento agregado', 201), 'No se pudo agregar el elemento'));
router.put('/iso-elementos/:id', editar, manejar(async (req, res) =>
    successResponse(res, await calidadProgramaService.editarElemento(req.params.id, req.body, req.user), 'Elemento guardado'), 'No se pudo guardar el elemento'));

// ── Programa Anual de Auditorías Internas (OI-FoGe-07) ──
router.get('/programa/:anio', ver, manejar(async (req, res) =>
    successResponse(res, await calidadProgramaService.obtenerPrograma(req.params.anio)), 'No se pudo leer el programa'));
// Vista previa con lo que se está marcando en pantalla, sin guardar nada.
router.post('/programa/:anio/vista-previa', editar, manejar(async (req, res) => {
    const buffer = await calidadProgramaService.vistaPreviaPdf(req.params.anio, req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la vista previa del programa'));
router.put('/programa/:anio', editar, manejar(async (req, res) =>
    successResponse(res, await calidadProgramaService.guardarPrograma(req.params.anio, req.body, req.user), 'Programa guardado'), 'No se pudo guardar el programa'));
router.get('/programa/:anio/pdf', ver, manejar(async (req, res) =>
    enviarPdf(res, await calidadProgramaService.pdfPrograma(req.params.anio)), 'No se pudo generar el programa OI-FoGe-07'));

// ── Auditorías internas (Plan OI-FoGe-08, Reunión OI-FoGe-10, Hallazgos OI-FoGe-09) ──
router.get('/auditorias', ver, manejar(async (req, res) =>
    successResponse(res, await calidadAuditoriaService.listar(req.query)), 'No se pudieron leer las auditorías'));
router.post('/auditorias', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAuditoriaService.crear(req.body, req.user), 'Auditoría creada', 201), 'No se pudo crear la auditoría'));
router.post('/programa/item/:idItem/auditoria', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAuditoriaService.crearDesdeItem(req.params.idItem, req.user), 'Auditoría creada', 201), 'No se pudo crear la auditoría desde el programa'));
router.get('/auditorias/:id', ver, manejar(async (req, res) =>
    successResponse(res, await calidadAuditoriaService.obtener(req.params.id)), 'No se pudo leer la auditoría'));
router.post('/auditorias/:id/anular', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAuditoriaService.anular(req.params.id, req.body?.motivo, req.user), 'Auditoría anulada'), 'No se pudo anular la auditoría'));

router.put('/auditorias/:id/plan', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAuditoriaService.guardarPlan(req.params.id, req.body, req.user), 'Plan guardado'), 'No se pudo guardar el plan'));
router.get('/auditorias/:id/plan/pdf', ver, manejar(async (req, res) => enviarPdf(res, await calidadAuditoriaService.pdfPlan(req.params.id)), 'No se pudo generar el plan OI-FoGe-08'));
router.post('/auditorias/:id/plan/vista-previa', editar, manejar(async (req, res) => {
    const buffer = await calidadAuditoriaService.vistaPreviaPlan(req.params.id, req.body);
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'inline'); res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la vista previa del plan'));

router.put('/auditorias/:id/reunion/:reunion', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAuditoriaService.guardarReunion(req.params.id, req.params.reunion.toUpperCase(), req.body, req.user), 'Reunión guardada'), 'No se pudo guardar la reunión'));
router.get('/auditorias/:id/reunion/pdf', ver, manejar(async (req, res) => enviarPdf(res, await calidadAuditoriaService.pdfReunion(req.params.id)), 'No se pudo generar la reunión OI-FoGe-10'));
router.post('/auditorias/:id/reunion/:reunion/vista-previa', editar, manejar(async (req, res) => {
    const buffer = await calidadAuditoriaService.vistaPreviaReunion(req.params.id, req.params.reunion.toUpperCase(), req.body);
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'inline'); res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la vista previa de la reunión'));

router.put('/auditorias/:id/hallazgos', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAuditoriaService.guardarHojas(req.params.id, req.body, req.user), 'Hallazgos guardados'), 'No se pudieron guardar los hallazgos'));
router.get('/auditorias/:id/hallazgos/pdf', ver, manejar(async (req, res) => enviarPdf(res, await calidadAuditoriaService.pdfHallazgos(req.params.id)), 'No se pudo generar los hallazgos OI-FoGe-09'));
router.post('/auditorias/:id/hallazgos/vista-previa', editar, manejar(async (req, res) => {
    const buffer = await calidadAuditoriaService.vistaPreviaHallazgos(req.params.id, req.body);
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'inline'); res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la vista previa de los hallazgos'));

// ── Informe de Auditoría (OI-FoGe-11) ──
router.put('/auditorias/:id/informe', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAuditoriaService.guardarInforme(req.params.id, req.body, req.user), 'Informe guardado'), 'No se pudo guardar el informe'));
router.get('/auditorias/:id/informe/pdf', ver, manejar(async (req, res) => enviarPdf(res, await calidadAuditoriaService.pdfInforme(req.params.id)), 'No se pudo generar el informe OI-FoGe-11'));
router.post('/auditorias/:id/informe/vista-previa', editar, manejar(async (req, res) => {
    const buffer = await calidadAuditoriaService.vistaPreviaInforme(req.params.id, req.body);
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'inline'); res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la vista previa del informe'));

// ── Acciones Correctivas (OI-FoGe-02) ──
router.get('/acciones', ver, manejar(async (req, res) =>
    successResponse(res, await calidadAccionCorrectivaService.listar(req.query)), 'No se pudieron leer las acciones correctivas'));
router.post('/acciones', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAccionCorrectivaService.crear(req.body, req.user), 'Acción correctiva creada', 201), 'No se pudo crear la acción correctiva'));
router.post('/auditorias/:id/hallazgos/:idHallazgo/accion', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAccionCorrectivaService.abrirDesdeHallazgo(req.params.idHallazgo, req.user), 'Acción correctiva abierta', 201), 'No se pudo abrir la acción correctiva'));
router.get('/acciones/:id', ver, manejar(async (req, res) =>
    successResponse(res, await calidadAccionCorrectivaService.obtener(req.params.id)), 'No se pudo leer la acción correctiva'));
router.put('/acciones/:id', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAccionCorrectivaService.guardar(req.params.id, req.body, req.user), 'Acción correctiva guardada'), 'No se pudo guardar la acción correctiva'));
router.post('/acciones/:id/cerrar', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAccionCorrectivaService.cerrar(req.params.id, req.body, req.user), 'Acción correctiva cerrada'), 'No se pudo cerrar la acción correctiva'));
router.post('/acciones/:id/anular', editar, manejar(async (req, res) =>
    successResponse(res, await calidadAccionCorrectivaService.anular(req.params.id, req.body?.motivo, req.user), 'Acción correctiva anulada'), 'No se pudo anular la acción correctiva'));
router.get('/acciones/:id/pdf', ver, manejar(async (req, res) => enviarPdf(res, await calidadAccionCorrectivaService.pdf(req.params.id)), 'No se pudo generar la acción correctiva OI-FoGe-02'));
router.post('/acciones/:id/vista-previa', editar, manejar(async (req, res) => {
    const buffer = await calidadAccionCorrectivaService.vistaPreviaPdf(req.params.id, req.body);
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'inline'); res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la vista previa de la acción correctiva'));

export default router;
