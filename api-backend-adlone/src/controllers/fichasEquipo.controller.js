import fichasEquipoService from '../services/fichasEquipo.service.js';
import gcDocumentosService from '../services/gcDocumentos.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';
import firmaDigitalService from '../services/firmaDigital.service.js';
import firmaRemotaService, { urlPublica } from '../services/firmaRemota.service.js';

// Formularios de equipo: OI-FoGe-22 (ficha técnica), OI-FoGe-24 (historial
// por año) y OI-FoGe-36 (ficha de entrega). Los PDF se devuelven inline para
// verlos en el visor; el navegador los descarga con su nombre.

const enviarPdf = (res, { buffer, nombre }) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"; filename*=UTF-8''${encodeURIComponent(nombre)}`);
    res.setHeader('X-Nombre-Archivo', encodeURIComponent(nombre));
    res.send(buffer);
};

const manejar = (fn, mensaje) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        if (error.status && error.status < 500) return errorResponse(res, error.message, error.status);
        logger.error(`${mensaje}:`, error);
        return errorResponse(res, mensaje, 500);
    }
};

// Entrega / recepción: se pueden guardar al crear un equipo (sin id todavía).
const equipoDelCuerpo = async (body = {}) => {
    const id = Number(body.id_equipo);
    if (Number.isInteger(id) && id > 0) return fichasEquipoService.equipoBasico(id);
    return { id_equipo: null, codigo: body.codigo || '', nombre: body.nombre || '', sede: body.sede || '' };
};

export const fichasEquipoController = {
    // ── Firmas de las fichas: importar una registrada o pedirla al celular (QR) ──
    firmasRegistradas: manejar(async (req, res) => {
        successResponse(res, await firmaDigitalService.listarRegistradas(), 'Firmas registradas');
    }, 'Error al leer las firmas registradas'),

    firmaRegistrada: manejar(async (req, res) => {
        const tipo = String(req.params.tipo || '').toUpperCase();
        const imagen = await firmaDigitalService.imagenRegistrada(tipo, req.params.id);
        if (!imagen) return errorResponse(res, 'Esa persona no tiene una firma registrada', 404);
        successResponse(res, { tipo, id: Number(req.params.id), firma: imagen }, 'Firma registrada');
    }, 'Error al leer la firma registrada'),

    firmaRemotaCrear: manejar(async (req, res) => {
        const { titulo, subtitulo, slots } = req.body || {};
        const sesion = await firmaRemotaService.crearFicha({ titulo, subtitulo, slots, idUsuario: req.user?.id || null, url: (token) => urlPublica(req, token) });
        successResponse(res, sesion, 'Código QR generado');
    }, 'No se pudo generar el código QR'),

    firmaRemotaEstado: manejar(async (req, res) => {
        try {
            successResponse(res, firmaRemotaService.estadoFicha(req.params.token, req.user?.id || null));
        } catch (e) {
            if (e.statusCode) return errorResponse(res, e.message, e.statusCode);
            throw e;
        }
    }, 'No se pudo consultar la firma del celular'),

    historialAnios: manejar(async (req, res) => {
        successResponse(res, await fichasEquipoService.historialAnios(req.params.id), 'Historial por año');
    }, 'Error al leer el historial del equipo'),

    historialObservacion: manejar(async (req, res) => {
        successResponse(res, await fichasEquipoService.agregarObservacionHistorial(req.params.id, req.body || {}, req.user), 'Observación agregada');
    }, 'Error al agregar la observación'),

    historialPdf: manejar(async (req, res) => {
        enviarPdf(res, await fichasEquipoService.historialPdf(req.params.id, req.query.anio));
    }, 'Error al generar el historial del equipo'),

    tecnicaDatos: manejar(async (req, res) => {
        successResponse(res, await fichasEquipoService.fichaTecnicaDatos(req.params.id, req.user), 'Datos de la ficha técnica');
    }, 'Error al leer los datos de la ficha técnica'),

    tecnicaPdf: manejar(async (req, res) => {
        enviarPdf(res, await fichasEquipoService.fichaTecnicaPdf(req.params.id, req.body, req.user));
    }, 'Error al generar la ficha técnica'),

    entregaPdf: manejar(async (req, res) => {
        enviarPdf(res, await fichasEquipoService.entregaPdf(req.body, req.user));
    }, 'Error al generar la ficha de entrega'),

    // ── Guardar fichas (quedan en el sistema; la ventana sigue abierta) ─────
    // Equipo de la ficha: el guardado (con su id) o, si se está creando, lo que viene en el cuerpo.
    tecnicaGuardar: manejar(async (req, res) => {
        const equipo = await fichasEquipoService.equipoBasico(req.params.id);
        const pdf = await fichasEquipoService.fichaTecnicaPdf(req.params.id, req.body, req.user);
        successResponse(res, await gcDocumentosService.guardarFichaEquipo({
            tipo: 'tecnica', equipo, ...pdf, datos: req.body, usuario: req.user,
            firmas: await fichasEquipoService.firmasDocumento('tecnica', req.body, req.user),
        }), 'Ficha guardada');
    }, 'Error al guardar la ficha técnica'),

    historialGuardar: manejar(async (req, res) => {
        const anio = req.body?.anio ?? req.query.anio;
        const equipo = await fichasEquipoService.equipoBasico(req.params.id);
        const pdf = await fichasEquipoService.historialPdf(req.params.id, anio);
        successResponse(res, await gcDocumentosService.guardarFichaEquipo({
            tipo: 'historial', equipo, anio, ...pdf, datos: { anio }, usuario: req.user,
        }), 'Ficha guardada');
    }, 'Error al guardar el historial'),

    entregaGuardar: manejar(async (req, res) => {
        const pdf = await fichasEquipoService.entregaPdf(req.body, req.user);
        const equipo = await equipoDelCuerpo(req.body);
        successResponse(res, await gcDocumentosService.guardarFichaEquipo({
            tipo: 'entrega', equipo, ...pdf, datos: req.body, usuario: req.user,
            firmas: await fichasEquipoService.firmasDocumento('entrega', req.body, req.user),
        }), 'Ficha guardada');
    }, 'Error al guardar la ficha de entrega'),

    recepcionGuardar: manejar(async (req, res) => {
        const pdf = await fichasEquipoService.recepcionPdf(req.body, req.user);
        const equipo = await equipoDelCuerpo(req.body);
        successResponse(res, await gcDocumentosService.guardarFichaEquipo({
            tipo: 'recepcion', equipo, ...pdf, datos: req.body, usuario: req.user,
            firmas: await fichasEquipoService.firmasDocumento('recepcion', req.body, req.user),
        }), 'Ficha guardada');
    }, 'Error al guardar el formulario de recepción'),

    guardadasListar: manejar(async (req, res) => {
        const tipo = ['tecnica', 'historial', 'entrega', 'recepcion'].includes(req.query.tipo) ? req.query.tipo : null;
        successResponse(res, await gcDocumentosService.listarFichasEquipo(req.params.id, tipo), 'Fichas guardadas');
    }, 'Error al leer las fichas guardadas'),

    // Archivo de fichas de todos los equipos (consulta por año, formulario, sede…).
    archivoListar: manejar(async (req, res) => {
        const { tipo, anio, sede, estado, q, page, limit } = req.query;
        successResponse(res, await gcDocumentosService.listarArchivo({
            tipo: ['tecnica', 'historial', 'entrega', 'recepcion'].includes(tipo) ? tipo : null,
            anio: anio ? Number(anio) : null,
            sede: sede || null,
            estado: ['VIGENTE', 'ANULADO', 'TODOS'].includes(estado) ? estado : 'VIGENTE',
            q, page, limit,
        }), 'Archivo de fichas');
    }, 'Error al leer el archivo de fichas'),

    archivoAnios: manejar(async (req, res) => {
        successResponse(res, await gcDocumentosService.aniosArchivo(), 'Años con fichas');
    }, 'Error al leer los años del archivo'),

    guardadaPdf: manejar(async (req, res) => {
        enviarPdf(res, await gcDocumentosService.pdf(req.params.idFicha));
    }, 'Error al abrir la ficha guardada'),

    guardadaAnular: manejar(async (req, res) => {
        successResponse(res, await gcDocumentosService.anular(req.params.idFicha, req.body?.motivo, req.user), 'Ficha anulada');
    }, 'Error al anular la ficha guardada'),

    // Documento vigente igual (mismo formulario, equipo y año): para avisar antes de guardar otro.
    guardadaVigente: manejar(async (req, res) => {
        const tipo = ['tecnica', 'historial', 'entrega', 'recepcion'].includes(req.query.tipo) ? req.query.tipo : null;
        successResponse(res, await gcDocumentosService.vigenteIgual(tipo, req.params.id, req.query.anio || null), 'Documento vigente');
    }, 'Error al consultar las fichas guardadas'),

    recepcionDatos: manejar(async (req, res) => {
        successResponse(res, await fichasEquipoService.recepcionDatos(req.params.id), 'Datos para el formulario de recepción');
    }, 'Error al leer los datos de recepción del equipo'),

    recepcionPdf: manejar(async (req, res) => {
        enviarPdf(res, await fichasEquipoService.recepcionPdf(req.body, req.user));
    }, 'Error al generar el formulario de recepción'),
};

export default fichasEquipoController;
