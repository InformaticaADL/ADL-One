import facturacionService from '../services/facturacion.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

class FacturacionController {

    async getCasosFacturables(req, res) {
        try {
            const filtros = {
                idEmpresaServicio: req.query.idEmpresaServicio ? Number(req.query.idEmpresaServicio) : undefined,
                idEmpresa: req.query.idEmpresa ? Number(req.query.idEmpresa) : undefined,
                idCentro: req.query.idCentro ? Number(req.query.idCentro) : undefined,
                fechaInicio: req.query.fechaInicio || undefined,
                fechaFin: req.query.fechaFin || undefined,
            };
            const result = await facturacionService.getCasosFacturables(filtros);
            return successResponse(res, result, 'Casos facturables obtenidos exitosamente');
        } catch (err) {
            logger.error('Error in getCasosFacturables controller:', err);
            return errorResponse(res, 'Error al obtener casos facturables', 500, err.message);
        }
    }

    async crearPrefacturas(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.crearPrefacturas(req.body, idUsuario);
            return successResponse(res, result, 'Pre-factura(s) creada(s) exitosamente', 201);
        } catch (err) {
            logger.error('Error in crearPrefacturas controller:', err);
            return errorResponse(res, err.message || 'Error al crear la(s) pre-factura(s)', 400, err.message);
        }
    }

    async listarPrefacturas(req, res) {
        try {
            const filtros = {
                estado: req.query.estado || undefined,
                idEmpresaServicio: req.query.idEmpresaServicio ? Number(req.query.idEmpresaServicio) : undefined,
            };
            const result = await facturacionService.listarPrefacturas(filtros);
            return successResponse(res, result, 'Pre-facturas obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in listarPrefacturas controller:', err);
            return errorResponse(res, 'Error al listar pre-facturas', 500, err.message);
        }
    }

    async getPrefacturaDetalle(req, res) {
        try {
            const result = await facturacionService.getPrefacturaDetalle(Number(req.params.id));
            if (!result) return errorResponse(res, 'Pre-factura no encontrada', 404);
            return successResponse(res, result, 'Detalle obtenido exitosamente');
        } catch (err) {
            logger.error('Error in getPrefacturaDetalle controller:', err);
            return errorResponse(res, 'Error al obtener el detalle de la pre-factura', 500, err.message);
        }
    }

    async generarPdfs(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.generarPdfs(Number(req.params.id), idUsuario);
            return successResponse(res, result, 'PDF generados exitosamente');
        } catch (err) {
            logger.error('Error in generarPdfs controller:', err);
            return errorResponse(res, err.message || 'Error al generar los PDF', 400, err.message);
        }
    }

    async enviarPorEmail(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.enviarPorEmail(Number(req.params.id), idUsuario);
            return successResponse(res, result, 'Pre-factura enviada por email exitosamente');
        } catch (err) {
            logger.error('Error in enviarPorEmail controller:', err);
            return errorResponse(res, err.message || 'Error al enviar la pre-factura por email', 400, err.message);
        }
    }

    async registrarOrdenCompra(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.registrarOrdenCompra(Number(req.params.id), req.body, idUsuario);
            return successResponse(res, result, 'Orden de Compra registrada exitosamente', 201);
        } catch (err) {
            logger.error('Error in registrarOrdenCompra controller:', err);
            return errorResponse(res, err.message || 'Error al registrar la Orden de Compra', 400, err.message);
        }
    }

    /** Vista previa del PDF resumen de una selección de casos, sin persistir nada. */
    async generarPdfPreview(req, res) {
        try {
            const buffer = await facturacionService.generarPdfPreview(req.body.idAgendamamList, req.body.agrupacionTipo);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="vista_previa.pdf"');
            return res.send(buffer);
        } catch (err) {
            logger.error('Error in generarPdfPreview controller:', err);
            return errorResponse(res, err.message || 'Error al generar la vista previa', 400, err.message);
        }
    }

    async listarLotesEmision(req, res) {
        try {
            const result = await facturacionService.listarLotesEmision(req.query.limit ? Number(req.query.limit) : 50);
            return successResponse(res, result, 'Lotes de emisión obtenidos exitosamente');
        } catch (err) {
            logger.error('Error in listarLotesEmision controller:', err);
            return errorResponse(res, 'Error al obtener los lotes de emisión', 500, err.message);
        }
    }

    async generarArchivoPlano(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.generarArchivoPlano(req.body.idPrefacturaList, idUsuario);
            return successResponse(res, result, 'Archivo plano generado exitosamente', 201);
        } catch (err) {
            logger.error('Error in generarArchivoPlano controller:', err);
            return errorResponse(res, err.message || 'Error al generar el archivo plano', 400, err.message);
        }
    }

    async getDashboard(_req, res) {
        try {
            const result = await facturacionService.getDashboard();
            return successResponse(res, result, 'Dashboard obtenido exitosamente');
        } catch (err) {
            logger.error('Error in getDashboard controller:', err);
            return errorResponse(res, 'Error al obtener el dashboard', 500, err.message);
        }
    }

    async actualizarUf(_req, res) {
        try {
            const result = await facturacionService.actualizarValorUfHoy();
            return successResponse(res, result, 'Valor UF actualizado exitosamente');
        } catch (err) {
            logger.error('Error in actualizarUf controller:', err);
            return errorResponse(res, err.message || 'Error al actualizar el valor UF', 400, err.message);
        }
    }

    async listarUfHistorial(req, res) {
        try {
            const limit = req.query.limit ? Number(req.query.limit) : 30;
            const result = await facturacionService.listarUfHistorial(limit);
            return successResponse(res, result, 'Histórico UF obtenido exitosamente');
        } catch (err) {
            logger.error('Error in listarUfHistorial controller:', err);
            return errorResponse(res, 'Error al obtener el histórico de UF', 500, err.message);
        }
    }

    async registrarUfManual(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.registrarUfManual(req.body.fecha, req.body.valor, idUsuario);
            return successResponse(res, result, 'Valor UF registrado exitosamente', 201);
        } catch (err) {
            logger.error('Error in registrarUfManual controller:', err);
            return errorResponse(res, err.message || 'Error al registrar el valor UF', 400, err.message);
        }
    }

    async listarFormasPago(_req, res) {
        try {
            const result = await facturacionService.listarFormasPago();
            return successResponse(res, result, 'Formas de pago obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in listarFormasPago controller:', err);
            return errorResponse(res, 'Error al obtener las formas de pago', 500, err.message);
        }
    }

    async listarGlosas(req, res) {
        try {
            const idTipoDocumento = req.query.idTipoDocumento ? Number(req.query.idTipoDocumento) : 1;
            const result = await facturacionService.listarGlosas(idTipoDocumento);
            return successResponse(res, result, 'Glosas obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in listarGlosas controller:', err);
            return errorResponse(res, 'Error al obtener las glosas', 500, err.message);
        }
    }

    async getClienteConfig(req, res) {
        try {
            const result = await facturacionService.getClienteConfig(Number(req.params.idEmpresaServicio));
            return successResponse(res, result, 'Configuración de cliente obtenida exitosamente');
        } catch (err) {
            logger.error('Error in getClienteConfig controller:', err);
            return errorResponse(res, 'Error al obtener la configuración del cliente', 500, err.message);
        }
    }

    async upsertClienteConfig(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.upsertClienteConfig(Number(req.params.idEmpresaServicio), req.body, idUsuario);
            return successResponse(res, result, 'Configuración de cliente guardada exitosamente');
        } catch (err) {
            logger.error('Error in upsertClienteConfig controller:', err);
            return errorResponse(res, err.message || 'Error al guardar la configuración del cliente', 400, err.message);
        }
    }

    async publicarEnPortal(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.publicarEnPortal(Number(req.params.id), idUsuario);
            return successResponse(res, result, 'Pre-factura publicada en ADL WEB GO exitosamente');
        } catch (err) {
            logger.error('Error in publicarEnPortal controller:', err);
            return errorResponse(res, err.message || 'Error al publicar en el portal', 400, err.message);
        }
    }

    // Llamado por ADL WEB GO (servidor-a-servidor), no por un usuario de ADL ONE.
    async recibirOrdenCompraDesdePortal(req, res) {
        try {
            const { referencia_externa, ...datos } = req.body;
            const result = await facturacionService.recibirOrdenCompraDesdePortal(referencia_externa, datos, null);
            return successResponse(res, result, 'Orden de Compra recibida desde el portal', 201);
        } catch (err) {
            logger.error('Error in recibirOrdenCompraDesdePortal controller:', err);
            return errorResponse(res, err.message || 'Error al recibir la Orden de Compra', 400, err.message);
        }
    }

    // Llamado por WebClientesV2 (servidor-a-servidor), no por un usuario de ADL ONE.
    async recibirSolicitudCotizacionPortal(req, res) {
        try {
            const { referencia_externa, cliente_codigo, rut, nombreCliente, titulo, descripcion, items,
                solicitante_nombre, solicitante_email } = req.body || {};
            const result = await facturacionService.recibirSolicitudCotizacionPortal(referencia_externa, {
                clienteCodigo: cliente_codigo, rut, nombreCliente, titulo, descripcion, items,
                solicitanteNombre: solicitante_nombre, solicitanteEmail: solicitante_email,
            });
            return successResponse(res, result, 'Solicitud de cotización recibida desde el portal', 201);
        } catch (err) {
            logger.error('Error in recibirSolicitudCotizacionPortal controller:', err);
            return errorResponse(res, err.message || 'Error al recibir la solicitud de cotización', 400, err.message);
        }
    }

    async listarSolicitudesCotizacionPortal(req, res) {
        try {
            const soloPendientes = req.query.todas !== 'true';
            const result = await facturacionService.listarSolicitudesCotizacionPortal(soloPendientes);
            return successResponse(res, result, 'Solicitudes del portal obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in listarSolicitudesCotizacionPortal controller:', err);
            return errorResponse(res, 'Error al obtener las solicitudes del portal', 500, err.message);
        }
    }

    async vincularCotizacionAPortal(req, res) {
        try {
            const result = await facturacionService.vincularCotizacionAPortal(Number(req.params.id), Number(req.body.idSolicitudPortal));
            return successResponse(res, result, 'Cotización vinculada a la solicitud del portal');
        } catch (err) {
            logger.error('Error in vincularCotizacionAPortal controller:', err);
            return errorResponse(res, err.message || 'Error al vincular la cotización', 400, err.message);
        }
    }

    async publicarCotizacionEnPortal(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.publicarCotizacionEnPortal(Number(req.params.id), idUsuario);
            return successResponse(res, result, 'Cotización publicada en ADL WEB GO exitosamente');
        } catch (err) {
            logger.error('Error in publicarCotizacionEnPortal controller:', err);
            return errorResponse(res, err.message || 'Error al publicar la cotización en el portal', 400, err.message);
        }
    }

    async listarMensajesCotizacionPortal(req, res) {
        try {
            const result = await facturacionService.listarMensajesCotizacionPortal(Number(req.params.id));
            return successResponse(res, result, 'Mensajes obtenidos');
        } catch (err) {
            logger.error('Error in listarMensajesCotizacionPortal controller:', err);
            return errorResponse(res, err.message || 'Error al obtener los mensajes', 400, err.message);
        }
    }

    async enviarMensajeCotizacionPortal(req, res) {
        try {
            const mensaje = String(req.body?.mensaje || '').trim();
            if (!mensaje) return errorResponse(res, 'El mensaje es requerido.', 400);
            const result = await facturacionService.enviarMensajeCotizacionPortal(Number(req.params.id), mensaje);
            return successResponse(res, result, 'Mensaje enviado');
        } catch (err) {
            logger.error('Error in enviarMensajeCotizacionPortal controller:', err);
            return errorResponse(res, err.message || 'Error al enviar el mensaje', 400, err.message);
        }
    }

    async actualizarPrefactura(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.actualizarPrefactura(Number(req.params.id), req.body || {}, idUsuario);
            return successResponse(res, result, 'Pre-factura actualizada');
        } catch (err) {
            logger.error('Error in actualizarPrefactura controller:', err);
            return errorResponse(res, err.message || 'Error al actualizar la pre-factura', 400, err.message);
        }
    }

    async quitarCasoDePrefactura(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.quitarCasoDePrefactura(
                Number(req.params.id), Number(req.params.idPfCaso), idUsuario);
            return successResponse(res, result, 'Caso quitado y devuelto a la cola de facturables');
        } catch (err) {
            logger.error('Error in quitarCasoDePrefactura controller:', err);
            return errorResponse(res, err.message || 'Error al quitar el caso', 400, err.message);
        }
    }

    async anularPrefactura(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.anularPrefactura(Number(req.params.id), req.body?.motivo, idUsuario);
            return successResponse(res, result, 'Pre-factura anulada');
        } catch (err) {
            logger.error('Error in anularPrefactura controller:', err);
            return errorResponse(res, err.message || 'Error al anular la pre-factura', 400, err.message);
        }
    }

    async listarTablasDeConvenio(req, res) {
        try {
            const result = await facturacionService.listarTablasDeConvenio(
                Number(req.query.idEmpresaServicio),
                req.query.idCentro ? Number(req.query.idCentro) : undefined);
            return successResponse(res, result, 'Tablas obtenidas');
        } catch (err) {
            logger.error('Error in listarTablasDeConvenio controller:', err);
            return errorResponse(res, err.message || 'Error al obtener las tablas', 400, err.message);
        }
    }

    async getCotizacionParaFicha(req, res) {
        try {
            const result = await facturacionService.getCotizacionParaFicha(Number(req.params.id));
            return successResponse(res, result, 'Datos para la ficha obtenidos');
        } catch (err) {
            logger.error('Error in getCotizacionParaFicha controller:', err);
            return errorResponse(res, err.message || 'Error al preparar la ficha', 400, err.message);
        }
    }

    async marcarCotizacionConvertida(req, res) {
        try {
            const result = await facturacionService.marcarCotizacionConvertida(Number(req.params.id));
            return successResponse(res, result, 'Cotización marcada como convertida');
        } catch (err) {
            logger.error('Error in marcarCotizacionConvertida controller:', err);
            return errorResponse(res, err.message || 'Error al marcar la cotización', 400, err.message);
        }
    }

    async actualizarPrecioItemCotizacion(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.actualizarPrecioItemCotizacion(
                Number(req.params.id), Number(req.params.idItem), req.body?.precioUf, idUsuario);
            return successResponse(res, result, 'Precio actualizado');
        } catch (err) {
            logger.error('Error in actualizarPrecioItemCotizacion controller:', err);
            return errorResponse(res, err.message || 'Error al actualizar el precio', 400, err.message);
        }
    }

    async descargarPdfCotizacion(req, res) {
        try {
            const id = Number(req.params.id);
            const cot = await facturacionService.getCotizacionDetalle(id);
            if (!cot) return errorResponse(res, 'Cotización no encontrada', 404);
            const pdf = await facturacionService.generarPdfCotizacion(id);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="Propuesta_MA-P${cot.numero_cotizacion}.pdf"`);
            return res.send(pdf);
        } catch (err) {
            logger.error('Error in descargarPdfCotizacion controller:', err);
            return errorResponse(res, err.message || 'Error al generar el PDF', 400, err.message);
        }
    }

    async listarBandejaCotizaciones(req, res) {
        try {
            const filtros = {
                estado: req.query.estado || undefined,
                soloNoLeidos: req.query.soloNoLeidos === 'true',
                idEmpresaServicio: req.query.idEmpresaServicio ? Number(req.query.idEmpresaServicio) : undefined,
            };
            const result = await facturacionService.listarBandejaCotizaciones(filtros);
            return successResponse(res, result, 'Bandeja obtenida');
        } catch (err) {
            logger.error('Error in listarBandejaCotizaciones controller:', err);
            return errorResponse(res, err.message || 'Error al obtener la bandeja', 400, err.message);
        }
    }

    async registrarEventoPortal(req, res) {
        try {
            const { referencia_externa, tipo, mensaje, estado } = req.body || {};
            const result = await facturacionService.registrarEventoPortal(referencia_externa, { tipo, mensaje, estado });
            return successResponse(res, result, 'Evento registrado');
        } catch (err) {
            logger.error('Error in registrarEventoPortal controller:', err);
            return errorResponse(res, err.message || 'Error al registrar el evento', 400, err.message);
        }
    }

    async marcarVistaStaffPortal(req, res) {
        try {
            const result = await facturacionService.marcarVistaStaffPortal(Number(req.params.id));
            return successResponse(res, result, 'Marcada como vista');
        } catch (err) {
            logger.error('Error in marcarVistaStaffPortal controller:', err);
            return errorResponse(res, err.message || 'Error al marcar como vista', 400, err.message);
        }
    }

    async getSolicitudPortal(req, res) {
        try {
            const result = await facturacionService.getSolicitudPortal(Number(req.params.id));
            if (!result) return errorResponse(res, 'Solicitud no encontrada', 404);
            return successResponse(res, result, 'Solicitud obtenida');
        } catch (err) {
            logger.error('Error in getSolicitudPortal controller:', err);
            return errorResponse(res, err.message || 'Error al obtener la solicitud', 400, err.message);
        }
    }

    async listarMensajesSolicitudPortal(req, res) {
        try {
            const result = await facturacionService.listarMensajesSolicitudPortal(Number(req.params.id));
            return successResponse(res, result, 'Mensajes obtenidos');
        } catch (err) {
            logger.error('Error in listarMensajesSolicitudPortal controller:', err);
            return errorResponse(res, err.message || 'Error al obtener los mensajes', 400, err.message);
        }
    }

    async enviarMensajeSolicitudPortal(req, res) {
        try {
            const archivos = req.files || [];
            const mensaje = String(req.body?.mensaje || '').trim() || (archivos.length ? 'Archivo adjunto' : '');
            if (!mensaje) return errorResponse(res, 'Escribe un mensaje o adjunta un archivo.', 400);
            // Se manda quién escribió para que el cliente vea la persona real y
            // no el usuario de servicio con el que viaja la llamada.
            const autor = {
                nombre: req.user?.nombre || req.user?.nombre_usuario || req.user?.username || null,
                email: req.user?.email || req.user?.correo || null,
            };
            const result = await facturacionService.enviarMensajeSolicitudPortal(Number(req.params.id), mensaje, autor, archivos);
            return successResponse(res, result, 'Mensaje enviado');
        } catch (err) {
            logger.error('Error in enviarMensajeSolicitudPortal controller:', err);
            return errorResponse(res, err.message || 'Error al enviar el mensaje', 400, err.message);
        }
    }

    async listarAdjuntosSolicitudPortal(req, res) {
        try {
            const result = await facturacionService.listarAdjuntosSolicitudPortal(Number(req.params.id));
            return successResponse(res, result, 'Adjuntos obtenidos');
        } catch (err) {
            logger.error('Error in listarAdjuntosSolicitudPortal controller:', err);
            return errorResponse(res, err.message || 'Error al obtener los adjuntos', 400, err.message);
        }
    }

    async descargarAdjuntoSolicitudPortal(req, res) {
        try {
            const { buffer, mime, disposition } = await facturacionService.descargarAdjuntoSolicitudPortal(
                Number(req.params.id), Number(req.params.idAdjunto));
            res.setHeader('Content-Type', mime);
            if (disposition) res.setHeader('Content-Disposition', disposition);
            return res.send(buffer);
        } catch (err) {
            logger.error('Error in descargarAdjuntoSolicitudPortal controller:', err);
            return errorResponse(res, err.message || 'Error al descargar el adjunto', 400, err.message);
        }
    }

    async crearCandidatoOc(req, res) {
        try {
            if (!req.file) return errorResponse(res, 'Debe adjuntar el PDF de la OC (campo "archivo").', 400);
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            // Ruta con :id = contra una pre-factura existente. Sin :id, es una OC
            // anticipada y se guarda contra el cliente (idEmpresaServicio).
            const idPrefactura = req.params.id ? Number(req.params.id) : null;
            const idEmpresaServicio = req.body?.idEmpresaServicio ? Number(req.body.idEmpresaServicio) : null;
            const result = await facturacionService.crearCandidatoOc(
                idPrefactura, req.file.buffer, req.file.originalname, 'MANUAL', idUsuario, idEmpresaServicio
            );
            return successResponse(res, result, result.anticipada
                ? 'OC anticipada guardada: quedará pendiente hasta que exista la pre-factura'
                : 'Candidato de OC registrado exitosamente', 201);
        } catch (err) {
            logger.error('Error in crearCandidatoOc controller:', err);
            return errorResponse(res, err.message || 'Error al registrar el candidato de OC', 400, err.message);
        }
    }

    async listarCandidatosOc(req, res) {
        try {
            const filtros = { idPrefactura: req.query.idPrefactura ? Number(req.query.idPrefactura) : undefined };
            const result = await facturacionService.listarCandidatosOc(filtros);
            return successResponse(res, result, 'Candidatos obtenidos exitosamente');
        } catch (err) {
            logger.error('Error in listarCandidatosOc controller:', err);
            return errorResponse(res, 'Error al listar candidatos de OC', 500, err.message);
        }
    }

    async confirmarCandidatoOc(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.confirmarCandidatoOc(Number(req.params.id), req.body, idUsuario);
            return successResponse(res, result, 'Candidato confirmado y OC registrada exitosamente', 201);
        } catch (err) {
            logger.error('Error in confirmarCandidatoOc controller:', err);
            return errorResponse(res, err.message || 'Error al confirmar el candidato', 400, err.message);
        }
    }

    async descartarCandidatoOc(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.descartarCandidatoOc(Number(req.params.id), idUsuario);
            return successResponse(res, result, 'Candidato descartado');
        } catch (err) {
            logger.error('Error in descartarCandidatoOc controller:', err);
            return errorResponse(res, err.message || 'Error al descartar el candidato', 400, err.message);
        }
    }

    async getEstadoCuenta(req, res) {
        try {
            const result = await facturacionService.getEstadoCuenta(Number(req.params.idEmpresaServicio));
            return successResponse(res, result, 'Estado de cuenta obtenido exitosamente');
        } catch (err) {
            logger.error('Error in getEstadoCuenta controller:', err);
            return errorResponse(res, 'Error al obtener el estado de cuenta', 500, err.message);
        }
    }

    async marcarFacturaPagada(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.marcarFacturaPagada(Number(req.params.id), req.body.fechaPago, idUsuario);
            return successResponse(res, result, 'Factura marcada como pagada exitosamente');
        } catch (err) {
            logger.error('Error in marcarFacturaPagada controller:', err);
            return errorResponse(res, err.message || 'Error al marcar la factura como pagada', 400, err.message);
        }
    }

    async resolverPrecio(req, res) {
        try {
            const idCentro = req.query.idCentro ? Number(req.query.idCentro) : undefined;
            // La empresa no se pide en pantalla: el centro ya la determina, y sin
            // ella los convenios (todos amarrados a empresa) nunca calzan.
            const idEmpresa = req.query.idEmpresa
                ? Number(req.query.idEmpresa)
                : (idCentro ? await facturacionService.getEmpresaDeCentro(idCentro) : undefined);
            const result = await facturacionService.resolverPrecioTecnica({
                idTecnica: Number(req.query.idTecnica),
                idTablama: req.query.idTablama ? Number(req.query.idTablama) : undefined,
                idEmpresaServicio: req.query.idEmpresaServicio ? Number(req.query.idEmpresaServicio) : undefined,
                idEmpresa: idEmpresa ?? undefined,
                idCentro,
            });
            return successResponse(res, result, result ? 'Precio resuelto' : 'No hay tarifa que calce para esa combinación');
        } catch (err) {
            logger.error('Error in resolverPrecio controller:', err);
            return errorResponse(res, err.message || 'Error al resolver el precio', 400, err.message);
        }
    }

    async crearCotizacion(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.crearCotizacion(req.body, idUsuario);
            return successResponse(res, result, 'Cotización creada exitosamente', 201);
        } catch (err) {
            logger.error('Error in crearCotizacion controller:', err);
            return errorResponse(res, err.message || 'Error al crear la cotización', 400, err.message);
        }
    }

    async listarCotizaciones(req, res) {
        try {
            const filtros = {
                idEmpresaServicio: req.query.idEmpresaServicio ? Number(req.query.idEmpresaServicio) : undefined,
                estado: req.query.estado || undefined,
            };
            const result = await facturacionService.listarCotizaciones(filtros);
            return successResponse(res, result, 'Cotizaciones obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in listarCotizaciones controller:', err);
            return errorResponse(res, 'Error al listar cotizaciones', 500, err.message);
        }
    }

    async getCotizacionDetalle(req, res) {
        try {
            const result = await facturacionService.getCotizacionDetalle(Number(req.params.id));
            if (!result) return errorResponse(res, 'Cotización no encontrada', 404);
            return successResponse(res, result, 'Detalle obtenido exitosamente');
        } catch (err) {
            logger.error('Error in getCotizacionDetalle controller:', err);
            return errorResponse(res, 'Error al obtener el detalle de la cotización', 500, err.message);
        }
    }

    async cambiarEstadoCotizacion(req, res) {
        try {
            const idUsuario = req.user?.id || req.user?.id_usuario || null;
            const result = await facturacionService.cambiarEstadoCotizacion(Number(req.params.id), req.body.estado, idUsuario);
            return successResponse(res, result, 'Estado de la cotización actualizado');
        } catch (err) {
            logger.error('Error in cambiarEstadoCotizacion controller:', err);
            return errorResponse(res, err.message || 'Error al cambiar el estado de la cotización', 400, err.message);
        }
    }

    async getFichasProximasARenovar(_req, res) {
        try {
            const result = await facturacionService.getFichasProximasARenovar();
            return successResponse(res, result, 'Fichas próximas a renovar obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in getFichasProximasARenovar controller:', err);
            return errorResponse(res, 'Error al obtener fichas próximas a renovar', 500, err.message);
        }
    }

    async getTarifasVigentesCliente(req, res) {
        try {
            const result = await facturacionService.getTarifasVigentesCliente(Number(req.params.idEmpresaServicio));
            return successResponse(res, result, 'Tarifas vigentes obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in getTarifasVigentesCliente controller:', err);
            return errorResponse(res, 'Error al obtener las tarifas vigentes', 500, err.message);
        }
    }
}

export default new FacturacionController();
