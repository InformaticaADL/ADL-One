import logger from '../utils/logger.js';
import service from '../services/verificacionTemperatura.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { urlPublica } from '../services/firmaRemota.service.js';

const idUsuario = (req) => req.user?.id_usuario || req.user?.id || null;

// Envuelve cada acción: los errores con statusCode son de validación y su
// mensaje se muestra tal cual; el resto se registra y responde genérico.
const accion = (nombre, fn, mensajeOk) => async (req, res) => {
    try {
        const data = await fn(req);
        return successResponse(res, data, mensajeOk);
    } catch (error) {
        if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
        logger.error(`VerificacionTemperatura ${nombre} error:`, error);
        return errorResponse(res, 'Error al procesar la verificación de temperatura', 500);
    }
};

export const verificacionTemperaturaController = {
    listar: accion('listar', (req) => service.listar(req.query)),
    periodos: accion('periodos', () => service.periodos()),
    elegibles: accion('elegibles', (req) => service.elegibles(req.query)),
    patrones: accion('patrones', () => service.patrones()),
    resumen: accion('resumen', (req) => service.resumen(req.query)),
    erroresPatron: accion('erroresPatron', () => service.erroresPatron()),
    guardarErroresPatron: accion('guardarErroresPatron', (req) => service.guardarErroresPatron(idUsuario(req), req.body), 'Errores de patrón guardados'),
    actualizarErrorPatron: accion('actualizarErrorPatron', (req) => service.actualizarErrorPatron(req.params.idError, idUsuario(req), req.body), 'Registro actualizado'),
    muestreadores: accion('muestreadores', () => service.muestreadores()),
    obtener: accion('obtener', (req) => service.obtener(req.params.id)),
    crear: accion('crear', (req) => service.crear(idUsuario(req), req.body), 'Ficha creada'),
    crearLote: accion('crearLote', (req) => service.crearLote(idUsuario(req), req.body), 'Fichas creadas'),
    actualizar: accion('actualizar', (req) => service.actualizar(req.params.id, req.body), 'Ficha guardada'),
    enviarFirma: accion('enviarFirma', (req) => service.enviarFirma(req.params.id), 'Ficha enviada a firma'),
    volverBorrador: accion('volverBorrador', (req) => service.volverBorrador(req.params.id), 'Ficha devuelta a borrador'),
    firmar: accion('firmar', (req) => service.firmar(req.params.id, idUsuario(req), req.body), 'Ficha firmada y registrada en el equipo'),
    anular: accion('anular', (req) => service.anular(req.params.id, req.body?.motivo), 'Ficha anulada'),
    eliminar: accion('eliminar', (req) => service.eliminar(req.params.id), 'Ficha eliminada'),
    firmaRegistrada: accion('firmaRegistrada', (req) => service.firmaRegistrada(req.params.idMuestreador)),
    iniciarFirmaRemota: accion('iniciarFirmaRemota', (req) => service.iniciarFirmaRemota(req.params.id, req.body || {}, (token) => urlPublica(req, token), idUsuario(req))),
    estadoFirmaRemota: accion('estadoFirmaRemota', (req) => service.estadoFirmaRemota(req.params.id, req.params.token)),

    pdf: async (req, res) => {
        try {
            const { buffer, nombre } = await service.pdf(req.params.id);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${nombre}"`);
            return res.send(buffer);
        } catch (error) {
            if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
            logger.error('VerificacionTemperatura pdf error:', error);
            return errorResponse(res, 'Error al generar el PDF', 500);
        }
    },
};
