import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import notificationService from './notification.service.js';
import auditService from './audit.service.js';
import unsService from './uns.service.js';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit-table';
import ExcelJS from 'exceljs';
import { getTransporter } from '../config/mailer.js';

class FichaIngresoService {

    async createFicha(data) {
        // data structure: { antecedentes: {}, analisis: [], observaciones: "", user: { id: 1 } }
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            logger.info('Transaction started for createFicha');

            // 1. Generar ID Ficha (Manual MAX+1 logic from FoxPro)
            logger.debug('Generando nuevo ID de Ficha...');
            const requestCheck = new sql.Request(transaction);
            const idResult = await requestCheck.query('SELECT ISNULL(MAX(id_fichaingresoservicio), 0) + 1 as NewId FROM App_Ma_FichaIngresoServicio_ENC');
            const newId = idResult.recordset[0].NewId;
            const fechaHoy = new Date(); // Use server time
            logger.info(`Nuevo ID generado: ${newId}`);

            // 2. Insertar Encabezado (ENC)
            logger.debug('Preparando insert Encabezado...');
            const requestEnc = new sql.Request(transaction);

            // Map antecedente fields
            const ant = data.antecedentes || {};
            const obs = data.observaciones || '';
            const userId = data.user ? (data.user.id_usuario || data.user.id || 1) : 1;

            // Helper for empty strings/nulls
            const val = (v) => v === undefined || v === null || v === '' ? null : v;
            const valStr = (v, len) => {
                if (v === 'No Aplica' || v === 'No aplica') return 'No Aplica';
                return val(v) ? String(v).substring(0, len) : null;
            };
            const valNum = (v) => {
                if (v === 'No Aplica' || v === 'No aplica') return 0;
                return val(v) ? Number(v) : null;
            };

            // Construct Instrumento Ambiental string
            let instrumento = null;
            if (ant.selectedInstrumento && ant.selectedInstrumento !== 'No aplica') {
                instrumento = `${ant.selectedInstrumento} ${ant.nroInstrumento || ''}/${ant.anioInstrumento || ''}`;
            } else if (ant.selectedInstrumento === 'No aplica') {
                instrumento = 'No aplica';
            }

            // Construct Coordinates
            let coordenadas = null;
            if (ant.zona && ant.zona !== 'No aplica') {
                coordenadas = `${ant.zona} UTM ${ant.utmNorte || ''}E ${ant.utmEste || ''}S`;
            } else if (ant.zona === 'No aplica') {
                coordenadas = 'No aplica';
            }

            // Log payload for debugging
            logger.debug('Encabezado Payload:', JSON.stringify({
                id: newId,
                tipo_ficha: ant.tipoMonitoreo,
                id_usuario: userId
            }));

            requestEnc.input('id', sql.Numeric(10, 0), newId);
            requestEnc.input('tipo_ficha', sql.VarChar(20), valStr(ant.tipoMonitoreo, 20));
            requestEnc.input('ficha_txt', sql.VarChar(20), String(newId));
            requestEnc.input('id_lugaranalisis', sql.Numeric(10, 0), valNum(ant.selectedLugar));
            requestEnc.input('id_empresaservicio', sql.Numeric(10, 0), valNum(ant.selectedEmpresa));
            requestEnc.input('id_empresa', sql.Numeric(10, 0), valNum(ant.selectedCliente));
            requestEnc.input('id_centro', sql.Numeric(10, 0), valNum(ant.selectedFuente));
            requestEnc.input('id_tipoagua', sql.Numeric(10, 0), valNum(ant.idTipoAgua) || null);

            requestEnc.input('instrumento', sql.VarChar(50), valStr(instrumento, 50));
            requestEnc.input('id_objetivo', sql.Numeric(10, 0), valNum(ant.selectedObjetivo));
            requestEnc.input('nombre_tabla', sql.VarChar(150), valStr(ant.glosa, 150));
            requestEnc.input('etfa', sql.VarChar(1), ant.esETFA === 'Si' ? 'S' : 'N');
            requestEnc.input('punto_muestreo', sql.VarChar(250), valStr(ant.puntoMuestreo, 250));
            requestEnc.input('coordenadas', sql.VarChar(50), valStr(coordenadas, 50));

            requestEnc.input('id_tipomuestra', sql.Numeric(10, 0), valNum(ant.selectedComponente));
            requestEnc.input('id_subarea', sql.Numeric(10, 0), valNum(ant.selectedSubArea));
            requestEnc.input('id_tipodescarga', sql.Numeric(10, 0), valNum(ant.selectedTipoDescarga));
            requestEnc.input('id_contacto', sql.Numeric(10, 0), valNum(ant.selectedContacto));
            requestEnc.input('cliente_entrega', sql.VarChar(80), valStr(ant.contactoNombre || 'Cliente', 80));

            // Fix: id_tipomuestreo was missing input? No it was there.
            requestEnc.input('id_tipomuestreo', sql.Numeric(10, 0), valNum(ant.selectedTipoMuestreo));
            requestEnc.input('id_tipomuestra_ma', sql.Numeric(10, 0), valNum(ant.selectedTipoMuestra)); // Corrected column name
            requestEnc.input('id_actividad', sql.Numeric(10, 0), valNum(ant.selectedActividad));
            requestEnc.input('duracion', sql.VarChar(10), valStr(ant.duracion, 10));

            requestEnc.input('ref_google', sql.VarChar(200), valStr(ant.refGoogle, 200));
            requestEnc.input('medicion_caudal', sql.VarChar(10), valStr(ant.medicionCaudal, 10));
            requestEnc.input('id_modalidad', sql.Numeric(10, 0), valNum(ant.selectedModalidad));
            requestEnc.input('id_formacanal', sql.Numeric(10, 0), valNum(ant.formaCanal));
            requestEnc.input('formacanal_medida', sql.VarChar(50), valStr(ant.detalleCanal, 50));
            requestEnc.input('id_dispositivohidraulico', sql.Numeric(10, 0), valNum(ant.dispositivo));
            requestEnc.input('dispositivohidraulico_medida', sql.VarChar(50), valStr(ant.detalleDispositivo, 50));

            // ... (previous inputs)
            requestEnc.input('id_disp', sql.Numeric(10, 0), valNum(ant.dispositivo));
            requestEnc.input('disp_medida', sql.VarChar(50), valStr(ant.detalleDispositivo, 50));
            requestEnc.input('id_um_formacanal', sql.Int, valNum(ant.tipoMedidaCanal));
            requestEnc.input('id_um_dispositivohidraulico', sql.Int, valNum(ant.tipoMedidaDispositivo));

            // FoxPro Parity: Missing Fields defaults
            requestEnc.input('cond_flujo', sql.VarChar(1), '');
            requestEnc.input('cond_velocidad', sql.VarChar(1), '');
            requestEnc.input('cond_obs', sql.VarChar(250), '');
            requestEnc.input('cond_cumple', sql.VarChar(20), '');
            requestEnc.input('id_jefatura', sql.Numeric(10, 0), 0);
            requestEnc.input('fecha_jefatura', sql.Date, new Date('1900-01-01'));
            requestEnc.input('hora_jefatura', sql.VarChar(10), '');
            requestEnc.input('coord_ruta', sql.VarChar(30), '');
            requestEnc.input('id_val_tecnica', sql.Numeric(10, 0), 3); // Hardcoded 3 as per FoxPro
            requestEnc.input('obs_jefatura', sql.VarChar(250), '');
            requestEnc.input('obs_coordinador', sql.VarChar(250), '');


            const hours = String(fechaHoy.getHours()).padStart(2, '0');
            const minutes = String(fechaHoy.getMinutes()).padStart(2, '0');
            const seconds = String(fechaHoy.getSeconds()).padStart(2, '0');
            const horaStr = `${hours}:${minutes}:${seconds}`;

            requestEnc.input('id_usuario', sql.Numeric(10, 0), userId);
            requestEnc.input('fecha', sql.Date, fechaHoy);
            requestEnc.input('hora', sql.VarChar(20), horaStr);
            requestEnc.input('responsable', sql.VarChar(20), valStr(ant.responsableMuestreo, 20));
            requestEnc.input('obs_comercial', sql.VarChar(250), valStr(obs, 250));
            requestEnc.input('ubicacion', sql.VarChar(200), valStr(ant.ubicacion, 200));
            requestEnc.input('id_cargo', sql.Numeric(10, 0), valNum(ant.cargoResponsable));

            // Remuestreo tracking
            requestEnc.input('es_remuestreo', sql.VarChar(1), data.isRemuestreo ? 'S' : 'N');
            requestEnc.input('id_ficha_original', sql.Numeric(10, 0), data.isRemuestreo ? valNum(data.originalFichaId) : null);

            const queryEnc = `
                INSERT INTO App_Ma_FichaIngresoServicio_ENC (
                    id_fichaingresoservicio, tipo_fichaingresoservicio, fichaingresoservicio,
                    id_lugaranalisis, id_empresaservicio, id_empresa, id_centro, id_tipoagua,
                    instrumento_ambiental, id_objetivomuestreo_ma, nombre_tabla_largo,
                    etfa, ma_punto_muestreo, ma_coordenadas, 
                    id_tipomuestra, id_subarea, id_tipodescarga, id_contacto, cliente_entrega,
                    id_tipomuestreo, id_tipomuestra_ma, id_actividadmuestreo, ma_duracion_muestreo,
                    ficha_habilitado, estado_ficha, sincronizado, 
                    referencia_googlemaps, medicion_caudal, id_modalidad,
                    id_formacanal, formacanal_medida, id_dispositivohidraulico, dispositivohidraulico_medida,
                    id_um_formacanal, id_um_dispositivohidraulico,
                    condicionmedicion_flujolaminar, condicionmedicion_velocidaduniforme, condicionmedicion_observacion,
                    condicionmedicion_cumple, id_jefaturatecnica, fecha_jefaturatecnica,
                    hora_jefaturatecnica, coordenadas_ruta, id_validaciontecnica,
                    observaciones_jefaturatecnica, observaciones_coordinador,
                    id_usuario, fecha_fichacomercial, hora_fichacomercial,
                    responsablemuestreo, id_cargo, observaciones_comercial, ubicacion,
                    es_remuestreo, id_ficha_original
                ) VALUES (
                    @id, @tipo_ficha, @ficha_txt,
                    @id_lugaranalisis, @id_empresaservicio, @id_empresa, @id_centro, @id_tipoagua,
                    @instrumento, @id_objetivo, @nombre_tabla,
                    @etfa, @punto_muestreo, @coordenadas,
                    @id_tipomuestra, @id_subarea, @id_tipodescarga, @id_contacto, @cliente_entrega,
                    @id_tipomuestreo, @id_tipomuestra_ma, @id_actividad, @duracion,
                    'S', 'VIGENTE', 'N',
                    @ref_google, @medicion_caudal, @id_modalidad,
                    @id_formacanal, @formacanal_medida, @id_disp, @disp_medida,
                    @id_um_formacanal, @id_um_dispositivohidraulico,
                    @cond_flujo, @cond_velocidad, @cond_obs,
                    @cond_cumple, @id_jefatura, @fecha_jefatura,
                    @hora_jefatura, @coord_ruta, @id_val_tecnica,
                    @obs_jefatura, @obs_coordinador,
                    @id_usuario, @fecha, @hora,
                    @responsable, @id_cargo, @obs_comercial, @ubicacion,
                    @es_remuestreo, @id_ficha_original
                )
            `;
            await requestEnc.query(queryEnc);
            logger.info('Encabezado insertado correctamente');

            // 3. Insertar Detalle (DET)
            const analisisList = data.analisis || [];
            let itemCounter = 1;
            logger.info(`Insertando ${analisisList.length} items de detalle...`);

            if (analisisList.length > 0) {
                // --- CREATE FICHA ANALYSIS LOOP (INSERT ONLY) ---
                for (const row of analisisList) {
                    const requestDet = new sql.Request(transaction);
                    requestDet.input('id_ficha', sql.Numeric(10, 0), newId);
                    requestDet.input('id_tecnica', sql.Numeric(10, 0), valNum(row.id_tecnica));
                    requestDet.input('id_normativa', sql.Numeric(10, 0), valNum(row.id_normativa));
                    requestDet.input('id_normativareferencia', sql.Numeric(10, 0), valNum(row.id_normativareferencia));
                    requestDet.input('id_referenciaanalisis', sql.Numeric(10, 0), valNum(row.id_referenciaanalisis));
                    requestDet.input('limitemax_d', sql.Numeric(18, 5), valNum(row.limitemax_d));
                    requestDet.input('limitemax_h', sql.Numeric(18, 5), valNum(row.limitemax_h));
                    requestDet.input('llevaerror', sql.VarChar(1), row.llevaerror === true || row.llevaerror === 'S' || row.llevaerror === 'Y' ? 'S' : 'N');
                    requestDet.input('error_min', sql.Numeric(18, 5), valNum(row.error_min));
                    requestDet.input('error_max', sql.Numeric(18, 5), valNum(row.error_max));
                    requestDet.input('tipo_analisis', sql.VarChar(20), valStr(row.tipo_analisis, 20));
                    requestDet.input('uf', sql.Numeric(18, 5), valNum(row.uf_individual));
                    requestDet.input('item', sql.Numeric(10, 0), itemCounter);

                    let idLab = valNum(row.id_laboratorioensayo);
                    if (row.tipo_analisis && row.tipo_analisis.trim() === 'Terreno') { idLab = 0; }
                    requestDet.input('id_laboratorio', sql.Numeric(10, 0), idLab);

                    let idLab2 = valNum(row.id_laboratorioensayo_2);
                    if (row.tipo_analisis && row.tipo_analisis.trim() === 'Terreno') { idLab2 = 0; }
                    requestDet.input('id_laboratorio_2', sql.Numeric(10, 0), idLab2);

                    requestDet.input('id_tipoentrega', sql.Numeric(10, 0), valNum(row.id_tipoentrega || ant.id_tipoentrega));
                    requestDet.input('id_transporte', sql.Numeric(10, 0), valNum(row.id_transporte || ant.id_transporte));

                    requestDet.input('transporte_orden', sql.VarChar(20), '');
                    requestDet.input('res_fecha', sql.Date, new Date('1900-01-01'));
                    requestDet.input('res_hora', sql.VarChar(10), '');
                    requestDet.input('llevatrad', sql.VarChar(1), 'N');
                    requestDet.input('trad_0', sql.VarChar(250), '');
                    requestDet.input('trad_1', sql.VarChar(250), '');

                    await requestDet.query(`
                        INSERT INTO App_Ma_FichaIngresoServicio_DET(
                            id_fichaingresoservicio, id_tecnica, id_normativa, id_normativareferencia, id_referenciaanalisis,
                            limitemax_d, limitemax_h, llevaerror, error_min, error_max,
                            tipo_analisis, uf_individual, item, id_laboratorioensayo, id_laboratorioensayo_2, id_tipoentrega,
                            id_transporte, transporte_orden, resultado_fecha, resultado_hora,
                            llevatraduccion, traduccion_0, traduccion_1,
                            estado, cumplimiento, cumplimiento_app, activo
                        ) VALUES(
                            @id_ficha, @id_tecnica, @id_normativa, @id_normativareferencia, @id_referenciaanalisis,
                            @limitemax_d, @limitemax_h, @llevaerror, @error_min, @error_max,
                            @tipo_analisis, @uf, @item, @id_laboratorio, @id_laboratorio_2, @id_tipoentrega,
                            @id_transporte, @transporte_orden, @res_fecha, @res_hora,
                            @llevatrad, @trad_0, @trad_1,
                            '', '', '', 1
                        )
                    `);
                    itemCounter++;
                }
            }

            // 4. Crear Agenda (MUESTREOS)
            logger.info('Generando Agenda (Muestreos)...');
            const totalServicios = valNum(ant.totalServicios) || 1;
            const frecuencia = valNum(ant.frecuencia) || 1;
            const factor = valNum(ant.factor) || 1;

            let idFrecuencia = valNum(ant.periodo);
            if (!idFrecuencia && ant.periodo && typeof ant.periodo === 'string' && ant.periodo.startsWith('freq-')) {
                idFrecuencia = Number(ant.periodo.replace('freq-', ''));
            }

            for (let i = 1; i <= totalServicios; i++) {
                const requestAgenda = new sql.Request(transaction);
                requestAgenda.input('id_ficha', sql.Numeric(10, 0), newId);
                requestAgenda.input('id_inspector', sql.Numeric(10, 0), valNum(ant.selectedInspector));
                requestAgenda.input('frecu', sql.Numeric(10, 0), frecuencia);
                requestAgenda.input('id_frecu', sql.Numeric(10, 0), idFrecuencia);
                requestAgenda.input('def_date', sql.Date, new Date('1900-01-01'));
                requestAgenda.input('calc_factor', sql.Numeric(10, 0), factor);
                requestAgenda.input('total_serv', sql.Numeric(10, 0), totalServicios);
                requestAgenda.input('dummy_corr', sql.VarChar(50), 'PorAsignar');

                await requestAgenda.query(`
                    INSERT INTO App_Ma_Agenda_MUESTREOS(
                        id_fichaingresoservicio, id_inspectorambiental, fecha_muestreo, frecuencia, frecuencia_correlativo, id_frecuencia,
                        id_caso, caso_adlab, estado_caso, id_coordinador, id_muestreador, id_supervisor,
                        dia, mes, ano, id_estadomuestreo, totalizador_inicio, totalizador_final, vdd,
                        calculo_horas, frecuencia_factor, total_servicios,
                        fecha_coordinador, fecha_muestreador, fechaderivado, ma_muestreo_fechai, ma_muestreo_fechat, ma_fecha_compuesta, muestreador_fechai, muestreador_fechat
                    ) VALUES(
                        @id_ficha, @id_inspector, NULL, @frecu, @dummy_corr, @id_frecu,
                        9999999998, '', '', 0, 0, 0,
                        0, 0, 0, 0, 0.00, 0.00, 0.00,
                        0.00, @calc_factor, @total_serv,
                        @def_date, @def_date, @def_date, @def_date, @def_date, @def_date, @def_date, @def_date
                    )
                `);
            }

            // Assign Correlativos (Direct approach - no SP dependency)
            logger.info('Generating frecuencia_correlativo values...');

            const requestGetAgendas = new sql.Request(transaction);
            requestGetAgendas.input('id_ficha', sql.Numeric(10, 0), newId);

            const agendasResult = await requestGetAgendas.query(`
                SELECT id_agendamam
                FROM App_Ma_Agenda_MUESTREOS
                WHERE id_fichaingresoservicio = @id_ficha
                ORDER BY id_agendamam ASC
            `);

            if (agendasResult.recordset && agendasResult.recordset.length > 0) {
                let correlativoCounter = 1;
                for (const row of agendasResult.recordset) {
                    const idAgenda = row.id_agendamam;
                    const nuevoCorrelativo = `${newId}-${correlativoCounter}-Pendiente-${idAgenda}`;

                    const requestUpdateCorr = new sql.Request(transaction);
                    requestUpdateCorr.input('corr', sql.VarChar(50), nuevoCorrelativo);
                    requestUpdateCorr.input('id_ag', sql.Numeric(10, 0), idAgenda);

                    await requestUpdateCorr.query('UPDATE App_Ma_Agenda_MUESTREOS SET frecuencia_correlativo = @corr WHERE id_agendamam = @id_ag');
                    logger.info(`Generated correlativo: ${nuevoCorrelativo}`);
                    correlativoCounter++;
                }
                logger.info(`Generated ${correlativoCounter - 1} correlativos for ficha ${newId}`);
            }

            // 5. History
            await this.logHistorial(transaction, {
                idFicha: newId,
                idUsuario: userId,
                accion: 'CREACION_FICHA',
                estadoAnterior: '',
                estadoNuevo: 'Pendiente Técnica', // Default Initial State
                observacion: obs // Restore user observation
            });

            await transaction.commit();
            logger.info(`Ficha creada con éxito. ID: ${newId}`);

            // Notificacion
            const notifDate = new Date();
            const notifFecha = notifDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
            const notifHora = notifDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            // Intentar obtener nombre de usuario, fallback a ID o 'Usuario Sistema'
            // Intentar obtener nombre de usuario, fallback a ID o 'Usuario Sistema'
            let notifUser = data.user ? (data.user.nombre_usuario || data.user.usuario || data.user.name) : null;

            if (!notifUser && userId) {
                try {
                    const uRes = await pool.request().query(`SELECT nombre_usuario FROM mae_usuario WHERE id_usuario = ${userId}`);
                    if (uRes.recordset.length > 0) {
                        notifUser = uRes.recordset[0].nombre_usuario;
                    }
                } catch (e) { logger.warn('Could not fetch user name for notif', e); }
            }
            notifUser = notifUser || 'Usuario Sistema';

            // Intentar obtener el nombre del cliente para la notificación
            let nombreCliente = ant.contactoNombre || 'un Cliente';
            if (ant.selectedCliente) {
                try {
                    const cRes = await pool.request().query(`SELECT TOP 1 nombre_empresa FROM mae_empresa WHERE id_empresa = ${valNum(ant.selectedCliente)}`);
                    if (cRes.recordset.length > 0) {
                        nombreCliente = cRes.recordset[0].nombre_empresa;
                    }
                } catch (e) { logger.warn('Could not fetch client name for notif', e); }
            }

            const fichaEventCode = data.isRemuestreo ? 'FICHA_REMUESTREO_CREADA' : 'FICHA_CREADA';
            unsService.trigger(fichaEventCode, {
                correlativo: String(newId),
                id_usuario_accion: userId || (data.user ? (data.user.id_usuario || data.user.id) : 0),
                usuario_accion: notifUser,
                cliente: nombreCliente,
                fecha: notifFecha,
                hora: notifHora,
                observacion: obs || 'Sin observaciones',
                ficha_original: data.isRemuestreo ? String(data.originalFichaId) : null
            });

            // AUDITORIA INMUTABLE
            auditService.log({
                usuario_id: userId,
                area_key: ant.tipoMonitoreo === 'Terreno' ? 'it' : 'comercial', // Heuristic
                modulo_nombre: 'Fichas de Ingreso',
                evento_tipo: 'FICHA_CREACION',
                entidad_nombre: 'App_Ma_FichaIngresoServicio_ENC',
                entidad_id: newId,
                descripcion_humana: `El usuario ${notifUser} creó la ficha de ingreso #${newId}`,
                datos_nuevos: { ...ant, observaciones: obs },
                severidad: 1
            });

            return { success: true, id: newId, message: 'Ficha creada correctamente' };

        } catch (error) {
            console.error('CRITICAL CREATE ERROR:', error);
            try { await transaction.rollback(); } catch (e) { }
            throw error;
        }
    }

    // ----------------------------------------------------
    // UPDATE FICHA (RESTORED & IMPROVED)
    // ----------------------------------------------------
    async updateFicha(id, data, user) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            logger.info(`Transaction started for updateFicha ID: ${id}`);
            // FIX: Ensure User Name is available for logs
            logger.info('DEBUG updateFicha - user object:', user);
            let userName = String(user.nombre_usuario || user.usuario || user.name || 'Sistema');
            if (!userName || userName === 'undefined' || userName === 'Sistema') {
                if (user.id && user.id !== 0) {
                    try {
                        const uReq = new sql.Request(transaction);
                        uReq.input('uid', sql.Numeric(10, 0), user.id);
                        const uRes = await uReq.query('SELECT nombre_usuario FROM mae_usuario WHERE id_usuario = @uid');
                        if (uRes.recordset.length > 0) {
                            userName = String(uRes.recordset[0].nombre_usuario);
                        }
                    } catch (e) { logger.warn('Failed to fetch user name', e); }
                }
            }
            if (!userName || userName === 'undefined') userName = 'Sistema';
            logger.info(`DEBUG updateFicha - resolved userName: "${userName}"`);


            const ant = data.antecedentes || {};
            const analisisList = data.analisis || [];
            const obs = data.observaciones || '';

            // Helper validators
            const val = (v) => v === undefined || v === null || v === '' ? null : v;
            const valStr = (v, len) => {
                if (v === 'No Aplica' || v === 'No aplica') return 'No Aplica';
                return val(v) ? String(v).substring(0, len) : null;
            };
            const valNum = (v) => {
                if (v === 'No Aplica' || v === 'No aplica') return 0;
                return val(v) ? Number(v) : null;
            };

            // Construct Instrumento/Coordinates (Same logic as Create)
            let instrumento = null;
            if (ant.selectedInstrumento && ant.selectedInstrumento !== 'No aplica') {
                instrumento = `${ant.selectedInstrumento} ${ant.nroInstrumento || ''}/${ant.anioInstrumento || ''}`;
            } else if (ant.selectedInstrumento === 'No aplica') { instrumento = 'No aplica'; }

            let coordenadas = null;
            if (ant.zona && ant.zona !== 'No aplica') {
                coordenadas = `${ant.zona} UTM ${ant.utmNorte || ''}E ${ant.utmEste || ''}S`;
            } else if (ant.zona === 'No aplica') { coordenadas = 'No aplica'; }

            // 2. UPDATE ENCABEZADO (Antecedentes)
            const request = new sql.Request(transaction);
            request.input('id', sql.Numeric(10, 0), id);

            // Map ALL fields to verify parity
            request.input('id_lugaranalisis', sql.Numeric(10, 0), valNum(ant.selectedLugar));
            request.input('id_empresaservicio', sql.Numeric(10, 0), valNum(ant.selectedEmpresa));
            request.input('id_cliente', sql.Numeric(10, 0), valNum(ant.selectedCliente));
            request.input('id_centro', sql.Numeric(10, 0), valNum(ant.selectedFuente));
            request.input('id_tipoagua', sql.Numeric(10, 0), valNum(ant.idTipoAgua));
            request.input('instrumento', sql.VarChar(50), valStr(instrumento, 50));
            request.input('id_objetivo', sql.Numeric(10, 0), valNum(ant.selectedObjetivo));
            request.input('nombre_tabla', sql.VarChar(150), valStr(ant.glosa, 150));
            request.input('etfa', sql.VarChar(1), ant.esETFA === 'Si' ? 'S' : 'N');
            request.input('punto_muestreo', sql.VarChar(250), valStr(ant.puntoMuestreo, 250));
            request.input('coordenadas', sql.VarChar(50), valStr(coordenadas, 50));
            request.input('id_tipomuestra', sql.Numeric(10, 0), valNum(ant.selectedComponente));
            request.input('id_subarea', sql.Numeric(10, 0), valNum(ant.selectedSubArea));
            request.input('id_tipodescarga', sql.Numeric(10, 0), valNum(ant.selectedTipoDescarga));
            request.input('id_contacto', sql.Numeric(10, 0), valNum(ant.selectedContacto));
            request.input('cliente_entrega', sql.VarChar(80), valStr(ant.contactoNombre || 'Cliente', 80));
            request.input('id_tipomuestreo', sql.Numeric(10, 0), valNum(ant.selectedTipoMuestreo));
            request.input('id_tipomuestra_ma', sql.Numeric(10, 0), valNum(ant.selectedTipoMuestra));
            request.input('id_actividad', sql.Numeric(10, 0), valNum(ant.selectedActividad));
            request.input('duracion', sql.VarChar(10), valStr(ant.duracion, 10));
            request.input('ref_google', sql.VarChar(200), valStr(ant.refGoogle, 200));
            request.input('medicion_caudal', sql.VarChar(10), valStr(ant.medicionCaudal, 10));
            request.input('id_modalidad', sql.Numeric(10, 0), valNum(ant.selectedModalidad));
            request.input('id_formacanal', sql.Numeric(10, 0), valNum(ant.formaCanal));
            request.input('formacanal_medida', sql.VarChar(50), valStr(ant.detalleCanal, 50));
            request.input('id_disp', sql.Numeric(10, 0), valNum(ant.dispositivo));
            request.input('disp_medida', sql.VarChar(50), valStr(ant.detalleDispositivo, 50));
            request.input('id_um_formacanal', sql.Int, valNum(ant.tipoMedidaCanal));
            request.input('id_um_dispositivohidraulico', sql.Int, valNum(ant.tipoMedidaDispositivo));

            // Condition Metrics defaults (simplified update for existing fields)
            request.input('cond_flujo', sql.VarChar(1), '');
            request.input('ubicacion', sql.VarChar(200), valStr(ant.ubicacion, 200));
            request.input('responsable', sql.VarChar(20), valStr(ant.responsableMuestreo, 20));
            request.input('obs_comercial', sql.VarChar(250), valStr(obs, 250));
            request.input('id_cargo', sql.Numeric(10, 0), valNum(ant.cargoResponsable));
            request.input('tipo_ficha', sql.VarChar(20), valStr(ant.tipoMonitoreo, 20));

            await request.query(`
                UPDATE App_Ma_FichaIngresoServicio_ENC
                SET 
                    id_validaciontecnica = 3,
                    estado_ficha = 'PENDIENTE TÉCNICA',
                    tipo_fichaingresoservicio = @tipo_ficha,
                    id_lugaranalisis = @id_lugaranalisis,
                    id_empresaservicio = @id_empresaservicio,
                    id_empresa = @id_cliente,
                    id_centro = @id_centro,
                    id_tipoagua = @id_tipoagua,
                    instrumento_ambiental = @instrumento,
                    id_objetivomuestreo_ma = @id_objetivo,
                    nombre_tabla_largo = @nombre_tabla,
                    etfa = @etfa,
                    ma_punto_muestreo = @punto_muestreo,
                    ma_coordenadas = @coordenadas,
                    id_tipomuestra = @id_tipomuestra,
                    id_subarea = @id_subarea,
                    id_tipodescarga = @id_tipodescarga,
                    id_contacto = @id_contacto,
                    cliente_entrega = @cliente_entrega,
                    id_tipomuestreo = @id_tipomuestreo,
                    id_tipomuestra_ma = @id_tipomuestra_ma,
                    id_actividadmuestreo = @id_actividad,
                    ma_duracion_muestreo = @duracion,
                    referencia_googlemaps = @ref_google,
                    medicion_caudal = @medicion_caudal,
                    id_modalidad = @id_modalidad,
                    id_formacanal = @id_formacanal,
                    formacanal_medida = @formacanal_medida,
                    id_um_formacanal = @id_um_formacanal,
                    id_dispositivohidraulico = @id_disp,
                    dispositivohidraulico_medida = @disp_medida,
                    id_um_dispositivohidraulico = @id_um_dispositivohidraulico,
                    ubicacion = @ubicacion,
                    responsablemuestreo = @responsable,
                    observaciones_comercial = @obs_comercial,
                    id_cargo = @id_cargo
                WHERE id_fichaingresoservicio = @id
            `);

            // 3. UPDATE DETALLE (Analysis Upsert/Soft Delete)
            let itemCounter = 1;

            // Fetch existing IDs for Soft Delete
            const requestCheckAnalysis = new sql.Request(transaction);
            requestCheckAnalysis.input('id', sql.Numeric(10, 0), id);
            const existingAnalysis = await requestCheckAnalysis.query('SELECT id_referenciaanalisis FROM App_Ma_FichaIngresoServicio_DET WHERE id_fichaingresoservicio = @id');
            const existingMap = new Set(existingAnalysis.recordset.map(r => Number(r.id_referenciaanalisis)));
            const processedIds = new Set();

            // --- LOOP WILL FOLLOW IN THE REST OF THE FILE ---
            if (analisisList.length > 0) {

                for (const row of analisisList) {
                    const refId = valNum(row.id_referenciaanalisis);
                    processedIds.add(refId);

                    if (existingMap.has(refId)) {
                        // --- UPDATE EXISTING ---
                        const reqUpdateDet = new sql.Request(transaction);
                        reqUpdateDet.input('id_ficha', sql.Numeric(10, 0), id);
                        reqUpdateDet.input('id_ref', sql.Numeric(10, 0), refId);
                        reqUpdateDet.input('id_tecnica', sql.Numeric(10, 0), valNum(row.id_tecnica));
                        reqUpdateDet.input('id_normativa', sql.Numeric(10, 0), valNum(row.id_normativa));
                        reqUpdateDet.input('id_normativareferencia', sql.Numeric(10, 0), valNum(row.id_normativareferencia));
                        reqUpdateDet.input('limitemax_d', sql.Numeric(18, 5), valNum(row.limitemax_d));
                        reqUpdateDet.input('limitemax_h', sql.Numeric(18, 5), valNum(row.limitemax_h));
                        reqUpdateDet.input('llevaerror', sql.VarChar(1), row.llevaerror === true || row.llevaerror === 'S' || row.llevaerror === 'Y' ? 'S' : 'N');
                        reqUpdateDet.input('error_min', sql.Numeric(18, 5), valNum(row.error_min));
                        reqUpdateDet.input('error_max', sql.Numeric(18, 5), valNum(row.error_max));
                        reqUpdateDet.input('tipo_analisis', sql.VarChar(20), valStr(row.tipo_analisis, 20));
                        reqUpdateDet.input('uf', sql.Numeric(18, 5), valNum(row.uf_individual));
                        // Update Order
                        reqUpdateDet.input('item', sql.Numeric(10, 0), itemCounter);

                        let idLab = valNum(row.id_laboratorioensayo);
                        if (row.tipo_analisis && row.tipo_analisis.trim() === 'Terreno') { idLab = 0; }
                        reqUpdateDet.input('id_laboratorio', sql.Numeric(10, 0), idLab);

                        let idLab2 = valNum(row.id_laboratorioensayo_2);
                        if (row.tipo_analisis && row.tipo_analisis.trim() === 'Terreno') { idLab2 = 0; }
                        reqUpdateDet.input('id_laboratorio_2', sql.Numeric(10, 0), idLab2);

                        reqUpdateDet.input('id_tipoentrega', sql.Numeric(10, 0), valNum(row.id_tipoentrega || ant.id_tipoentrega));
                        reqUpdateDet.input('id_transporte', sql.Numeric(10, 0), valNum(row.id_transporte || ant.id_transporte));

                        await reqUpdateDet.query(`
                            UPDATE App_Ma_FichaIngresoServicio_DET
                            SET
                                id_tecnica = @id_tecnica,
                                id_normativa = @id_normativa,
                                id_normativareferencia = @id_normativareferencia,
                                limitemax_d = @limitemax_d,
                                limitemax_h = @limitemax_h,
                                llevaerror = @llevaerror,
                                error_min = @error_min,
                                error_max = @error_max,
                                tipo_analisis = @tipo_analisis,
                                uf_individual = @uf,
                                item = @item,
                                id_laboratorioensayo = @id_laboratorio,
                                id_laboratorioensayo_2 = @id_laboratorio_2,
                                id_tipoentrega = @id_tipoentrega,
                                id_transporte = @id_transporte,
                                activo = 1 -- REVIVE if it was deleted
                            WHERE id_fichaingresoservicio = @id_ficha AND id_referenciaanalisis = @id_ref
                        `);

                    } else {
                        // --- INSERT NEW ---
                        const requestDet = new sql.Request(transaction);
                        requestDet.input('id_ficha', sql.Numeric(10, 0), id);
                        requestDet.input('id_tecnica', sql.Numeric(10, 0), valNum(row.id_tecnica));
                        requestDet.input('id_normativa', sql.Numeric(10, 0), valNum(row.id_normativa));
                        requestDet.input('id_normativareferencia', sql.Numeric(10, 0), valNum(row.id_normativareferencia));
                        requestDet.input('id_referenciaanalisis', sql.Numeric(10, 0), valNum(row.id_referenciaanalisis));
                        requestDet.input('limitemax_d', sql.Numeric(18, 5), valNum(row.limitemax_d));
                        requestDet.input('limitemax_h', sql.Numeric(18, 5), valNum(row.limitemax_h));
                        requestDet.input('llevaerror', sql.VarChar(1), row.llevaerror === true || row.llevaerror === 'S' || row.llevaerror === 'Y' ? 'S' : 'N');
                        requestDet.input('error_min', sql.Numeric(18, 5), valNum(row.error_min));
                        requestDet.input('error_max', sql.Numeric(18, 5), valNum(row.error_max));
                        requestDet.input('tipo_analisis', sql.VarChar(20), valStr(row.tipo_analisis, 20));
                        requestDet.input('uf', sql.Numeric(18, 5), valNum(row.uf_individual));
                        requestDet.input('item', sql.Numeric(10, 0), itemCounter);

                        let idLab = valNum(row.id_laboratorioensayo);
                        if (row.tipo_analisis && row.tipo_analisis.trim() === 'Terreno') { idLab = 0; }
                        requestDet.input('id_laboratorio', sql.Numeric(10, 0), idLab);

                        let idLab2 = valNum(row.id_laboratorioensayo_2);
                        if (row.tipo_analisis && row.tipo_analisis.trim() === 'Terreno') { idLab2 = 0; }
                        requestDet.input('id_laboratorio_2', sql.Numeric(10, 0), idLab2);

                        requestDet.input('id_tipoentrega', sql.Numeric(10, 0), valNum(row.id_tipoentrega || ant.id_tipoentrega));
                        requestDet.input('id_transporte', sql.Numeric(10, 0), valNum(row.id_transporte || ant.id_transporte));

                        requestDet.input('transporte_orden', sql.VarChar(20), '');
                        requestDet.input('res_fecha', sql.Date, new Date('1900-01-01'));
                        requestDet.input('res_hora', sql.VarChar(10), '');
                        requestDet.input('llevatrad', sql.VarChar(1), 'N');
                        requestDet.input('trad_0', sql.VarChar(250), '');
                        requestDet.input('trad_1', sql.VarChar(250), '');

                        await requestDet.query(`
                            INSERT INTO App_Ma_FichaIngresoServicio_DET(
                                id_fichaingresoservicio, id_tecnica, id_normativa, id_normativareferencia, id_referenciaanalisis,
                                limitemax_d, limitemax_h, llevaerror, error_min, error_max,
                                tipo_analisis, uf_individual, item, id_laboratorioensayo, id_laboratorioensayo_2, id_tipoentrega,
                                id_transporte, transporte_orden, resultado_fecha, resultado_hora,
                                llevatraduccion, traduccion_0, traduccion_1,
                                estado, cumplimiento, cumplimiento_app, activo
                            ) VALUES(
                                @id_ficha, @id_tecnica, @id_normativa, @id_normativareferencia, @id_referenciaanalisis,
                                @limitemax_d, @limitemax_h, @llevaerror, @error_min, @error_max,
                                @tipo_analisis, @uf, @item, @id_laboratorio, @id_laboratorio_2, @id_tipoentrega,
                                @id_transporte, @transporte_orden, @res_fecha, @res_hora,
                                @llevatrad, @trad_0, @trad_1,
                                '', '', '', 1
                            )
                        `);
                    }
                    itemCounter++;
                }
            }

            // 3.2 SOFT DELETE Missing items
            // Update activo = 0 for items that were present but now removed from list
            const idsToDelete = [...existingMap].filter(x => !processedIds.has(x));
            if (idsToDelete.length > 0) {
                logger.info(`Soft Deleting ${idsToDelete.length} removed analysis items.`);
                // Loop delete
                for (const delId of idsToDelete) {
                    const reqDelete = new sql.Request(transaction);
                    reqDelete.input('id_ficha', sql.Numeric(10, 0), id);
                    reqDelete.input('id_ref', sql.Numeric(10, 0), delId);
                    await reqDelete.query('UPDATE App_Ma_FichaIngresoServicio_DET SET activo = 0 WHERE id_fichaingresoservicio = @id_ficha AND id_referenciaanalisis = @id_ref');
                }
            }


            // 4. SMART SYNC AGENDA
            // ---------------------------------------------------------
            // 4.1 Get current Agenda Logic
            const requestCheckAgenda = new sql.Request(transaction);
            requestCheckAgenda.input('id', sql.Numeric(10, 0), id);

            // Get ALL agenda items (including ANULADAS for potential reactivation)
            const allAgendaQuery = await requestCheckAgenda.query(`
                SELECT id_agendamam, frecuencia, total_servicios, frecuencia_factor, id_frecuencia, id_estadomuestreo, estado_caso, frecuencia_correlativo
                FROM App_Ma_Agenda_MUESTREOS 
                WHERE id_fichaingresoservicio = @id
                ORDER BY id_agendamam ASC
            `);

            const allRows = allAgendaQuery.recordset || [];
            const activeRows = allRows.filter(r => r.estado_caso !== 'CANCELADO');
            const anuladaRows = allRows.filter(r => r.estado_caso === 'CANCELADO');
            const currentCount = activeRows.length;
            const newTotalServicios = valNum(ant.totalServicios) || 1;
            const newFrecuencia = valNum(ant.frecuencia) || 1;
            const newFactor = valNum(ant.factor) || 1;
            let newIdFrecuencia = valNum(ant.periodo);
            if (!newIdFrecuencia && ant.periodo && typeof ant.periodo === 'string' && ant.periodo.startsWith('freq-')) {
                newIdFrecuencia = Number(ant.periodo.replace('freq-', ''));
            }

            logger.info(`Agenda Sync: Active=${currentCount}, Anuladas=${anuladaRows.length}, New=${newTotalServicios}, Freq=${newFrecuencia}`);

            // 4.2 Strategy: Update Existing Metadata for ALL overlapping items
            const countToUpdate = Math.min(currentCount, newTotalServicios);

            for (let i = 0; i < countToUpdate; i++) {
                const row = activeRows[i];
                // Update key metadata even if ID is preserved
                const reqUpdateAg = new sql.Request(transaction);
                reqUpdateAg.input('id_ag', sql.Numeric(10, 0), row.id_agendamam);
                reqUpdateAg.input('frecu', sql.Numeric(10, 0), newFrecuencia);
                reqUpdateAg.input('id_frecu', sql.Numeric(10, 0), newIdFrecuencia);
                reqUpdateAg.input('factor', sql.Numeric(10, 0), newFactor);
                reqUpdateAg.input('total', sql.Numeric(10, 0), newTotalServicios);

                logger.info(`Updating agenda item ${row.id_agendamam}: freq=${newFrecuencia}, id_freq=${newIdFrecuencia}, factor=${newFactor}, total=${newTotalServicios}`);

                await reqUpdateAg.query(`
                    UPDATE App_Ma_Agenda_MUESTREOS
                    SET frecuencia = @frecu, 
                        id_frecuencia = @id_frecu, 
                        frecuencia_factor = @factor, 
                        total_servicios = @total,
                        id_muestreador = 0,
                        ma_muestreo_fechai = '1900-01-01',
                        muestreador_fechai = '1900-01-01'
                    WHERE id_agendamam = @id_ag
                `);
            }

            // 4.3 Strategy: Increase servicios (Reactivate ANULADAS first, then create new)
            if (newTotalServicios > currentCount) {
                const itemsNeeded = newTotalServicios - currentCount;
                logger.info(`Agenda Sync: Need ${itemsNeeded} more items. Checking CANCELADOS for reactivation...`);

                let itemsReactivated = 0;
                let itemsCreated = 0;

                // STEP 1: Reactivate CANCELADOS (up to itemsNeeded)
                for (let i = 0; i < Math.min(itemsNeeded, anuladaRows.length); i++) {
                    const rowToReactivate = anuladaRows[i];
                    const reqReactivate = new sql.Request(transaction);
                    reqReactivate.input('id_ag', sql.Numeric(10, 0), rowToReactivate.id_agendamam);
                    reqReactivate.input('frecu', sql.Numeric(10, 0), newFrecuencia);
                    reqReactivate.input('id_frecu', sql.Numeric(10, 0), newIdFrecuencia);
                    reqReactivate.input('factor', sql.Numeric(10, 0), newFactor);
                    reqReactivate.input('total', sql.Numeric(10, 0), newTotalServicios);

                    await reqReactivate.query(`
                        UPDATE App_Ma_Agenda_MUESTREOS
                        SET estado_caso = NULL,
                            id_estadomuestreo = 0,
                            frecuencia = @frecu,
                            id_frecuencia = @id_frecu,
                            frecuencia_factor = @factor,
                            total_servicios = @total
                        WHERE id_agendamam = @id_ag
                    `);

                    logger.info(`Reactivated CANCELADO agenda item ${rowToReactivate.id_agendamam}`);
                    itemsReactivated++;
                }

                // STEP 2: Create NEW items (if still needed)
                const stillNeeded = itemsNeeded - itemsReactivated;
                if (stillNeeded > 0) {
                    logger.info(`Creating ${stillNeeded} new agenda items...`);

                    for (let i = 0; i < stillNeeded; i++) {
                        const requestAgenda = new sql.Request(transaction);
                        requestAgenda.input('id_ficha', sql.Numeric(10, 0), id);
                        requestAgenda.input('id_inspector', sql.Numeric(10, 0), valNum(ant.selectedInspector));
                        requestAgenda.input('frecu', sql.Numeric(10, 0), newFrecuencia);
                        requestAgenda.input('id_frecu', sql.Numeric(10, 0), newIdFrecuencia);
                        requestAgenda.input('def_date', sql.Date, new Date('1900-01-01'));
                        requestAgenda.input('calc_factor', sql.Numeric(10, 0), newFactor);
                        requestAgenda.input('total_serv', sql.Numeric(10, 0), newTotalServicios);
                        requestAgenda.input('dummy_corr', sql.VarChar(50), 'PorAsignar');

                        await requestAgenda.query(`
                            INSERT INTO App_Ma_Agenda_MUESTREOS(
                                id_fichaingresoservicio, id_inspectorambiental, fecha_muestreo, frecuencia, frecuencia_correlativo, id_frecuencia,
                                id_caso, caso_adlab, estado_caso, id_coordinador, id_muestreador, id_supervisor,
                                dia, mes, ano, id_estadomuestreo, totalizador_inicio, totalizador_final, vdd,
                                calculo_horas, frecuencia_factor, total_servicios,
                                fecha_coordinador, fecha_muestreador, fechaderivado, ma_muestreo_fechai, ma_muestreo_fechat, ma_fecha_compuesta, muestreador_fechai, muestreador_fechat
                            ) VALUES(
                                @id_ficha, @id_inspector, NULL, @frecu, @dummy_corr, @id_frecu,
                                9999999998, '', '', 0, 0, 0,
                                0, 0, 0, 0, 0.00, 0.00, 0.00,
                                0.00, @calc_factor, @total_serv,
                                @def_date, @def_date, @def_date, @def_date, @def_date, @def_date, @def_date, @def_date
                            )
                        `);
                        itemsCreated++;
                    }
                }

                logger.info(`Agenda increase complete: ${itemsReactivated} reactivated, ${itemsCreated} created`);
            }
            // 4.4 Strategy: Trim items
            else if (newTotalServicios < currentCount) {
                const itemsToRemove = currentCount - newTotalServicios;
                logger.info(`Agenda Sync: Reducing items by ${itemsToRemove}. Marking as CANCELADO.`);

                // We remove from the END (Tail)
                // e.g. if we have 4 items [0,1,2,3] and want 2, we mark indices 2 and 3 as CANCELADO.
                for (let i = newTotalServicios; i < currentCount; i++) {
                    const rowToRemove = activeRows[i];

                    // Get current correlativo and update it to ANULA
                    const currentCorr = rowToRemove.frecuencia_correlativo || '';
                    const newCorr = currentCorr.replace('-Pendiente-', '-CANCEL-');

                    const reqAnul = new sql.Request(transaction);
                    reqAnul.input('id_ag', sql.Numeric(10, 0), rowToRemove.id_agendamam);
                    reqAnul.input('new_corr', sql.VarChar(50), newCorr);

                    await reqAnul.query(`
                        UPDATE App_Ma_Agenda_MUESTREOS 
                        SET estado_caso = 'CANCELADO', 
                            id_estadomuestreo = 99,
                            frecuencia_correlativo = @new_corr
                        WHERE id_agendamam = @id_ag
                    `);

                    logger.info(`Marked agenda item ${rowToRemove.id_agendamam} as CANCELADO with correlativo ${newCorr}`);
                }
            }


            // 4.5 REGENERATE ALL CORRELATIVOS (Ensure consistency)
            logger.info('Regenerating all frecuencia_correlativo values...');

            const reqGetAll = new sql.Request(transaction);
            reqGetAll.input('id_ficha', sql.Numeric(10, 0), id);

            const allFinalAgenda = await reqGetAll.query(`
                SELECT id_agendamam, estado_caso
                FROM App_Ma_Agenda_MUESTREOS
                WHERE id_fichaingresoservicio = @id_ficha
                ORDER BY id_agendamam ASC
            `);

            let corrCounter = 1;
            for (const agRow of allFinalAgenda.recordset) {
                const estado = agRow.estado_caso === 'CANCELADO' ? 'CANCEL' : 'Pendiente';
                const newCorr = `${id}-${corrCounter}-${estado}-${agRow.id_agendamam}`;

                const reqUpdCorr = new sql.Request(transaction);
                reqUpdCorr.input('corr', sql.VarChar(50), newCorr);
                reqUpdCorr.input('aid', sql.Numeric(10, 0), agRow.id_agendamam);

                await reqUpdCorr.query('UPDATE App_Ma_Agenda_MUESTREOS SET frecuencia_correlativo = @corr WHERE id_agendamam = @aid');
                corrCounter++;
            }

            logger.info(`Regenerated ${corrCounter - 1} correlativos for ficha ${id}`);

            // 5. HISTORY
            await this.logHistorial(transaction, {
                idFicha: id,
                idUsuario: user.id,
                accion: 'EDICION_POR_AREA_COMERCIAL',
                estadoAnterior: 'Modificado',
                estadoNuevo: 'Pendiente Técnica',
                observacion: obs // Clean obs
            });

            await transaction.commit();
            logger.info(`Ficha ${id} updated successfully`);

            // AUDITORIA INMUTABLE
            auditService.log({
                usuario_id: user.id,
                area_key: ant.tipoMonitoreo === 'Terreno' ? 'it' : (user.area || 'comercial'),
                modulo_nombre: 'Fichas de Ingreso',
                evento_tipo: 'CAMBIO_COMERCIAL',
                entidad_nombre: 'App_Ma_FichaIngresoServicio_ENC',
                entidad_id: id,
                descripcion_humana: `El usuario ${userName} actualizó la ficha #${id} (Edición Comercial)`,
                datos_nuevos: { ...ant, observaciones: obs },
                severidad: 1
            });

            return { success: true, message: 'Ficha actualizada correctamente' };

        } catch (error) {
            console.error('CRITICAL UPDATE ERROR:', error);
            try { await transaction.rollback(); } catch (e) { }
            throw error;
        }
    }
    async getEnProcesoFichas(month, year) {
        const pool = await getConnection();
        try {
            let whereClause = `WHERE (f.id_validaciontecnica = 5 OR f.id_validaciontecnica = 7)`;

            if (month && year) {
                whereClause += ` AND MONTH(a.fecha_muestreo) = ${parseInt(month)} AND YEAR(a.fecha_muestreo) = ${parseInt(year)}`;
            } else if (year) {
                whereClause += ` AND YEAR(a.fecha_muestreo) = ${parseInt(year)}`;
            }

            const result = await pool.request().query(`
                SELECT
                    a.id_agendamam as id_agenda,
                    f.id_fichaingresoservicio as id,
                    f.fichaingresoservicio as ficha_correlativo,
                    a.frecuencia_correlativo as correlativo,
                    a.fecha_muestreo as fecha,
                    a.id_muestreador,
                    a.id_muestreador2,
                    m.nombre_muestreador as muestreador,
                    m2.nombre_muestreador as muestreador_retiro,
                    f.tipo_fichaingresoservicio as tipo_ficha,
                    es.nombre_empresaservicios as empresa_servicio,
                    es.email_empresaservicios as correo_empresa_servicio,
                    emp.nombre_empresa as cliente,
                    emp.email_empresa as email_cliente,
                    CASE WHEN f.id_contacto > 0 AND (co.email_contacto NOT LIKE '%adldiagnostic.cl' OR co.email_contacto IS NULL) THEN co.nombre_contacto ELSE NULL END as contacto,
                    CASE WHEN f.id_contacto > 0 AND (co.email_contacto NOT LIKE '%adldiagnostic.cl' OR co.email_contacto IS NULL) THEN co.email_contacto ELSE NULL END as correo_contacto,
                    om.nombre_objetivomuestreo_ma as objetivo,
                    sa.nombre_subarea as subarea,
                    DAY(a.fecha_muestreo) as dia,
                    MONTH(a.fecha_muestreo) as mes,
                    YEAR(a.fecha_muestreo) as ano,
                    ce.nombre_centro as centro,
                    a.fecha_retiro,
                    f.nombre_tabla_largo as glosa,
                    a.estado_caso,
                    a.motivo_cancelacion,
                    f.id_validaciontecnica,
                    f.es_remuestreo,
                    f.id_ficha_original
                FROM App_Ma_FichaIngresoServicio_ENC f
                INNER JOIN App_Ma_Agenda_MUESTREOS a ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
                LEFT JOIN mae_muestreador m ON a.id_muestreador = m.id_muestreador
                LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
                LEFT JOIN mae_empresaservicios es ON f.id_empresaservicio = es.id_empresaservicio
                LEFT JOIN mae_empresa emp ON f.id_empresa = emp.id_empresa
                LEFT JOIN mae_contacto co ON f.id_contacto = co.id_contacto
                LEFT JOIN mae_objetivomuestreo_ma om ON f.id_objetivomuestreo_ma = om.id_objetivomuestreo_ma
                LEFT JOIN mae_subarea sa ON f.id_subarea = sa.id_subarea
                LEFT JOIN mae_centro ce ON f.id_centro = ce.id_centro
                ${whereClause}
                ORDER BY 
                    CASE 
                        WHEN a.fecha_muestreo IS NULL THEN 1
                        WHEN CAST(a.fecha_muestreo AS DATE) = '1900-01-01' THEN 1
                        ELSE 0 
                    END ASC,
                    a.fecha_muestreo ASC, 
                    f.id_fichaingresoservicio DESC
            `);
            return result.recordset;
        } catch (error) {
            logger.error('Error fetching en proceso fichas:', error);
            throw error;
        }
    }

    async getAllFichas() {
        const pool = await getConnection();
        // Updated to use the correct Stored Procedure provided by user
        try {
            const result = await pool.request().execute('MAM_FichaComercial_ConsultaComercial');
            // Sort by id descending since the SP might not guarantee order
            if (result.recordset) {
                result.recordset.sort((a, b) => (b.id || b.id_fichaingresoservicio) - (a.id || a.id_fichaingresoservicio));
            }
            return result.recordset;
        } catch (error) {
            // Fallback to manual query only if SP fails (e.g. not present in DB)
            logger.warn('SP MAM_FichaComercial_ConsultaComercial failed, falling back to manual query', error);
            const resultFallback = await pool.request().query(`
            SELECT
            f.id_fichaingresoservicio as id,
                f.fichaingresoservicio as correlativo,
                f.fecha_fichacomercial as fecha,
                e.nombre_empresa as cliente,
                c.nombre_centro as centro,
                es.nombre_empresa as empresa_servicio,
                om.nombre_objetivomuestreo_ma as objetivo,
                sa.nombre_subarea as subarea,
                f.responsablemuestreo as responsable,
                u.nombre_usuario as usuario,
                f.tipo_fichaingresoservicio as tipo_ficha,
                f.estado_ficha as estado,
                CASE WHEN f.id_validaciontecnica = 1 THEN 'Aprobada' 
                         WHEN f.id_validaciontecnica = 2 THEN 'Rechazada'
                         ELSE 'Pendiente' END as estado_tecnico
                FROM App_Ma_FichaIngresoServicio_ENC f
                LEFT JOIN mae_empresa e ON f.id_empresa = e.id_empresa
                LEFT JOIN mae_centro c ON f.id_centro = c.id_centro
                LEFT JOIN mae_empresa es ON f.id_empresaservicio = es.id_empresa
                LEFT JOIN mae_objetivomuestreo_ma om ON f.id_objetivomuestreo_ma = om.id_objetivomuestreo_ma
                LEFT JOIN mae_subarea sa ON f.id_subarea = sa.id_subarea
                LEFT JOIN mae_usuario u ON f.id_usuario = u.id_usuario
                ORDER BY f.id_fichaingresoservicio DESC
            `);
            return resultFallback.recordset;
        }
    }

    async getFichaById(id) {
        const io = await getConnection();
        const pool = await getConnection();
        const request = pool.request();
        // Param for legacy SP
        request.input('xunafichacomercial', sql.Numeric(10, 0), id);

        try {
            // 1. Get Encabezado (ENC) using legacy SP
            // 1. Get Encabezado (ENC) using legacy SP
            const requestEnc = pool.request();
            requestEnc.input('xunafichacomercial', sql.Numeric(10, 0), id);
            const resultEnc = await requestEnc.execute('MAM_FichaComercial_ConsultaComercial_ENC_unaficha');

            let ficha = null;
            if (!resultEnc.recordset || resultEnc.recordset.length === 0) {
                logger.warn(`Ficha ID ${id} not found via SP ENC. Attempting fallback query...`);

                const fallbackEnc = await pool.request()
                    .input('id', sql.Numeric(10, 0), id)
                    .query(`
                    SELECT f.*,
                        f.es_remuestreo,
                        f.id_ficha_original,
                        e.nombre_empresaservicios,
                        em.nombre_empresa,
                        c.nombre_centro,
                        ta.nombre_tipoagua,
                        (SELECT u.nombre_usuario FROM mae_usuario u WHERE u.id_usuario = f.id_usuario) as nombre_usuario
                    FROM App_Ma_FichaIngresoServicio_ENC f
                    LEFT JOIN mae_empresaservicios e ON f.id_empresaservicio = e.id_empresaservicio
                    LEFT JOIN mae_empresa em ON f.id_empresa = em.id_empresa
                    LEFT JOIN mae_centro c ON f.id_centro = c.id_centro
                    LEFT JOIN mae_tipoagua ta ON f.id_tipoagua = ta.id_tipoagua
                    WHERE f.id_fichaingresoservicio = @id
                `);

                if (!fallbackEnc.recordset || fallbackEnc.recordset.length === 0) {
                    logger.warn(`Ficha ID ${id} completely missing. Fallback returned 0 rows.`);
                    return null;
                }
                ficha = fallbackEnc.recordset[0];
            } else {
                ficha = resultEnc.recordset[0];
                
                // DATA ENRICHMENT: Si el SP no incluye campos de remuestreo, los buscamos manualmente
                if (ficha.es_remuestreo === undefined || ficha.es_remuestreo === null) {
                    const extraRes = await pool.request()
                        .input('id', sql.Numeric(10, 0), id)
                        .query('SELECT es_remuestreo, id_ficha_original FROM App_Ma_FichaIngresoServicio_ENC WHERE id_fichaingresoservicio = @id');
                    if (extraRes.recordset.length > 0) {
                        ficha.es_remuestreo = extraRes.recordset[0].es_remuestreo;
                        ficha.id_ficha_original = extraRes.recordset[0].id_ficha_original;
                    }
                }
            }
            // PATCH: Fetch real status from 'mae_validaciontecnica' (Correct source for Ficha Status).
            // Mapping it to 'nombre_estadomuestreo' to force Frontend display priority.
            try {
                const patchReq = pool.request();
                patchReq.input('pid', sql.Numeric(10, 0), id);
                const patchRes = await patchReq.query(`
                    SELECT vt.nombre_validaciontecnica
                    FROM App_Ma_FichaIngresoServicio_ENC f 
                    LEFT JOIN mae_validaciontecnica vt ON f.id_validaciontecnica = vt.id_validaciontecnica 
                    WHERE f.id_fichaingresoservicio = @pid
                `);

                if (patchRes.recordset.length > 0) {
                    const extra = patchRes.recordset[0];
                    if (extra.nombre_validaciontecnica) {
                        ficha.nombre_estadomuestreo = extra.nombre_validaciontecnica;
                        ficha.estado_ficha = extra.nombre_validaciontecnica; // UI Fix
                        ficha.nombre_validaciontecnica = extra.nombre_validaciontecnica; // Update both for consistency
                    }
                }
            } catch (errPatch) {
                logger.warn('Failed to patch nombre_validaciontecnica:', errPatch);
            }

            logger.info(`Ficha ID ${id} Encabezado retrieved.Obs: ${ficha.observaciones_comercial} `);

            // 2. Get Agenda (MUESTREOS) using legacy SP
            const requestAgenda = pool.request();
            requestAgenda.input('xunafichacomercial', sql.Numeric(10, 0), id);
            const resultAgenda = await requestAgenda.execute('MAM_FichaComercial_ConsultaComercial_Agenda_MUESTREOS_unaficha');
            // FIX: SP returns multiple rows (one per frequency change), take the LAST row which has the most recent data
            const agendaRows = resultAgenda.recordset || [];
            ficha.agenda = agendaRows.length > 0 ? agendaRows[agendaRows.length - 1] : {};
            logger.info(`Ficha ID ${id} Agenda retrieved.Inspector: ${ficha.agenda.nombre_inspector} `);

            // 3. Get Detalle (DET) using legacy SP
            const requestDet = pool.request();
            requestDet.input('xunafichacomercial', sql.Numeric(10, 0), id);
            let resultDet;
            try {
                resultDet = await requestDet.execute('MAM_FichaComercial_ConsultaComercial_DET_unaficha');
                ficha.detalles = resultDet.recordset || [];
            } catch (errDet) {
                logger.warn('SP MAM_FichaComercial_ConsultaComercial_DET_unaficha failed, trying fallback', errDet);
                ficha.detalles = [];
            }

            // FALLBACK / REPAIR: If SP returns empty but we know data exists (or to be safe)
            // Query App_Ma_FichaIngresoServicio_DET directly to get Analysis data
            if (ficha.detalles.length === 0) {
                try {
                    const fallbackDet = await pool.request().input('id', sql.Numeric(10, 0), id).query(`
                       SELECT 
                            d.*,
                            t.nombre_tecnica,
                            n.nombre_normativa,
                            nr.nombre_normativareferencia,
                            ra.id_referenciaanalisis,
                            l.nombre_laboratorioensayo,
                            l2.nombre_laboratorioensayo as nombre_laboratorioensayo_2,
                            te.nombre_tipoentrega
                        FROM App_Ma_FichaIngresoServicio_DET d
                        LEFT JOIN mae_tecnica t ON d.id_tecnica = t.id_tecnica
                        LEFT JOIN mae_normativa n ON d.id_normativa = n.id_normativa
                        LEFT JOIN mae_normativareferencia nr ON d.id_normativareferencia = nr.id_normativareferencia
                        LEFT JOIN mae_referenciaanalisis ra ON d.id_referenciaanalisis = ra.id_referenciaanalisis
                        LEFT JOIN mae_laboratorioensayo l ON d.id_laboratorioensayo = l.id_laboratorioensayo
                        LEFT JOIN mae_laboratorioensayo l2 ON d.id_laboratorioensayo_2 = l2.id_laboratorioensayo
                        LEFT JOIN mae_tipoentrega te ON d.id_tipoentrega = te.id_tipoentrega
                        WHERE d.id_fichaingresoservicio = @id AND d.activo = 1
                    `);
                    if (fallbackDet.recordset && fallbackDet.recordset.length > 0) {
                        ficha.detalles = fallbackDet.recordset;
                        logger.info(`Ficha ID ${id} Detalles retrieved via FALLBACK. Count: ${ficha.detalles.length}`);
                    }
                } catch (errFallback) {
                    logger.error('Fallback details query failed', errFallback);
                }
            }

            logger.info(`Ficha ID ${id} Detalles retrieved.Count: ${ficha.detalles.length} `);

            // 4. PARITY CHECK: Fetch raw params directly from tables to ensure Edit Mode works
            // Legacy SPs might exclude columns needed for React Edit
            try {
                const parityCheck = await pool.request().input('id', sql.Numeric(10, 0), id).query(`
                    SELECT TOP 1
                        e.instrumento_ambiental,
                        e.id_empresaservicio,
                        e.ma_punto_muestreo,
                        e.ma_coordenadas,
                        e.tipo_fichaingresoservicio,
                        e.id_lugaranalisis,
                        e.id_tipoagua,
                        e.ubicacion,
                        e.nombre_tabla_largo,
                        e.id_contacto,
                        e.id_objetivomuestreo_ma,
                        e.id_cargo,
                        e.id_tipomuestreo,
                        e.id_tipomuestra_ma,
                        e.id_tipomuestra,
                        e.id_subarea,
                        e.id_actividadmuestreo,
                        e.id_tipodescarga,
                        e.id_modalidad,
                        e.id_formacanal,
                        e.id_dispositivohidraulico,
                        a.frecuencia,
                        a.total_servicios,
                        a.frecuencia_factor,
                        a.id_frecuencia,
                        la.nombre_lugaranalisis,
                        em1.nombre_empresa AS nombre_empresa,
                        em1.email_empresa,
                        es2.nombre_empresaservicios,
                        c.nombre_centro,
                        c.codigo_centro,
                        com.nombre_comuna,
                        reg.nombre_region,
                        co.nombre_contacto,
                        co.email_contacto,
                        obj.nombre_objetivomuestreo_ma,
                        car.nombre_cargo,
                        tm.nombre_tipomuestreo,
                        tma.nombre_tipomuestra_ma,
                        tm2.nombre_tipomuestra AS nombre_tipomuestra,
                        sa.nombre_subarea AS nombre_subarea,
                        act.nombre_actividadmuestreo,
                        td.nombre_tipodescarga,
                        mod.nombre_modalidad,
                        fc.nombre_formacanal,
                        dh.nombre_dispositivohidraulico,
                        t.nombre_tipoagua,
                        um1.nombre_umedida AS nombre_um_formacanal,
                        um2.nombre_umedida AS nombre_um_dispositivohidraulico,
                        e.id_um_formacanal,
                        e.id_um_dispositivohidraulico,
                        es2.email_empresaservicios,
                        es2.contacto_empresaservicios
                    FROM App_Ma_FichaIngresoServicio_ENC e
                    LEFT JOIN App_Ma_Agenda_MUESTREOS a ON e.id_fichaingresoservicio = a.id_fichaingresoservicio
                    LEFT JOIN mae_lugaranalisis la ON e.id_lugaranalisis = la.id_lugaranalisis
                    LEFT JOIN mae_empresa em1 ON e.id_empresa = em1.id_empresa
                    LEFT JOIN mae_empresaservicios es2 ON e.id_empresaservicio = es2.id_empresaservicio
                    LEFT JOIN mae_centro c ON e.id_centro = c.id_centro
                    LEFT JOIN mae_comuna com ON c.id_comuna = com.id_comuna
                    LEFT JOIN mae_region reg ON c.id_region = reg.id_region
                    LEFT JOIN mae_contacto co ON e.id_contacto = co.id_contacto
                    LEFT JOIN mae_objetivomuestreo_ma obj ON e.id_objetivomuestreo_ma = obj.id_objetivomuestreo_ma
                    LEFT JOIN mae_cargo car ON e.id_cargo = car.id_cargo
                    LEFT JOIN mae_tipomuestreo tm ON e.id_tipomuestreo = tm.id_tipomuestreo
                    LEFT JOIN mae_tipomuestra_ma tma ON e.id_tipomuestra_ma = tma.id_tipomuestra_ma
                    LEFT JOIN mae_tipomuestra tm2 ON e.id_tipomuestra = tm2.id_tipomuestra
                    LEFT JOIN mae_subarea sa ON e.id_subarea = sa.id_subarea
                    LEFT JOIN mae_actividadmuestreo act ON e.id_actividadmuestreo = act.id_actividadmuestreo
                    LEFT JOIN mae_tipodescarga td ON e.id_tipodescarga = td.id_tipodescarga
                    LEFT JOIN mae_modalidad mod ON e.id_modalidad = mod.id_modalidad
                    LEFT JOIN mae_formacanal fc ON e.id_formacanal = fc.id_formacanal
                    LEFT JOIN mae_dispositivohidraulico dh ON e.id_dispositivohidraulico = dh.id_dispositivohidraulico
                    LEFT JOIN mae_umedida um1 ON e.id_um_formacanal = um1.id_umedida
                    LEFT JOIN mae_umedida um2 ON e.id_um_dispositivohidraulico = um2.id_umedida
                    LEFT JOIN mae_tipoagua t ON e.id_tipoagua = t.id_tipoagua
                    WHERE e.id_fichaingresoservicio = @id
                `);

                if (parityCheck.recordset.length > 0) {
                    const raw = parityCheck.recordset[0];

                    // Merge raw data into ficha (Encabezado)
                    ficha.instrumento_ambiental = ficha.instrumento_ambiental ?? raw.instrumento_ambiental;
                    // Note: DB column is id_empresaservicio (singular), but frontend/params might expect plural key if legacy SP returned it.
                    ficha.id_empresaservicios = ficha.id_empresaservicios ?? raw.id_empresaservicio;
                    ficha.id_empresaservicio = ficha.id_empresaservicio ?? raw.id_empresaservicio;

                    ficha.ma_punto_muestreo = ficha.ma_punto_muestreo ?? raw.ma_punto_muestreo;
                    ficha.ma_coordenadas = ficha.ma_coordenadas ?? raw.ma_coordenadas;
                    ficha.tipo_fichaingresoservicio = ficha.tipo_fichaingresoservicio ?? raw.tipo_fichaingresoservicio;
                    ficha.id_lugaranalisis = ficha.id_lugaranalisis ?? raw.id_lugaranalisis;

                    ficha.id_tipoagua = ficha.id_tipoagua ?? raw.id_tipoagua;
                    ficha.ubicacion = ficha.ubicacion ?? raw.ubicacion;
                    ficha.nombre_tabla_largo = ficha.nombre_tabla_largo ?? raw.nombre_tabla_largo;

                    ficha.id_contacto = ficha.id_contacto ?? raw.id_contacto;
                    ficha.id_objetivomuestreo_ma = ficha.id_objetivomuestreo_ma ?? raw.id_objetivomuestreo_ma;
                    ficha.id_cargo = ficha.id_cargo ?? raw.id_cargo;
                    ficha.id_tipomuestreo = ficha.id_tipomuestreo ?? raw.id_tipomuestreo;
                    ficha.id_tipomuestra_ma = ficha.id_tipomuestra_ma ?? raw.id_tipomuestra_ma;
                    ficha.id_tipomuestra = ficha.id_tipomuestra ?? raw.id_tipomuestra;
                    ficha.id_subarea = ficha.id_subarea ?? raw.id_subarea;
                    ficha.id_actividadmuestreo = ficha.id_actividadmuestreo ?? raw.id_actividadmuestreo;
                    ficha.id_tipodescarga = ficha.id_tipodescarga ?? raw.id_tipodescarga;
                    ficha.id_modalidad = ficha.id_modalidad ?? raw.id_modalidad;
                    ficha.id_formacanal = ficha.id_formacanal ?? raw.id_formacanal;
                    ficha.id_dispositivohidraulico = ficha.id_dispositivohidraulico ?? raw.id_dispositivohidraulico;

                    ficha.codigo_centro = ficha.codigo_centro ?? raw.codigo_centro;

                    // Helper to choose truthy and non-placeholder value
                    const val = (fVal, rVal) => {
                        if (fVal === null || fVal === undefined || fVal === '' || fVal === '-' || fVal === 'Sin Nombre') return rVal;
                        return fVal;
                    };

                    // Hydrate names
                    ficha.nombre_lugaranalisis = val(ficha.nombre_lugaranalisis, raw.nombre_lugaranalisis);
                    ficha.nombre_empresa = val(ficha.nombre_empresa, raw.nombre_empresa);
                    ficha.nombre_empresaservicios = val(ficha.nombre_empresaservicios, raw.nombre_empresaservicios);
                    ficha.email_empresa = null; // Removing from UI
                    ficha.nombre_contacto = (ficha.id_contacto === 0 || !ficha.id_contacto) ? raw.contacto_empresaservicios : val(ficha.nombre_contacto, raw.nombre_contacto);
                    ficha.email_contacto = (ficha.id_contacto === 0 || !ficha.id_contacto) ? (raw.email_empresaservicios || raw.email_contacto) : val(ficha.email_contacto, raw.email_contacto);
                    ficha.nombre_centro = val(ficha.nombre_centro, raw.nombre_centro);
                    ficha.nombre_comuna = val(ficha.nombre_comuna, raw.nombre_comuna);
                    ficha.nombre_region = val(ficha.nombre_region, raw.nombre_region);
                    ficha.nombre_objetivomuestreo_ma = val(ficha.nombre_objetivomuestreo_ma, raw.nombre_objetivomuestreo_ma);
                    ficha.nombre_cargo = val(ficha.nombre_cargo, raw.nombre_cargo);
                    ficha.nombre_tipomuestreo = val(ficha.nombre_tipomuestreo, raw.nombre_tipomuestreo);
                    ficha.nombre_tipomuestra_ma = val(ficha.nombre_tipomuestra_ma, raw.nombre_tipomuestra_ma);
                    ficha.nombre_tipomuestra = val(ficha.nombre_tipomuestra, raw.nombre_tipomuestra);
                    ficha.nombre_subarea = val(ficha.nombre_subarea, raw.nombre_subarea);
                    ficha.nombre_actividadmuestreo = val(ficha.nombre_actividadmuestreo, raw.nombre_actividadmuestreo);
                    ficha.nombre_tipodescarga = val(ficha.nombre_tipodescarga, raw.nombre_tipodescarga);
                    ficha.nombre_modalidad = val(ficha.nombre_modalidad, raw.nombre_modalidad);
                    ficha.nombre_formacanal = val(ficha.nombre_formacanal, raw.nombre_formacanal);
                    ficha.nombre_dispositivohidraulico = val(ficha.nombre_dispositivohidraulico, raw.nombre_dispositivohidraulico);
                    ficha.nombre_um_formacanal = val(ficha.nombre_um_formacanal, raw.nombre_um_formacanal);
                    ficha.nombre_um_dispositivohidraulico = val(ficha.nombre_um_dispositivohidraulico, raw.nombre_um_dispositivohidraulico);
                    ficha.id_um_formacanal = ficha.id_um_formacanal ?? raw.id_um_formacanal;
                    ficha.id_um_dispositivohidraulico = ficha.id_um_dispositivohidraulico ?? raw.id_um_dispositivohidraulico;

                    // Merge raw data into ficha.agenda
                    ficha.agenda = ficha.agenda || {};
                    ficha.agenda.frecuencia = ficha.agenda.frecuencia ?? raw.frecuencia;
                    ficha.agenda.total_servicios = ficha.agenda.total_servicios ?? raw.total_servicios;
                    ficha.agenda.frecuencia_factor = ficha.agenda.frecuencia_factor ?? raw.frecuencia_factor;
                    ficha.agenda.id_frecuencia = ficha.agenda.id_frecuencia ?? raw.id_frecuencia;
                }
            } catch (parityError) {
                logger.warn('Parity check failed:', parityError);
            }

            // FINAL FIX: Calculate estado_ficha using the SAME logic as the list SP
            // This ensures consistency between table list and detail view
            if (ficha.id_validaciontecnica !== undefined && ficha.id_validaciontecnica !== null) {
                let calculatedStatus;

                switch (Number(ficha.id_validaciontecnica)) {
                    case 3:
                        calculatedStatus = 'Pendiente Área Técnica';
                        break;
                    case 2:
                        calculatedStatus = 'Rechazada Área Técnica';
                        break;
                    case 1:
                        // Cuando Técnica aprueba, pasa automáticamente a Coordinación
                        calculatedStatus = 'Pendiente Área Coordinación';
                        break;
                    case 4:
                        calculatedStatus = 'Rechazada Área Coordinación';
                        break;
                    case 5:
                        // Cuando se asignan fechas y muestreadores
                        calculatedStatus = 'En Proceso';
                        break;
                    case 6:
                        calculatedStatus = 'Pendiente Programación';
                        break;
                    case 7:
                        calculatedStatus = 'Cancelado';
                        break;
                    case 0:
                        // ID 0 no tiene información, no mostrar
                        calculatedStatus = null;
                        break;
                    default:
                        // Fallback to existing estado_ficha or nombre_validaciontecnica
                        calculatedStatus = ficha.estado_ficha || ficha.nombre_validaciontecnica || 'VIGENTE';
                }

                if (calculatedStatus) {
                    ficha.estado_ficha = calculatedStatus;
                    ficha.nombre_estadomuestreo = calculatedStatus;
                    logger.info(`getFichaById: Calculated estado_ficha='${calculatedStatus}' from id_validaciontecnica=${ficha.id_validaciontecnica}`);
                }
            }

            return ficha;

        } catch (error) {
            logger.error('Error in getFichaById using SPs:', error);
            throw error;
        }
    }

    // --- History Helper ---
    // Helper function to get user name from database
    async getUserName(transaction, userId) {
        if (!userId) return 'Usuario';
        try {
            const userRequest = new sql.Request(transaction);
            userRequest.input('userId', sql.Numeric(10, 0), userId);
            const userResult = await userRequest.query('SELECT nombre_usuario, usuario FROM mae_usuario WHERE id_usuario = @userId');
            if (userResult.recordset.length > 0) {
                return userResult.recordset[0].nombre_usuario || userResult.recordset[0].usuario || 'Usuario';
            }
        } catch (error) {
            logger.warn('Error fetching user name:', error);
        }
        return 'Usuario';
    }

    async logHistorial(transaction, { idFicha, idUsuario, accion, estadoAnterior, estadoNuevo, observacion }) {
        try {
            const request = new sql.Request(transaction);
            request.input('id_ficha', sql.Numeric(10, 0), idFicha);
            request.input('id_usuario', sql.Numeric(10, 0), idUsuario);
            request.input('accion', sql.VarChar(50), accion);
            request.input('estado_ant', sql.VarChar(50), estadoAnterior || '');
            request.input('estado_new', sql.VarChar(50), estadoNuevo || '');
            request.input('obs', sql.VarChar(sql.MAX), observacion || '');

            await request.query(`
                INSERT INTO mae_ficha_historial(id_fichaingresoservicio, id_usuario, accion, estado_anterior, estado_nuevo, observacion)
            VALUES(@id_ficha, @id_usuario, @accion, @estado_ant, @estado_new, @obs)
                `);
        } catch (error) {
            logger.error('Error logging history:', error);
            // Don't block main flow if history fails, but good to know
        }
    }

    async getHistorial(id) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .query(`
            SELECT
            h.id_historial,
                h.fecha,
                h.accion,
                h.observacion,
                u.nombre_usuario,
                u.usuario as nombre_real,
                h.estado_anterior,
                h.estado_nuevo
                    FROM mae_ficha_historial h
                    LEFT JOIN mae_usuario u ON h.id_usuario = u.id_usuario
                    WHERE h.id_fichaingresoservicio = @id
                    ORDER BY h.fecha DESC
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error getting history:', error);
            return [];
        }
    }


    async approveFicha(id, { observaciones }, user) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            const request = new sql.Request(transaction);
            request.input('id', sql.Numeric(10, 0), id);
            request.input('obs', sql.VarChar(250), observaciones || '');
            request.input('userId', sql.Numeric(10, 0), user.id);

            // Get current state (optional, for history) - Skipping for speed, assume known flow

            // 1 = Aprobada (Val Technique)
            await request.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET id_validaciontecnica = 1, estado_ficha = 'Pendiente Área Coordinación', observaciones_jefaturatecnica = @obs WHERE id_fichaingresoservicio = @id");

            // LOG HISTORY
            await this.logHistorial(transaction, {
                idFicha: id,
                idUsuario: user.id,
                accion: 'APROBACION_TECNICA',
                estadoAnterior: 'Pendiente Técnica',
                estadoNuevo: 'Pendiente Coordinación',
                observacion: observaciones || ''
            });

            await transaction.commit();

            // NOTIFICATION: Aprobada Técnica
            const notifDate = new Date();
            const notifFecha = notifDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

            let notifUser = user ? (user.nombre_usuario || user.usuario || user.name) : null;

            // Fetch owner for notif
            let ownerId = 0;
            try {
                const ownerReq = new sql.Request(transaction);
                const ownerRes = await ownerReq.query(`SELECT id_usuario FROM App_Ma_FichaIngresoServicio_ENC WHERE id_fichaingresoservicio = ${id}`);
                if (ownerRes.recordset.length > 0) ownerId = ownerRes.recordset[0].id_usuario;
            } catch (e) { logger.warn('Could not fetch owner for notif', e); }

            notifUser = notifUser || 'Jefatura Técnica';

            unsService.trigger('FICHA_APROBADA_TECNICA', {
                correlativo: String(id),
                id_usuario_accion: user ? (user.id || user.id_usuario || 0) : 0,
                id_usuario_propietario: ownerId,
                usuario_accion: notifUser,
                fecha: notifFecha,
                observacion: observaciones || 'Validación técnica conforme.'
            });

            // AUDITORIA INMUTABLE
            auditService.log({
                usuario_id: user.id,
                area_key: 'it',
                modulo_nombre: 'Fichas de Ingreso',
                evento_tipo: 'APROBACION_TECNICA',
                entidad_nombre: 'App_Ma_FichaIngresoServicio_ENC',
                entidad_id: id,
                descripcion_humana: `El usuario ${notifUser} aprobó la ficha #${id} (Área Técnica)`,
                datos_nuevos: { observaciones },
                severidad: 1
            });

            return { success: true, message: 'Ficha aprobada técnica' };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async rejectFicha(id, { observaciones }, user) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            const request = new sql.Request(transaction);
            request.input('id', sql.Numeric(10, 0), id);
            request.input('obs', sql.VarChar(250), observaciones || '');
            // 2 = Rechazada
            await request.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET id_validaciontecnica = 2, estado_ficha = 'Rechazada Técnica', observaciones_jefaturatecnica = @obs WHERE id_fichaingresoservicio = @id");

            // LOG HISTORY
            await this.logHistorial(transaction, {
                idFicha: id,
                idUsuario: user.id,
                accion: 'RECHAZO_TECNICA',
                estadoAnterior: 'Pendiente Técnica',
                estadoNuevo: 'Rechazada Técnica',
                observacion: observaciones || ''
            });

            await transaction.commit();

            // NOTIFICATION: Rechazada Técnica
            const notifDate = new Date();
            const notifFecha = notifDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

            let notifUser = user ? (user.nombre_usuario || user.usuario || user.name) : null;

            // Fetch owner for notif
            let ownerId = 0;
            try {
                const ownerReq = new sql.Request(transaction);
                const ownerRes = await ownerReq.query(`SELECT id_usuario FROM App_Ma_FichaIngresoServicio_ENC WHERE id_fichaingresoservicio = ${id}`);
                if (ownerRes.recordset.length > 0) ownerId = ownerRes.recordset[0].id_usuario;
            } catch (e) { logger.warn('Could not fetch owner for notif', e); }

            notifUser = notifUser || 'Jefatura Técnica';

            unsService.trigger('FICHA_RECHAZADA_TECNICA', {
                correlativo: String(id),
                id_usuario_accion: user ? (user.id || user.id_usuario || 0) : 0,
                id_usuario_propietario: ownerId,
                usuario_accion: notifUser,
                fecha: notifFecha,
                observacion: observaciones || 'Sin motivo especificado'
            });

            // AUDITORIA INMUTABLE
            auditService.log({
                usuario_id: user.id,
                area_key: 'it',
                modulo_nombre: 'Fichas de Ingreso',
                evento_tipo: 'RECHAZO_TECNICA',
                entidad_nombre: 'App_Ma_FichaIngresoServicio_ENC',
                entidad_id: id,
                descripcion_humana: `El usuario ${notifUser} rechazó la ficha #${id} (Área Técnica)`,
                datos_nuevos: { observaciones },
                severidad: 2
            });

            return { success: true, message: 'Ficha rechazada' };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }


    async approveCoordinacion(id, { observaciones }, user) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool); // Require transaction for history consistency

        try {
            await transaction.begin();

            // VALIDATION: Strict Check
            // Need to run this check BEFORE transaction or inside. Inside is safer for data integrity
            const requestCheck = new sql.Request(transaction);
            const check = await requestCheck.query(`SELECT id_validaciontecnica FROM App_Ma_FichaIngresoServicio_ENC WHERE id_fichaingresoservicio = ${id} `);

            if (!check.recordset[0] || check.recordset[0].id_validaciontecnica !== 1) {
                throw new Error("No se puede gestionar Coordinación: Ficha no aprobada por Técnica.");
            }

            const request = new sql.Request(transaction);
            request.input('id', sql.Numeric(10, 0), id);
            request.input('obs', sql.VarChar(250), observaciones);
            // We set id_validaciontecnica = 6 (Pendiente Programación)
            await request.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET id_validaciontecnica = 6, estado_ficha = 'PENDIENTE PROGRAMACIÓN', observaciones_coordinador = @obs WHERE id_fichaingresoservicio = @id");

            // LOG HISTORY
            await this.logHistorial(transaction, {
                idFicha: id,
                idUsuario: user.id,
                accion: 'APROBACION_COORDINACION',
                estadoAnterior: 'Pendiente Coordinación', // Or previous state name
                estadoNuevo: 'PENDIENTE PROGRAMACIÓN',
                observacion: observaciones || ''
            });

            await transaction.commit();

            // NOTIFICACION: Aprobada Coordinación
            const notifDate = new Date();
            const notifFecha = notifDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

            let notifUser = user ? (user.nombre_usuario || user.usuario || user.name) : null;

            // Fetch owner for notif
            let ownerId = 0;
            try {
                const ownerReq = new sql.Request(transaction);
                const ownerRes = await ownerReq.query(`SELECT id_usuario FROM App_Ma_FichaIngresoServicio_ENC WHERE id_fichaingresoservicio = ${id}`);
                if (ownerRes.recordset.length > 0) ownerId = ownerRes.recordset[0].id_usuario;
            } catch (e) { logger.warn('Could not fetch owner for notif', e); }

            notifUser = notifUser || 'Coordinación';

            unsService.trigger('FICHA_APROBADA_COORDINACION', {
                correlativo: String(id),
                id_usuario_accion: user ? (user.id || user.id_usuario || 0) : 0,
                id_usuario_propietario: ownerId,
                usuario_accion: notifUser,
                fecha: notifFecha,
                observacion: observaciones || 'Validación coordinación conforme.'
            });

            // AUDITORIA INMUTABLE
            auditService.log({
                usuario_id: user.id,
                area_key: 'coordinacion',
                modulo_nombre: 'Fichas de Ingreso',
                evento_tipo: 'APROBACION_COORDINACION',
                entidad_nombre: 'App_Ma_FichaIngresoServicio_ENC',
                entidad_id: id,
                descripcion_humana: `El usuario ${notifUser} aprobó la ficha #${id} (Área Coordinación)`,
                datos_nuevos: { observaciones },
                severidad: 1
            });

            return { success: true };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async reviewCoordinacion(id, { observaciones }, user) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            const request = new sql.Request(transaction);
            request.input('id', sql.Numeric(10, 0), id);
            request.input('obs', sql.VarChar(250), observaciones);
            // Reset validacion tecnica? -> 3 (Pendiente Técnica) per requirements? Or 4 (Revisar)? 
            // Previous code said 3. Let's keep 3 (Pendiente Técnica) or introduce 4 (Rechazada Coordinacion / Revisar)
            // Using 4 as per workflow status logic comments
            await request.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET id_validaciontecnica = 4, estado_ficha = 'Rechazada Coordinación', observaciones_coordinador = @obs WHERE id_fichaingresoservicio = @id");

            // LOG HISTORY
            // LOG HISTORY
            await this.logHistorial(transaction, {
                idFicha: id,
                idUsuario: user.id,
                accion: 'RECHAZO_COORDINACION',
                estadoAnterior: 'Pendiente Coordinación',
                estadoNuevo: 'Revisar (Coord)',
                observacion: observaciones || ''
            });

            await transaction.commit();

            // NOTIFICACION: Rechazada Coordinación (Enviada a Revisión)
            const notifDate = new Date();
            const notifFecha = notifDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

            let notifUser = user ? (user.nombre_usuario || user.usuario || user.name) : null;

            // Fetch owner for notif
            let ownerId = 0;
            try {
                const ownerReq = new sql.Request(transaction);
                const ownerRes = await ownerReq.query(`SELECT id_usuario FROM App_Ma_FichaIngresoServicio_ENC WHERE id_fichaingresoservicio = ${id}`);
                if (ownerRes.recordset.length > 0) ownerId = ownerRes.recordset[0].id_usuario;
            } catch (e) { logger.warn('Could not fetch owner for notif', e); }

            notifUser = notifUser || 'Coordinación';

            unsService.trigger('FICHA_RECHAZADA_COORDINACION', {
                correlativo: String(id),
                id_usuario_accion: user ? (user.id || user.id_usuario || 0) : 0,
                id_usuario_propietario: ownerId,
                usuario_accion: notifUser,
                fecha: notifFecha,
                observacion: observaciones || 'Ficha devuelta a revisión técnica.'
            });

            // AUDITORIA INMUTABLE
            auditService.log({
                usuario_id: user.id,
                area_key: 'coordinacion',
                modulo_nombre: 'Fichas de Ingreso',
                evento_tipo: 'RECHAZO_COORDINACION',
                entidad_nombre: 'App_Ma_FichaIngresoServicio_ENC',
                entidad_id: id,
                descripcion_humana: `El usuario ${notifUser} devolvió la ficha #${id} a revisión técnica (Área Coordinación)`,
                datos_nuevos: { observaciones },
                severidad: 2
            });

            return { success: true };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async updateAgenda(id, { idMuestreador, fecha, observaciones }, user) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            const request = new sql.Request(transaction);
            request.input('id', sql.Numeric(10, 0), id);
            request.input('muestreador', sql.Numeric(10, 0), idMuestreador);
            // Parse date string to object
            request.input('fecha', sql.Date, new Date(fecha));

            // Logic to update App_Ma_Agenda_MUESTREOS
            // Assuming updating all agenda items for this ficha that are pending?
            // Or just specific ones. For simplicity updating all for this ficha
            await request.query(`
                UPDATE App_Ma_Agenda_MUESTREOS 
                SET id_muestreador = @muestreador, fecha_muestreo = @fecha, id_estadomuestreo = 2, id_coordinador = ${user.id || 0}
                WHERE id_fichaingresoservicio = @id
                `);

            // LOG HISTORY (Assignment)
            await this.logHistorial(transaction, {
                idFicha: id,
                idUsuario: user.id || 0,
                accion: 'ASIGNACION_MUESTREO',
                estadoAnterior: 'Pendiente Programación',
                estadoNuevo: 'En Proceso',
                observacion: `Ficha ${id} asignación de muestreo por el Área Coordinación. Responsable: ${user.nombre_usuario || user.usuario || 'Usuario'}. ${observaciones ? 'Obs: ' + observaciones : ''}`
            });

            // UPDATE FICHA STATUS TO 5 (En Proceso)
            const reqStatus = new sql.Request(transaction);
            reqStatus.input('id', sql.Numeric(10, 0), id);
            await reqStatus.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET id_validaciontecnica = 5, estado_ficha = 'EN PROCESO' WHERE id_fichaingresoservicio = @id AND id_validaciontecnica = 6");

            await transaction.commit();

            // AUDITORIA INMUTABLE
            auditService.log({
                usuario_id: user.id || 0,
                area_key: 'coordinacion',
                modulo_nombre: 'Programación Muestreo',
                evento_tipo: 'ASIGNACION_MUESTREO',
                entidad_nombre: 'App_Ma_Agenda_MUESTREOS',
                entidad_id: id,
                descripcion_humana: `El usuario ${user.nombre_usuario || user.usuario || 'Usuario'} asignó programacion a la ficha #${id}`,
                datos_nuevos: { idMuestreador, fecha, observaciones },
                severidad: 1
            });

            return { success: true };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getForAssignment() {
        const pool = await getConnection();
        try {
            // Updated to use the correct Stored Procedure from FoxPro (Modified via script)
            const result = await pool.request().execute('MAM_FichaComercial_ConsultaCoordinador');
            return result.recordset;
        } catch (error) {
            logger.error('SP MAM_FichaComercial_ConsultaCoordinador failed', error);
            throw error;
        }
    }

    async getAllFichas() {
        const pool = await getConnection();
        try {
            const result = await pool.request().execute('MAM_FichaComercial_ConsultaComercial');
            return result.recordset;
        } catch (error) {
            logger.error('SP MAM_FichaComercial_ConsultaComercial failed in getAllFichas', error);
            throw error;
        }
    }

    async getForAssignmentDetail(id, estado) {
        const pool = await getConnection();
        const request = pool.request();
        request.input('xid_fichaingresoservicio', sql.Numeric(10, 0), id);
        request.input('xid_estadomuestreo', sql.Numeric(10, 0), estado);

        let baseRows = [];

        try {
            // 1. Try to get base data from Stored Procedure
            try {
                const result = await request.execute('MAM_FichaComercial_ConsultaCoordinadorDetalle');
                if (result.recordset && result.recordset.length > 0) {
                    baseRows = result.recordset;
                }
            } catch (spErr) {
                logger.warn(`SP MAM_FichaComercial_ConsultaCoordinadorDetalle failed for ficha ${id}, using fallback.`, spErr);
            }

            // 2. If SP failed or returned empty, use Fallback Query
            if (baseRows.length === 0) {
                const fallbackRequest = pool.request();
                fallbackRequest.input('xid_fichaingresoservicio', sql.Numeric(10, 0), id);
                const resFallback = await fallbackRequest.query(`
                    SELECT a.*, 
                           m.nombre_muestreador,
                           em.nombre_estadomuestreo,
                           f.nombre_frecuencia
                    FROM App_Ma_Agenda_MUESTREOS a
                    LEFT JOIN mae_muestreador m ON a.id_muestreador = m.id_muestreador
                    LEFT JOIN mae_estadomuestreo em ON a.id_estadomuestreo = em.id_estadomuestreo
                    LEFT JOIN mae_frecuencia f ON a.id_frecuencia = f.id_frecuencia
                    WHERE a.id_fichaingresoservicio = @xid_fichaingresoservicio
                    AND (a.estado_caso IS NULL OR a.estado_caso != 'CANCELADO')
                    ORDER BY a.id_agendamam
                `);
                baseRows = resFallback.recordset;
            }

            if (!baseRows || baseRows.length === 0) return [];

            // 3. ALWAYS ENRICH the base data with business fields and resampling metadata
            const enrichRequest = pool.request();
            enrichRequest.input('xid_fichaingresoservicio', sql.Numeric(10, 0), id);

            const enrichResult = await enrichRequest.query(`
                SELECT
                    a.id_agendamam,
                    a.fecha_muestreo,
                    a.ma_muestreo_fechat,
                    a.fecha_retiro,
                    a.id_muestreador2,
                    a.estado_caso,
                    a.id_estadomuestreo,
                    m.nombre_muestreador,
                    m2.nombre_muestreador as nombre_muestreador2,
                    e.id_fichaingresoservicio as num_ficha,
                    e.ma_duracion_muestreo,
                    e.es_remuestreo,
                    e.id_ficha_original,
                    emp.nombre_empresa as empresa_servicio,
                    cen.nombre_centro as centro,
                    obj.nombre_objetivomuestreo_ma as nombre_objetivomuestreo,
                    sub.nombre_subarea,
                    ISNULL(coord.nombre_coordinador, u_coord.nombre_usuario) as nombre_coordinador,
                    (SELECT TOP 1 m_orig.nombre_muestreador 
                     FROM App_Ma_Agenda_MUESTREOS a_orig 
                     JOIN mae_muestreador m_orig ON a_orig.id_muestreador = m_orig.id_muestreador 
                     WHERE a_orig.id_fichaingresoservicio = e.id_ficha_original
                     ORDER BY a_orig.id_agendamam ASC) as nombre_muestreador_original,
                    (SELECT TOP 1 a_orig.id_muestreador 
                     FROM App_Ma_Agenda_MUESTREOS a_orig 
                     WHERE a_orig.id_fichaingresoservicio = e.id_ficha_original
                     ORDER BY a_orig.id_agendamam ASC) as id_muestreador_original
                FROM App_Ma_Agenda_MUESTREOS a
                LEFT JOIN App_Ma_FichaIngresoServicio_ENC e ON a.id_fichaingresoservicio = e.id_fichaingresoservicio
                LEFT JOIN mae_muestreador m ON a.id_muestreador = m.id_muestreador
                LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
                LEFT JOIN mae_empresa emp ON e.id_empresa = emp.id_empresa
                LEFT JOIN mae_centro cen ON e.id_centro = cen.id_centro
                LEFT JOIN mae_objetivomuestreo_ma obj ON e.id_objetivomuestreo_ma = obj.id_objetivomuestreo_ma
                LEFT JOIN mae_subarea sub ON e.id_subarea = sub.id_subarea
                LEFT JOIN mae_coordinador coord ON a.id_coordinador = coord.id_coordinador
                LEFT JOIN mae_usuario u_coord ON e.id_usuario = u_coord.id_usuario
                WHERE a.id_fichaingresoservicio = @xid_fichaingresoservicio
            `);

            const enrichMap = {};
            enrichResult.recordset.forEach(row => {
                enrichMap[row.id_agendamam] = row;
            });

            // 4. Merge baseRows with enrichment data
            return baseRows.map(row => {
                const em = enrichMap[row.id_agendamam] || {};
                return {
                    ...row,
                    frecuencia: em.frecuencia || row.frecuencia || 1,
                    total_servicios: em.total_servicios || row.total_servicios || 1,
                    frecuencia_factor: em.frecuencia_factor || row.frecuencia_factor || 1,
                    num_ficha: em.num_ficha || row.num_ficha,
                    empresa_servicio: em.empresa_servicio || row.empresa_servicio,
                    centro: em.centro || row.centro,
                    nombre_objetivomuestreo: em.nombre_objetivomuestreo || row.nombre_objetivomuestreo,
                    nombre_coordinador: em.nombre_coordinador || row.nombre_coordinador,
                    nombre_subarea: em.nombre_subarea || row.nombre_subarea,
                    fecha_muestreo: em.fecha_muestreo || row.fecha_muestreo || null,
                    fecha_retiro: em.fecha_retiro || row.fecha_retiro || row.ma_muestreo_fechat || null,
                    id_muestreador2: em.id_muestreador2 || row.id_muestreador2 || null,
                    nombre_muestreador2: em.nombre_muestreador2 || row.nombre_muestreador2 || null,
                    ma_duracion_muestreo: em.ma_duracion_muestreo !== undefined ? em.ma_duracion_muestreo : row.ma_duracion_muestreo,
                    estado_caso: em.estado_caso || row.estado_caso || null,
                    id_estadomuestreo: em.id_estadomuestreo || row.id_estadomuestreo || null,
                    es_remuestreo: em.es_remuestreo !== undefined ? em.es_remuestreo : row.es_remuestreo,
                    id_ficha_original: em.id_ficha_original !== undefined ? em.id_ficha_original : row.id_ficha_original,
                    nombre_muestreador_original: em.nombre_muestreador_original || row.nombre_muestreador_original,
                    id_muestreador_original: em.id_muestreador_original || row.id_muestreador_original
                };
            });

        } catch (err) {
            logger.error(`getForAssignmentDetail totally failed for ficha ${id}:`, err);
            throw err;
        }
    }
    async batchUpdateAgenda(data) {
        const { assignments, user, observaciones } = data;

        if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
            throw new Error('No se proporcionaron asignaciones');
        }

        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            let successCount = 0;
            const historicalData = new Map(); // Store old values per agendamam ID
            const processedCorrelativos = new Set(); // Evitar duplicar lógica de equipos por análisis

            for (const assignment of assignments) {
                const {
                    id,                         // id_agendamam
                    fecha,                      // fecha en formato YYYY-MM-DD
                    fechaRetiro,                // fecha de retiro en formato YYYY-MM-DD
                    idMuestreadorInstalacion,
                    idMuestreadorRetiro,
                    idFichaIngresoServicio,
                    frecuenciaCorrelativo,
                    actualizarVersiones         // flag para refrescar equipos desde maestro
                } = assignment;

                // 0. CAPTURAR ESTADO PREVIO (Para notificaciones de reprogramación)
                const histRequest = new sql.Request(transaction);
                histRequest.input('id_agenda', sql.Numeric(10, 0), id);
                const histResult = await histRequest.query(`
                    SELECT a.fecha_muestreo, a.ma_muestreo_fechat as fecha_retiro, 
                           a.id_muestreador as id_muestreador_instalacion,
                           a.id_muestreador2 as id_muestreador_retiro,
                           m1.nombre_muestreador as muestreador_instalacion,
                           m2.nombre_muestreador as muestreador_retiro
                    FROM App_Ma_Agenda_MUESTREOS a
                    LEFT JOIN mae_muestreador m1 ON a.id_muestreador = m1.id_muestreador
                    LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
                    WHERE a.id_agendamam = @id_agenda
                `);
                if (histResult.recordset.length > 0) {
                    historicalData.set(String(id), histResult.recordset[0]);
                }

                // 1. ACTUALIZAR App_Ma_Agenda_MUESTREOS
                const dateObj = new Date(fecha);
                const day = dateObj.getUTCDate();
                const month = dateObj.getUTCMonth() + 1;
                const year = dateObj.getUTCFullYear();

                const retiroDateObj = fechaRetiro ? new Date(fechaRetiro) : null;

                const updateRequest = new sql.Request(transaction);
                updateRequest.input('fecha', sql.Date, dateObj);
                updateRequest.input('fechaRetiro', sql.Date, retiroDateObj);
                updateRequest.input('dia', sql.Int, day);
                updateRequest.input('mes', sql.Int, month);
                updateRequest.input('ano', sql.Int, year);
                updateRequest.input('idMuestreadorInstalacion', sql.Numeric(10, 0), idMuestreadorInstalacion);
                updateRequest.input('idMuestreadorRetiro', sql.Numeric(10, 0), idMuestreadorRetiro);
                updateRequest.input('idEstadoMuestreo', sql.Int, 1); // Estado: Asignado
                updateRequest.input('idCoordinador', sql.Numeric(10, 0), user.id || 0);
                updateRequest.input('id_agenda', sql.Numeric(10, 0), id);
                // FIX: Persist frecuencia_correlativo
                updateRequest.input('frecuenciaCorrelativo', sql.VarChar(50), frecuenciaCorrelativo || 'PorAsignar');

                await updateRequest.query(`
                    UPDATE App_Ma_Agenda_MUESTREOS 
                    SET fecha_muestreo = @fecha,
                        ma_muestreo_fechat = @fechaRetiro,
                        fecha_retiro = @fechaRetiro,
                dia = @dia,
                mes = @mes,
                ano = @ano,
                id_muestreador = @idMuestreadorInstalacion,
                id_muestreador2 = @idMuestreadorRetiro,
                id_estadomuestreo = @idEstadoMuestreo,
                id_coordinador = @idCoordinador,
                frecuencia_correlativo = @frecuenciaCorrelativo
                    WHERE id_agendamam = @id_agenda
                `);



                // 2. CREAR REGISTROS EN App_Ma_Resultados
                // Obtener análisis de la ficha
                const analisisRequest = new sql.Request(transaction);
                analisisRequest.input('idFicha', sql.Numeric(10, 0), idFichaIngresoServicio);

                const analisisResult = await analisisRequest.query(`
            SELECT *
                FROM App_Ma_FichaIngresoServicio_DET 
                    WHERE id_fichaingresoservicio = @idFicha 
                    ORDER BY item
                `);

                // Insertar cada análisis en resultados
                for (const analisis of analisisResult.recordset) {
                    const resultadoRequest = new sql.Request(transaction);

                    resultadoRequest.input('idFicha', sql.Numeric(10, 0), idFichaIngresoServicio);
                    resultadoRequest.input('correlativo', sql.VarChar(50), frecuenciaCorrelativo);
                    resultadoRequest.input('idMuestreador', sql.Numeric(10, 0), idMuestreadorInstalacion);
                    resultadoRequest.input('idTecnica', sql.Numeric(10, 0), analisis.id_tecnica);
                    resultadoRequest.input('idNormativa', sql.Numeric(10, 0), analisis.id_normativa);
                    resultadoRequest.input('idNormativaRef', sql.Numeric(10, 0), analisis.id_normativareferencia);
                    resultadoRequest.input('idReferenciaAnalisis', sql.Numeric(10, 0), analisis.id_referenciaanalisis);
                    resultadoRequest.input('limiteMaxD', sql.Numeric(10, 2), analisis.limitemax_d);
                    resultadoRequest.input('limiteMaxH', sql.Numeric(10, 2), analisis.limitemax_h);
                    resultadoRequest.input('llevaError', sql.VarChar(1), analisis.llevaerror || null);
                    resultadoRequest.input('errorMin', sql.Numeric(10, 2), analisis.error_min);
                    resultadoRequest.input('errorMax', sql.Numeric(10, 2), analisis.error_max);
                    resultadoRequest.input('tipoAnalisis', sql.VarChar(20), analisis.tipo_analisis || null);
                    resultadoRequest.input('ufIndividual', sql.Numeric(10, 2), analisis.uf_individual);
                    resultadoRequest.input('estado', sql.VarChar(50), analisis.estado || null);
                    resultadoRequest.input('cumplimiento', sql.VarChar(10), analisis.cumplimiento || null);
                    resultadoRequest.input('cumplimientoApp', sql.VarChar(20), analisis.cumplimiento_app || null);
                    resultadoRequest.input('item', sql.Int, analisis.item);
                    resultadoRequest.input('idLaboratorioEnsayo', sql.Numeric(10, 0), analisis.id_laboratorioensayo);
                    resultadoRequest.input('idTipoEntrega', sql.Numeric(10, 0), analisis.id_tipoentrega);
                    resultadoRequest.input('idTransporte', sql.Numeric(10, 0), analisis.id_transporte);
                    resultadoRequest.input('transporteOrden', sql.VarChar(50), analisis.transporte_orden || null);
                    resultadoRequest.input('resultadoFecha', sql.Date, analisis.resultado_fecha);
                    resultadoRequest.input('resultadoHora', sql.VarChar(10), analisis.resultado_hora || null);
                    resultadoRequest.input('llevaTraduccion', sql.VarChar(1), analisis.llevatraduccion || null);
                    resultadoRequest.input('traduccion0', sql.VarChar(20), analisis.traduccion_0 || null);
                    resultadoRequest.input('traduccion1', sql.VarChar(20), analisis.traduccion_1 || null);

                    // Check if record exists
                    const checkResult = await resultadoRequest.query(`
                        SELECT COUNT(*) as count
                        FROM App_Ma_Resultados
                        WHERE id_fichaingresoservicio = @idFicha
                          AND frecuencia_correlativo = @correlativo
                          AND item = @item
                `);

                    const exists = checkResult.recordset[0].count > 0;

                    if (exists) {
                        // UPDATE existing record
                        await resultadoRequest.query(`
                            UPDATE App_Ma_Resultados
                            SET id_muestreador = @idMuestreador,
                id_tecnica = @idTecnica,
                id_normativa = @idNormativa,
                id_normativareferencia = @idNormativaRef,
                id_referenciaanalisis = @idReferenciaAnalisis,
                limitemax_d = @limiteMaxD,
                limitemax_h = @limiteMaxH,
                llevaerror = @llevaError,
                error_min = @errorMin,
                error_max = @errorMax,
                tipo_analisis = @tipoAnalisis,
                uf_individual = @ufIndividual,
                estado = @estado,
                cumplimiento = @cumplimiento,
                cumplimiento_app = @cumplimientoApp,
                id_laboratorioensayo = @idLaboratorioEnsayo,
                id_tipoentrega = @idTipoEntrega,
                id_transporte = @idTransporte,
                transporte_orden = @transporteOrden,
                resultado_fecha = @resultadoFecha,
                resultado_hora = @resultadoHora,
                llevatraduccion = @llevaTraduccion,
                traduccion_0 = @traduccion0,
                traduccion_1 = @traduccion1
                            WHERE id_fichaingresoservicio = @idFicha
                              AND frecuencia_correlativo = @correlativo
                              AND item = @item
                `);
                    } else {
                        // INSERT new record
                        await resultadoRequest.query(`
                            INSERT INTO App_Ma_Resultados(
                    id_fichaingresoservicio, frecuencia_correlativo, id_muestreador,
                    id_tecnica, id_normativa, id_normativareferencia, id_referenciaanalisis,
                    limitemax_d, limitemax_h, llevaerror, error_min, error_max,
                    tipo_analisis, uf_individual, estado, cumplimiento, cumplimiento_app,
                    item, id_laboratorioensayo, id_tipoentrega, id_transporte,
                    transporte_orden, resultado_fecha, resultado_hora, llevatraduccion,
                    traduccion_0, traduccion_1
                ) VALUES(
                    @idFicha, @correlativo, @idMuestreador,
                    @idTecnica, @idNormativa, @idNormativaRef, @idReferenciaAnalisis,
                    @limiteMaxD, @limiteMaxH, @llevaError, @errorMin, @errorMax,
                    @tipoAnalisis, @ufIndividual, @estado, @cumplimiento, @cumplimientoApp,
                    @item, @idLaboratorioEnsayo, @idTipoEntrega, @idTransporte,
                    @transporteOrden, @resultadoFecha, @resultadoHora, @llevaTraduccion,
                    @traduccion0, @traduccion1
                )
                    `);
                    }
                }

                // 3. MANEJO DE EQUIPOS EN App_Ma_Equipos_MUESTREOS (Lógica "Stayers Guard" V5.1)
                const cleanCorr = (frecuenciaCorrelativo || '').trim();
                const newInst = Number(idMuestreadorInstalacion || 0);
                const newRet = Number(idMuestreadorRetiro || 0);
                const newSamplers = new Set([newInst, newRet].filter(s => s > 0));

                if (processedCorrelativos.has(cleanCorr)) {
                    logger.debug(`[EQUIPOS] Salto correlativo ya procesado: ${cleanCorr}`);
                } else {
                    processedCorrelativos.add(cleanCorr);
                    logger.info(`[EQUIPOS] Procesando ${cleanCorr}. Muestreadores Agenda: [${Array.from(newSamplers).join(', ')}]`);

                    // A. SANEAR DUPLICADOS (Defensa contra registros antiguos o corruptos)
                    const cleanReq = new sql.Request(transaction);
                    cleanReq.input('fid', sql.Numeric(10, 0), idFichaIngresoServicio);
                    cleanReq.input('corr', sql.VarChar(50), cleanCorr);
                    await cleanReq.query(`
                        WITH CTE AS (
                            SELECT id_equipo, id_muestreador,
                                ROW_NUMBER() OVER (PARTITION BY id_fichaingresoservicio, frecuencia_correlativo, id_equipo, id_muestreador ORDER BY version DESC) as rn
                            FROM App_Ma_Equipos_MUESTREOS
                            WHERE id_fichaingresoservicio = @fid AND RTRIM(frecuencia_correlativo) = @corr 
                              AND ISNULL(estado, 'ACTIVO') = 'ACTIVO'
                        )
                        UPDATE e SET estado = 'DESACTIVADO'
                        FROM App_Ma_Equipos_MUESTREOS e
                        INNER JOIN CTE ON e.id_equipo = CTE.id_equipo AND e.id_muestreador = CTE.id_muestreador
                        WHERE e.id_fichaingresoservicio = @fid AND RTRIM(e.frecuencia_correlativo) = @corr 
                          AND CTE.rn > 1 AND e.estado = 'ACTIVO'
                    `);

                    // B. Consultar estado actual tras limpieza
                    const currentActiveRes = await transaction.request()
                        .input('fid', sql.Numeric(10, 0), idFichaIngresoServicio)
                        .input('corr', sql.VarChar(50), cleanCorr)
                        .query(`SELECT DISTINCT id_muestreador FROM App_Ma_Equipos_MUESTREOS 
                                WHERE id_fichaingresoservicio = @fid AND RTRIM(frecuencia_correlativo) = @corr AND ISNULL(estado, 'ACTIVO') = 'ACTIVO'`);
                    const samplersInTable = new Set(currentActiveRes.recordset.map(r => Number(r.id_muestreador)));
                    logger.info(`[EQUIPOS] Muestreadores en Tabla para ${cleanCorr}: [${Array.from(samplersInTable).join(', ')}]`);

                    const { equipmentSelections, equipmentComparisonData } = assignment;
                    if (equipmentSelections && equipmentComparisonData && Object.keys(equipmentSelections).length > 0) {
                        // REMUESTREO MANUAL: El usuario configura versiones específicas para el INSTALADOR
                        logger.info(`[EQUIPOS] Configuración manual para ${cleanCorr}. Refrescando solo al instalador ${newInst}`);
                        
                        const deactManual = new sql.Request(transaction);
                        deactManual.input('fid', sql.Numeric(10,0), idFichaIngresoServicio);
                        deactManual.input('corr', sql.VarChar(50), cleanCorr);
                        deactManual.input('sid', sql.Numeric(10,0), newInst);
                        
                        // Solo desactivamos los equipos del que estamos re-configurando manualmente (generalmente el instalador)
                        await deactManual.query("UPDATE App_Ma_Equipos_MUESTREOS SET estado='DESACTIVADO' WHERE id_fichaingresoservicio=@fid AND RTRIM(frecuencia_correlativo)=@corr AND id_muestreador=@sid AND estado='ACTIVO'");

                        for (const item of equipmentComparisonData) {
                            const choice = equipmentSelections[item.id_equipo];
                            if (!choice) continue;
                            const ver = choice === 'original' ? item.version_original : item.version_nueva;
                            
                            const insReqManual = new sql.Request(transaction);
                            insReqManual.input('fid', sql.Numeric(10, 0), idFichaIngresoServicio);
                            insReqManual.input('corr', sql.VarChar(50), cleanCorr);
                            insReqManual.input('eid', sql.Numeric(10, 0), item.id_equipo);
                            insReqManual.input('sid', sql.Numeric(10, 0), newInst); 
                            insReqManual.input('ver', sql.VarChar(50), ver);
                            insReqManual.input('tfc', sql.VarChar(1), item.tienefc || null);
                            insReqManual.input('e0', sql.Numeric(10, 1), choice === 'original' ? item.error0_original : item.error0_nueva);
                            insReqManual.input('e15', sql.Numeric(10, 1), choice === 'original' ? item.error15_original : item.error15_nueva);
                            insReqManual.input('e30', sql.Numeric(10, 1), choice === 'original' ? item.error30_original : item.error30_nueva);

                            await insReqManual.query(`
                                INSERT INTO App_Ma_Equipos_MUESTREOS(id_fichaingresoservicio, frecuencia_correlativo, id_equipo, tienefc, error0, error15, error30, id_muestreador, seleccionado, usado_instalacion, usado_retiro, version, estado) 
                                VALUES(@fid, @corr, @eid, @tfc, @e0, @e15, @e30, @sid, 'N', null, null, @ver, 'ACTIVO')
                            `);
                        }
                    } else {
                        // ASIGNACIÓN NORMAL (Selects de la Web)
                        if (actualizarVersiones) {
                            await transaction.request()
                                .input('fid', sql.Numeric(10, 0), idFichaIngresoServicio)
                                .input('corr', sql.VarChar(50), cleanCorr)
                                .query("UPDATE App_Ma_Equipos_MUESTREOS SET estado='DESACTIVADO' WHERE id_fichaingresoservicio=@fid AND RTRIM(frecuencia_correlativo)=@corr AND estado='ACTIVO'");
                        }

                        // 1. DESACTIVAR solo a los que se van (No están en newSamplers)
                        for (const sId of samplersInTable) {
                            if (!newSamplers.has(sId) || actualizarVersiones) {
                                logger.info(`[EQUIPOS] Desactivando equipos de ${sId} en ${cleanCorr} (Ya no está en la agenda o fuerza refresh)`);
                                await transaction.request()
                                    .input('fid', sql.Numeric(10, 0), idFichaIngresoServicio)
                                    .input('corr', sql.VarChar(50), cleanCorr)
                                    .input('sid', sql.Numeric(10, 0), sId)
                                    .query("UPDATE App_Ma_Equipos_MUESTREOS SET estado='DESACTIVADO' WHERE id_fichaingresoservicio=@fid AND RTRIM(frecuencia_correlativo)=@corr AND id_muestreador=@sid AND estado='ACTIVO'");
                            } else {
                                logger.info(`[EQUIPOS] Manteniendo equipos de ${sId} en ${cleanCorr} (Sigue presente en la agenda)`);
                            }
                        }

                        // 2. INSERTAR solo a los que entran (No estaban en samplersInTable)
                        for (const sId of newSamplers) {
                            if (!samplersInTable.has(sId) || actualizarVersiones) {
                                const mEqRes = await transaction.request()
                                    .input('sid', sql.Numeric(10, 0), sId)
                                    .query("SELECT * FROM mae_equipo WHERE id_muestreador = @sid");
                                
                                logger.info(`[EQUIPOS] Insertando ${mEqRes.recordset.length} equipos para el nuevo muestreador ${sId} en ${cleanCorr}`);

                                for (const eq of mEqRes.recordset) {
                                    const insReq = new sql.Request(transaction);
                                    insReq.input('fid', sql.Numeric(10, 0), idFichaIngresoServicio);
                                    insReq.input('corr', sql.VarChar(50), cleanCorr);
                                    insReq.input('eid', sql.Numeric(10, 0), eq.id_equipo);
                                    insReq.input('sid', sql.Numeric(10, 0), sId);
                                    insReq.input('tfc', sql.VarChar(1), eq.tienefc || null);
                                    insReq.input('e0', sql.Numeric(10, 1), eq.error0);
                                    insReq.input('e15', sql.Numeric(10, 1), eq.error15);
                                    insReq.input('e30', sql.Numeric(10, 1), eq.error30);
                                    insReq.input('ver', sql.VarChar(50), eq.version || 'v1');

                                    await insReq.query(`
                                        IF NOT EXISTS (
                                            SELECT 1 FROM App_Ma_Equipos_MUESTREOS 
                                            WHERE id_fichaingresoservicio = @fid 
                                              AND RTRIM(frecuencia_correlativo) = @corr 
                                              AND id_equipo = @eid 
                                              AND id_muestreador = @sid 
                                              AND ISNULL(estado, 'ACTIVO') = 'ACTIVO'
                                        )
                                        BEGIN
                                            INSERT INTO App_Ma_Equipos_MUESTREOS(
                                                id_fichaingresoservicio, frecuencia_correlativo, id_equipo,
                                                tienefc, error0, error15, error30, id_muestreador,
                                                seleccionado, usado_instalacion, usado_retiro, version, estado
                                            ) VALUES(
                                                @fid, @corr, @eid,
                                                @tfc, @e0, @e15, @e30, @sid,
                                                'N', null, null, @ver, 'ACTIVO'
                                            )
                                        END
                                    `);
                                }
                            }
                        }
                    }
                }

                successCount++;
            }

            // NOTIFICATION: Asignada (Grouped by Ficha to avoid spam)
            const distinctFichas = [...new Set(assignments.map(a => a.idFichaIngresoServicio))];
            const notifDate = new Date();
            const notifFecha = notifDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
            const notifHora = notifDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

            // For each ficha, collect detailed service information
            for (const fid of distinctFichas) {
                // Determine if it was already in process (Reprogramación)
                const statusReq = new sql.Request(transaction);
                statusReq.input('fid', sql.Numeric(10, 0), fid);
                // Query metadata + status (Resumen de Muestreo)
                const metaRes = await statusReq.query(`
                    SELECT 
                        e.id_usuario as id_usuario_propietario,
                        e.id_validaciontecnica,
                        e.fichaingresoservicio as correlativo_txt,
                        e.id_tipomuestra_ma, -- Componente
                        e.id_tipomuestra, -- Tipo Muestra
                        e.nombre_tabla_largo as glosa,
                        e.ma_coordenadas as coordenadas,
                        e.ma_punto_muestreo as punto_muestreo,
                        e.id_empresaservicio,
                        e.id_centro,
                        e.id_subarea,
                        e.id_objetivomuestreo_ma,
                        e.id_contacto,
                        e.id_tipomuestreo, -- Monitoreo
                        es.nombre_empresaservicios as empresa_servicio,
                        em.nombre_empresa as cliente,
                        em.email_empresa as correo_empresa_cliente,
                        c.nombre_centro as fuente_centro,
                        s.nombre_subarea,
                        t.nombre_tipomuestreo as monitoreo,
                        obj.nombre_objetivomuestreo_ma as nombre_objetivo,
                        cont.nombre_contacto,
                        cont.email_contacto as correo_contacto,
                        es.email_empresaservicios as correo_empresa_servicio
                    FROM App_Ma_FichaIngresoServicio_ENC e
                    LEFT JOIN mae_empresaservicios es ON e.id_empresaservicio = es.id_empresaservicio
                    LEFT JOIN mae_empresa em ON e.id_empresa = em.id_empresa
                    LEFT JOIN mae_centro c ON e.id_centro = c.id_centro
                    LEFT JOIN mae_subarea s ON e.id_subarea = s.id_subarea
                    LEFT JOIN mae_tipomuestreo t ON e.id_tipomuestreo = t.id_tipomuestreo
                    LEFT JOIN mae_objetivomuestreo_ma obj ON e.id_objetivomuestreo_ma = obj.id_objetivomuestreo_ma
                    LEFT JOIN mae_contacto cont ON e.id_contacto = cont.id_contacto
                    WHERE e.id_fichaingresoservicio = @fid
                `);

                const meta = metaRes.recordset[0] || {};
                const prevStatus = meta.id_validaciontecnica;
                const isReprogramacion = prevStatus === 5;

                // Query detailed information for this ficha
                const detailRequest = new sql.Request(transaction);
                detailRequest.input('fichaId', sql.Numeric(10, 0), fid);

                const detailResult = await detailRequest.query(`
                    SELECT 
                        a.id_agendamam,
                        a.frecuencia_correlativo,
                        a.fecha_muestreo,
                        a.dia, a.mes, a.ano,
                        a.ma_muestreo_fechat as fecha_retiro,
                        m1.nombre_muestreador as muestreador_instalacion,
                        m2.nombre_muestreador as muestreador_retiro,
                        f.nombre_frecuencia,
                        (SELECT COUNT(*) 
                         FROM App_Ma_Agenda_MUESTREOS 
                         WHERE id_fichaingresoservicio = a.id_fichaingresoservicio 
                           AND (estado_caso IS NULL OR estado_caso != 'CANCELADO')) as total_servicios
                    FROM App_Ma_Agenda_MUESTREOS a
                    LEFT JOIN mae_muestreador m1 ON a.id_muestreador = m1.id_muestreador
                    LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
                    LEFT JOIN mae_frecuencia f ON a.id_frecuencia = f.id_frecuencia
                    WHERE a.id_fichaingresoservicio = @fichaId
                      AND (a.estado_caso IS NULL OR a.estado_caso != 'CANCELADO')
                    ORDER BY a.frecuencia_correlativo
                `);

                if (detailResult.recordset.length > 0) {
                    const firstRow = detailResult.recordset[0];
                    const tipoFrecuencia = firstRow.nombre_frecuencia || 'No especificada';
                    const totalServicios = firstRow.total_servicios || 0;

                    // Build services array with detailed information
                    const servicios = detailResult.recordset.map((row, index) => {
                        // Extract service number from frecuencia_correlativo (e.g., "72-1-Pendiente-625" -> 1)
                        const correlativoParts = (row.frecuencia_correlativo || '').split('-');
                        const numeroServicio = correlativoParts.length >= 2 ? correlativoParts[1] : (index + 1);

                        // Format date (using UTC to avoid timezone offset issues)
                        const formatDate = (date) => {
                            if (!date) return 'No asignada';
                            const d = new Date(date);
                            const year = d.getUTCFullYear();
                            const month = d.getUTCMonth();
                            const day = d.getUTCDate();
                            return new Date(year, month, day).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                        };

                        const fechaMuestreo = formatDate(row.fecha_muestreo);

                        // History comparison
                        const history = historicalData.get(String(row.id_agendamam));
                        let oldFecha = null;
                        let oldInstalacion = null;
                        let oldRetiro = null;
                        let isModified = false;

                        if (history) {
                            // Only set old values if they actually changed
                            const oldF = formatDate(history.fecha_muestreo);
                            if (oldF !== fechaMuestreo) {
                                oldFecha = oldF;
                                isModified = true;
                            }

                            if (history.muestreador_instalacion !== (row.muestreador_instalacion || 'No asignado')) {
                                oldInstalacion = history.muestreador_instalacion || 'Sin Asignar';
                                isModified = true;
                            }
                            if (history.muestreador_retiro !== (row.muestreador_retiro || 'No asignado')) {
                                oldRetiro = history.muestreador_retiro || 'Sin Asignar';
                                isModified = true;
                            }
                        }

                        return {
                            numero: numeroServicio,
                            muestreador_instalacion: row.muestreador_instalacion || 'No asignado',
                            muestreador_retiro: row.muestreador_retiro || 'No asignado',
                            fecha_muestreo: fechaMuestreo,
                            old_fecha: oldFecha,
                            old_muestreador_instalacion: oldInstalacion,
                            old_muestreador_retiro: oldRetiro,
                            isModified
                        };
                    });

                    // Sort services numerically by their extracted number
                    servicios.sort((a, b) => parseInt(a.numero) - parseInt(b.numero));

                    // Only show modified services if it's a rescheduling
                    const serviciosFinal = isReprogramacion
                        ? servicios.filter(s => s.isModified)
                        : servicios;

                    // Skip notification if no services were actually modified and it's a reprogramming
                    if (isReprogramacion && serviciosFinal.length === 0) {
                        logger.info(`Ficha ${fid}: Reprogramación skiped because no services changed.`);
                        continue;
                    }

                    // Get user name (Robust fallback logic) - Prioritize 'usuario' (Full Name)
                    let asignadoPor = user.usuario || user.nombre_usuario || user.nombre || user.name;

                    if (!asignadoPor || asignadoPor === 'Sistema' || asignadoPor === 'undefined') {
                        if (user.id && user.id !== 0) {
                            try {
                                const uReq = new sql.Request(transaction);
                                uReq.input('uid', sql.Numeric(10, 0), user.id);
                                const uRes = await uReq.query('SELECT usuario FROM mae_usuario WHERE id_usuario = @uid');
                                if (uRes.recordset.length > 0) {
                                    asignadoPor = uRes.recordset[0].usuario;
                                }
                            } catch (e) {
                                logger.warn('Failed to fetch user name for assignment notification', e);
                            }
                        }
                    }
                    asignadoPor = asignadoPor || 'Usuario Sistema';

                    // Send enhanced notification
                    const eventCode = isReprogramacion ? 'FICHA_MUESTREO_REPROGRAMADO' : 'FICHA_ASIGNADA';
                    unsService.trigger(eventCode, {
                        correlativo: meta.correlativo_txt || String(fid),
                        id_usuario_accion: user ? (user.id || user.id_usuario || 0) : 0,
                        id_usuario_propietario: meta.id_usuario_propietario, // Pass owner from meta query
                        tipo_frecuencia: tipoFrecuencia,
                        total_servicios: totalServicios,
                        servicios: serviciosFinal,
                        asignado_por: asignadoPor,
                        usuario_accion: asignadoPor,
                        fecha: notifFecha,
                        hora_asignacion: notifHora,
                        monitoreo: meta.monitoreo || 'No especificado',
                        empresa_servicio: meta.empresa_servicio || 'No especificada',
                        cliente: meta.cliente || 'No especificado',
                        fuente_centro: meta.fuente_centro || 'No especificada',
                        sub_area: meta.nombre_subarea || 'No especificada',
                        objetivo: meta.nombre_objetivo || 'No especificado',
                        glosa: meta.glosa || 'Sin observaciones',
                        contacto_empresa: meta.nombre_contacto || 'No especificado',
                        correo_contacto: meta.correo_contacto || 'No especificado',
                        correo_empresa: meta.correo_empresa_servicio || 'No especificado',
                        correo_cliente: meta.correo_empresa_cliente || 'No especificado',
                        punto_muestreo: meta.punto_muestreo || 'No especificado',
                        coordenadas: meta.coordenadas || 'No especificado'
                    });
                }
            }

            // UPDATE Ficha Status to 'En Proceso' (so it moves out of Pendiente Programación)
            if (distinctFichas.length > 0) {
                const reqUpdateStatus = new sql.Request(transaction);
                for (const fid of distinctFichas) {
                    // FIX: Also update id_validaciontecnica to 5 (En Proceso)
                    await reqUpdateStatus.query(`
                     UPDATE App_Ma_FichaIngresoServicio_ENC 
                     SET estado_ficha = 'En Proceso',
                         id_validaciontecnica = 5
                     WHERE id_fichaingresoservicio = ${fid}
                 `);
                }
            }

            // LOG HISTORY (Batch Assignment) - One per Ficha to avoid spam in history
            for (const fid of distinctFichas) {
                await this.logHistorial(transaction, {
                    idFicha: fid,
                    idUsuario: user.id || 0,
                    accion: 'ASIGNACION_MASIVA',
                    estadoAnterior: 'En Proceso',
                    estadoNuevo: 'Asignada (Parcial/Total)',
                    observacion: observaciones || ''
                });
            }

            await transaction.commit();
            logger.info(`Successfully assigned ${successCount} muestreos with dates, results, and equipment`);

            return {
                success: true,
                message: `✅ Se asignaron correctamente ${successCount} muestreos con sus fechas, resultados y equipos`,
                count: successCount
            };

        } catch (error) {
            logger.error('Error in batchUpdateAgenda service:', {
                message: error.message,
                code: error.code,
                number: error.number,
                state: error.state,
                class: error.class,
                serverName: error.serverName,
                procName: error.procName,
                lineNumber: error.lineNumber,
                stack: error.stack
            });

            if (transaction) {
                try {
                    await transaction.rollback();
                } catch (rollbackError) {
                    logger.error('Error during rollback:', rollbackError);
                }
            }

            throw error;
        }
    }
    async cancelAgendaSampling(idAgenda, idFicha, user, observations, idEstadoMuestreo) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            logger.info(`Iniciando cancelación de muestreo: Agenda ${idAgenda}, Ficha ${idFicha}`);

            // 1. Cancelar Item de Agenda (Individual)
            const agendaReq = new sql.Request(transaction);
            agendaReq.input('id_agenda', sql.Numeric(18, 0), idAgenda);
            agendaReq.input('motivo', sql.VarChar(500), observations || '');
            agendaReq.input('id_estado', sql.Int, idEstadoMuestreo || 99); // Fallback to 99 if not provided
            await agendaReq.query(`
                UPDATE App_Ma_Agenda_MUESTREOS 
                SET estado_caso = 'CANCELADO',
                    id_estadomuestreo = @id_estado,
                    motivo_cancelacion = @motivo
                WHERE id_agendamam = @id_agenda
            `);

            // 2. Verificar si quedan otros ítems activos para esta ficha
            const checkReq = new sql.Request(transaction);
            checkReq.input('id_ficha', sql.Numeric(18, 0), idFicha);
            const activeResult = await checkReq.query(`
                SELECT COUNT(*) as active_count 
                FROM App_Ma_Agenda_MUESTREOS 
                WHERE id_fichaingresoservicio = @id_ficha 
                AND (estado_caso IS NULL OR estado_caso != 'CANCELADO')
            `);

            const activeCount = activeResult.recordset[0].active_count;
            const newFichaStatus = activeCount > 0 ? 5 : 7; // 5 = En Proceso, 7 = CANCELADO
            const newFichaEstadoText = activeCount > 0 ? 'EN PROCESO' : 'CANCELADO';

            // 3. Actualizar el estado de la Ficha (ENC) según corresponda
            const encReq = new sql.Request(transaction);
            encReq.input('id_ficha_enc', sql.Numeric(18, 0), idFicha);
            encReq.input('new_status', sql.Int, newFichaStatus);
            encReq.input('new_estado_text', sql.VarChar(50), newFichaEstadoText);
            await encReq.query(`
                UPDATE App_Ma_FichaIngresoServicio_ENC 
                SET id_validaciontecnica = @new_status,
                    estado_ficha = @new_estado_text
                WHERE id_fichaingresoservicio = @id_ficha_enc
            `);

            // 4. Log Historial
            await this.logHistorial(transaction, {
                idFicha: idFicha,
                idUsuario: user?.id || 0,
                accion: 'CANCELACION_MUESTREO',
                estadoAnterior: 'En Proceso',
                estadoNuevo: newFichaEstadoText,
                observacion: `Muestreo individual cancelado. Motivo: ${observations || 'No especificado'}. Ficha queda en estado: ${newFichaEstadoText}`
            });

            await transaction.commit();
            logger.info(`Muestreo cancelado exitosamente: Agenda ${idAgenda}`);

            // NOTIFICACIÓN: Muestreo Cancelado
            try {
                const poolNotif = await getConnection();
                const detailRes = await poolNotif.request().query(`
                    SELECT 
                        a.frecuencia_correlativo,
                        a.fecha_muestreo,
                        f.fichaingresoservicio,
                        m.nombre_muestreador
                    FROM App_Ma_Agenda_MUESTREOS a
                    INNER JOIN App_Ma_FichaIngresoServicio_ENC f ON a.id_fichaingresoservicio = f.id_fichaingresoservicio
                    LEFT JOIN mae_muestreador m ON a.id_muestreador = m.id_muestreador
                    WHERE a.id_agendamam = ${idAgenda}
                `);

                if (detailRes.recordset.length > 0) {
                    const info = detailRes.recordset[0];
                    const notifDate = new Date();
                    const notifFechaStr = notifDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

                    let fechaMuestreoStr = 'No asignada';
                    if (info.fecha_muestreo) {
                        fechaMuestreoStr = new Date(info.fecha_muestreo).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                    }

                    unsService.trigger('FICHA_MUESTREO_CANCELADO', {
                        correlativo: info.fichaingresoservicio || String(idFicha),
                        id_usuario_accion: user ? (user.id || user.id_usuario || 0) : 0,
                        muestreo_correlativo: info.frecuencia_correlativo,
                        fecha_muestreo: fechaMuestreoStr,
                        muestreador: info.nombre_muestreador || 'No asignado',
                        motivo: observations || 'No especificado',
                        usuario_cancela: user.nombre_usuario || user.usuario || 'Usuario',
                        usuario_accion: user.nombre_usuario || user.usuario || 'Usuario',
                        fecha: notifFechaStr
                    });
                }
            } catch (e) {
                logger.warn('Error enviando notificación de cancelación:', e);
            }

            return { success: true, message: 'Muestreo cancelado correctamente' };

        } catch (error) {
            logger.error('Error en cancelAgendaSampling:', error);
            if (transaction) await transaction.rollback();
            throw error;
        }
    }

    async getSamplingEquipos(idFicha, correlativo) {
        const pool = await getConnection();
        try {
            const request = pool.request();
            request.input('idFicha', sql.Numeric(10, 0), idFicha);
            request.input('correlativo', sql.VarChar(50), correlativo);

            const result = await request.query(`
                SELECT 
                    ae.*,
                    e.nombre as nombre_equipo,
                    e.codigo as codigo_equipo,
                    e.tipoequipo as tipo_equipo
                FROM App_Ma_Equipos_MUESTREOS ae
                LEFT JOIN mae_equipo e ON ae.id_equipo = e.id_equipo
                WHERE ae.id_fichaingresoservicio = @idFicha
                  AND ae.frecuencia_correlativo = @correlativo
                  AND ISNULL(ae.estado, 'ACTIVO') = 'ACTIVO'
            `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in getSamplingEquipos:', error);
            throw error;
        }
    }

    async generateFichaPdfBuffer(id) {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers = [];

            return new Promise(async (resolve, reject) => {
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });
                doc.on('error', reject);

                await this._drawFichaToPdf(doc, id, { isFirst: true });
                doc.end();
            });
        } catch (error) {
            logger.error('Error generating Ficha PDF:', error);
            throw error;
        }
    }

    async generateBulkFichaPdfBuffer(ids) {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers = [];

            return new Promise(async (resolve, reject) => {
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });
                doc.on('error', reject);

                for (let i = 0; i < ids.length; i++) {
                    await this._drawFichaToPdf(doc, ids[i], { isFirst: i === 0 });
                }
                doc.end();
            });
        } catch (error) {
            logger.error('Error generating Bulk Ficha PDF:', error);
            throw error;
        }
    }

    async _drawFichaToPdf(doc, id, options = { isFirst: true }) {
        const ficha = await this.getFichaById(id);
        if (!ficha) return;

        if (!options.isFirst) {
            doc.addPage();
        }

        // Fetch agenda
        const pool = await getConnection();
        const request = pool.request();
        request.input('id', sql.Numeric(10, 0), id);
        const agendaRes = await request.query(`
            SELECT a.id_agendamam, a.frecuencia_correlativo, a.fecha_muestreo,
                   m1.nombre_muestreador as instalacion,
                   m2.nombre_muestreador as retiro,
                   e.nombre_estadomuestreo
            FROM App_Ma_Agenda_MUESTREOS a
            LEFT JOIN mae_muestreador m1 ON a.id_muestreador = m1.id_muestreador
            LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
            LEFT JOIN mae_estadomuestreo e ON a.id_estadomuestreo = e.id_estadomuestreo
            WHERE a.id_fichaingresoservicio = @id
            ORDER BY a.id_agendamam ASC
        `);
        const agenda = agendaRes.recordset;

        // Fetch historial for observations
        const historial = await this.getHistorial(id);

        // Helper to format date
        const formatDate = (dateString) => {
            if (!dateString) return '';
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return dateString;
            return d.toLocaleDateString('es-CL');
        };

        // Helper for two-column details
        const addTwoColumnDetail = (label1, value1, label2, value2) => {
            doc.font('Helvetica-Bold').fontSize(9).text(label1, 40, doc.y, { continued: true, width: 250 });
            doc.font('Helvetica').text(`: ${value1 || '-'}`, { continued: false });
            const currentY = doc.y - doc.currentLineHeight();

            if (label2) {
                doc.font('Helvetica-Bold').text(label2, 300, currentY, { continued: true, width: 250 });
                doc.font('Helvetica').text(`: ${value2 || '-'}`, { continued: false });
            }
            doc.moveDown(0.2);
        };

        const addSectionTitle = (title, align = 'left') => {
            doc.moveDown(0.5);
            const titleOpts = { align: align, width: 510 };
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#1f2937').text(title, titleOpts);
            doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#e5e7eb').stroke();
            doc.moveDown(0.5);
            doc.fillColor('black');
        };

        // --- HEADER LOGO & TITLE ---
        const logoPath = path.resolve(process.cwd(), '../frontend-adlone/src/assets/images/logo-adlone.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 40, 30, { width: 120 });
        }

        doc.font('Helvetica-Bold').fontSize(14).fillColor('#1f4e78').text('FICHA DE INGRESO DE SERVICIO - MEDIO AMBIENTE', 40, 80, { align: 'center', width: 515 });
        doc.fillColor('black');
        doc.moveDown(1.5);

        // --- DATOS PRINCIPALES ---
        addSectionTitle('Información General');
        addTwoColumnDetail('N° Ficha', ficha.fichaingresoservicio || id, 'Estado', ficha.estado_ficha || 'VIGENTE');
        addTwoColumnDetail('Fecha Creación', formatDate(ficha.fecha_fichacomercial || ficha.fecha), 'Tipo', ficha.tipo_fichaingresoservicio);
        addTwoColumnDetail('Monitoreo (Agua/RIL)', ficha.tipo_fichaingresoservicio, 'Tipo de Agua', ficha.nombre_tipoagua || ficha.nombre_tipoagua_ma);
        addTwoColumnDetail('Responsable Muestreo', ficha.responsablemuestreo || ficha.responsable, 'Cargo Responsable', ficha.nombre_cargo || ficha.nombre_cargo_ma);

        // --- CLIENTES Y UBICACION ---
        addSectionTitle('Cliente, Servicio y Ubicación');
        addTwoColumnDetail('Empresa Facturar', ficha.nombre_empresa, 'Empresa de Servicio', ficha.nombre_empresaservicios);
        addTwoColumnDetail('Fuente Emisora', ficha.nombre_centro, 'Ubicación', ficha.ubicacion);
        addTwoColumnDetail('Región', ficha.nombre_region, 'Comuna', ficha.nombre_comuna);
        addTwoColumnDetail('Código', ficha.codigo_centro, 'Contacto Empresa', ficha.nombre_contacto);
        addTwoColumnDetail('Correo Contacto', ficha.email_contacto, 'Tabla', ficha.nombre_tabla_largo);
        addTwoColumnDetail('Objetivo Muestreo', ficha.nombre_objetivomuestreo_ma, 'Instrumento Ambiental', ficha.instrumento_ambiental);
        addTwoColumnDetail('¿Es ETFA?', ficha.etfa === 'S' || ficha.etfa === true ? 'Sí' : 'No', 'Inspector Ambiental', ficha.agenda?.nombre_inspector || '-');
        addTwoColumnDetail('Componente Ambiental', ficha.nombre_tipomuestra_ma || ficha.nombre_tipomuestra, 'Sub Área', ficha.nombre_subarea);
        addTwoColumnDetail('Punto Muestreo', ficha.ma_punto_muestreo, 'Zona / Coordenadas', ficha.ma_coordenadas);

        // --- MUESTREO Y PLANIFICACION ---
        addSectionTitle('Detalles de Muestreo y Planificación');
        addTwoColumnDetail('Frecuencia', ficha.agenda?.id_frecuencia || ficha.agenda?.frecuencia || ficha.nombre_frecuencia, 'Periodo', ficha.agenda?.frecuencia_factor);
        addTwoColumnDetail('Multiplicado Por', ficha.agenda?.frecuencia_factor, 'Total Servicios', ficha.agenda?.total_servicios);
        addTwoColumnDetail('Tipo Muestreo', ficha.nombre_tipomuestreo, 'Tipo Muestra', ficha.nombre_tipomuestra);
        addTwoColumnDetail('Actividad', ficha.nombre_actividadmuestreo, 'Duración Muestreo', ficha.ma_duracion_muestreo);
        addTwoColumnDetail('Tipo Descarga', ficha.nombre_tipodescarga, 'Referencia Maps', ficha.referencia_googlemaps);

        // --- CAUDAL Y MEDICIÓN ---
        const hasCaudalDetails = ficha.nombre_formacanal || ficha.nombre_dispositivohidraulico;
        if (hasCaudalDetails || ficha.medicion_caudal) {
            addSectionTitle('Medición y Caudal');
            addTwoColumnDetail('¿Medición Caudal?', ficha.medicion_caudal || (ficha.medicioncaudal === 1 ? 'Sí' : (ficha.medicioncaudal === 2 ? 'No' : ficha.medicioncaudal)), 'Modalidad', ficha.nombre_modalidad);

            if (ficha.nombre_formacanal) {
                addTwoColumnDetail('Forma Canal', ficha.nombre_formacanal, `Valor (${ficha.nombre_um_formacanal || '-'})`, ficha.formacanal_medida);
            }
            if (ficha.nombre_dispositivohidraulico) {
                addTwoColumnDetail('Disp. Hidráulico', ficha.nombre_dispositivohidraulico, `Valor (${ficha.nombre_um_dispositivohidraulico || '-'})`, ficha.dispositivohidraulico_medida);
            }
        }

        // --- PAGINA 2: OBSERVACIONES Y ANALISIS ---
        const hasObservations = (historial && historial.length > 0) || ficha.observaciones_comercial || ficha.observaciones_jefaturatecnica;
        const hasAnalisis = (ficha.detalles && ficha.detalles.length > 0);

        if (hasObservations || hasAnalisis) {
            doc.addPage();

            // --- OBSERVACIONES (HISTORIAL) ---
            if (historial && historial.length > 0) {
                addSectionTitle('Historial de Observaciones', 'left');
                const sortedHistorial = [...historial].reverse();

                const tableObs = {
                    headers: [
                        { label: "Fecha y Hora", property: "fecha", width: 90 },
                        { label: "Área", property: "area", width: 80 },
                        { label: "Usuario", property: "user", width: 100 },
                        { label: "Observación", property: "obs", width: 245 }
                    ],
                    rows: sortedHistorial.map(item => {
                        const dateStr = item.fecha ? new Date(item.fecha).toLocaleString('es-CL') : 'Sin fecha';
                        const userStr = item.nombre_real || item.nombre_usuario || 'Sistema';
                        const obsText = item.observacion || 'Sin observaciones.';

                        let areaStr = 'Área';
                        if (item.accion === 'CREACION_FICHA') areaStr = 'Comercial';
                        if (item.accion === 'APROBACION_TECNICA' || item.accion === 'RECHAZO_TECNICA') areaStr = 'Técnica';
                        if (item.accion === 'APROBACION_COORDINACION' || item.accion === 'RECHAZO_COORDINACION') areaStr = 'Coordinación';
                        if (item.accion === 'ASIGNACION_MUESTREO' || item.accion === 'CANCELACION_MUESTREO') areaStr = 'Coord. Muestreo';

                        return [dateStr, areaStr, userStr, obsText];
                    })
                };

                doc.moveDown(0.5);
                const tableWidth = 515;
                const startX = (595 - tableWidth) / 2;

                doc.table(tableObs, {
                    width: tableWidth,
                    x: startX,
                    prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor('black'),
                    prepareRow: () => doc.font("Helvetica").fontSize(8).fillColor('#374151')
                });
            }
            else if (ficha.observaciones_comercial || ficha.observaciones_jefaturatecnica) {
                addSectionTitle('Observaciones');
                if (ficha.observaciones_comercial) {
                    doc.font('Helvetica-Bold').fontSize(9).text('Comercial: ', { continued: true });
                    doc.font('Helvetica').text(ficha.observaciones_comercial);
                    doc.moveDown(0.5);
                }
                if (ficha.observaciones_jefaturatecnica) {
                    doc.font('Helvetica-Bold').fontSize(9).text('Técnica: ', { continued: true });
                    doc.font('Helvetica').text(ficha.observaciones_jefaturatecnica);
                    doc.moveDown(0.5);
                }
            }

            // --- ANALISIS ---
            if (hasAnalisis) {
                doc.moveDown(1);
                addSectionTitle('Análisis Físico / Químico / Hidrobiológico', 'left');
                const tableAnalisis = {
                    headers: [
                        { label: "Análisis", property: "ana", width: 85 },
                        { label: "Tipo Muestra", property: "tm", width: 50 },
                        { label: "Límite Min", property: "lmin", width: 40 },
                        { label: "Límite Max", property: "lmax", width: 40 },
                        { label: "Error", property: "err", width: 30 },
                        { label: "Error Min", property: "emin", width: 40 },
                        { label: "Error Max", property: "emax", width: 40 },
                        { label: "Tipo Entrega", property: "ent", width: 50 },
                        { label: "Lab. Derivado", property: "lab1", width: 70 },
                        { label: "Lab. Secundario", property: "lab2", width: 70 }
                    ],
                    rows: ficha.detalles.map(a => [
                        a.nombre_tecnica || a.nombre_referenciaanalisis || a.nombre_matriz || '',
                        a.tipo_analisis || 'Terreno',
                        a.limitemax_d || '-',
                        a.limitemax_h || '-',
                        a.llevaerror === 'S' ? 'Sí' : 'No',
                        a.error_min || '-',
                        a.error_max || '-',
                        a.nombre_tipoentrega || (a.id_tipoentrega === 1 ? 'Directa' : (a.id_tipoentrega === 2 ? 'Transporte' : '-')),
                        a.nombre_laboratorioensayo || (a.tipo_analisis === 'Terreno' ? 'Interno' : '-'),
                        a.nombre_laboratorioensayo_2 || '-'
                    ])
                };
                doc.moveDown(0.5);
                const analWidth = 515;
                const analStartX = (595 - analWidth) / 2;

                doc.table(tableAnalisis, {
                    width: analWidth,
                    x: analStartX,
                    prepareHeader: () => doc.font("Helvetica-Bold").fontSize(7).fillColor('black'),
                    prepareRow: () => doc.font("Helvetica").fontSize(7).fillColor('#374151')
                });
            }
        }

        // --- MUESTREOS (AGENDA) ---
        if (agenda && agenda.length > 0) {
            doc.addPage();
            addSectionTitle('Asignación de Fechas y Muestreadores');

            const tableAgenda = {
                headers: [
                    { label: "Corr.", property: "corr", width: 90 },
                    { label: "Fecha", property: "fecha", width: 80 },
                    { label: "Instalación", property: "inst", width: 120 },
                    { label: "Retiro", property: "ret", width: 120 },
                    { label: "Estado", property: "est", width: 80 }
                ],
                rows: agenda.map(a => [
                    a.frecuencia_correlativo || '',
                    a.fecha_muestreo ? new Date(a.fecha_muestreo).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'Sin fecha',
                    a.instalacion || 'No asignado',
                    a.retiro || '-',
                    a.nombre_estadomuestreo || ''
                ])
            };
            doc.table(tableAgenda, {
                width: 510,
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(9).fillColor('black'),
                prepareRow: () => doc.font("Helvetica").fontSize(8).fillColor('#374151')
            });
        }
    }

    async generateFichaExcelBuffer(id) {
        try {
            const ficha = await this.getFichaById(id);
            if (!ficha) throw new Error("Ficha no encontrada");

            const pool = await getConnection();
            const request = pool.request();
            request.input('id', sql.Numeric(10, 0), id);

            const [agendaRes, historial] = await Promise.all([
                request.query(`
                    SELECT a.id_agendamam, a.frecuencia_correlativo, a.fecha_muestreo,
                           m1.nombre_muestreador as instalacion,
                           m2.nombre_muestreador as retiro,
                           e.nombre_estadomuestreo
                    FROM App_Ma_Agenda_MUESTREOS a
                    LEFT JOIN mae_muestreador m1 ON a.id_muestreador = m1.id_muestreador
                    LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
                    LEFT JOIN mae_estadomuestreo e ON a.id_estadomuestreo = e.id_estadomuestreo
                    WHERE a.id_fichaingresoservicio = @id
                    ORDER BY a.id_agendamam ASC
                `),
                this.getHistorial(id)
            ]);

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Ficha de Ingreso');

            // --- Estilos ---
            const titleStyle = { font: { bold: true, size: 14 } };
            const headerStyle = { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } } };

            let currentRow = 1;

            // --- SECCIÓN 1: INFORMACIÓN GENERAL ---
            sheet.getCell(`A${currentRow}`).value = 'FICHA DE INGRESO DE SERVICIO';
            sheet.getCell(`A${currentRow}`).font = titleStyle;
            currentRow += 2;

            const addRow = (label1, value1, label2, value2) => {
                sheet.getCell(`A${currentRow}`).value = label1;
                sheet.getCell(`A${currentRow}`).font = { bold: true };
                sheet.getCell(`B${currentRow}`).value = value1 || '-';
                if (label2) {
                    sheet.getCell(`D${currentRow}`).value = label2;
                    sheet.getCell(`D${currentRow}`).font = { bold: true };
                    sheet.getCell(`E${currentRow}`).value = value2 || '-';
                }
                currentRow++;
            };

            const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CL') : '-';

            addRow('Folio / ID', ficha.id_fichaingresoservicio, 'Fecha Creación', formatDate(ficha.fecha_fichacomercial));
            addRow('Tipo Monitoreo', ficha.tipo_monitoreo, 'Tipo de Agua', ficha.nombre_tipoagua);
            addRow('Cliente', ficha.nombre_empresa, 'Empresa Mandante', ficha.nombre_empresaservicio);
            addRow('Fuente Emisora', ficha.nombre_centro, 'Ubicación', ficha.ubicacion);
            addRow('Comuna', ficha.municipio, 'Región', ficha.estado);
            addRow('Código Centro', ficha.codigo_centro, 'Normas/Instrumento', ficha.instrumento_ambiental);
            addRow('Responsable', ficha.responsablemuestreo, 'Cargo', ficha.nombre_cargo);

            currentRow += 2;

            // --- SECCIÓN 2: HISTORIAL DE OBSERVACIONES ---
            sheet.getCell(`A${currentRow}`).value = 'HISTORIAL DE OBSERVACIONES';
            sheet.getCell(`A${currentRow}`).font = titleStyle;
            currentRow++;

            const obsHeaders = ['Fecha y Hora', 'Área', 'Usuario', 'Observación'];
            sheet.getRow(currentRow).values = obsHeaders;
            obsHeaders.forEach((_, i) => {
                sheet.getCell(currentRow, i + 1).style = headerStyle;
            });
            currentRow++;

            if (historial && historial.length > 0) {
                [...historial].reverse().forEach(h => {
                    let areaStr = 'Área';
                    if (h.accion === 'CREACION_FICHA') areaStr = 'Comercial';
                    if (h.accion === 'APROBACION_TECNICA' || h.accion === 'RECHAZO_TECNICA') areaStr = 'Técnica';
                    if (h.accion === 'APROBACION_COORDINACION' || h.accion === 'RECHAZO_COORDINACION') areaStr = 'Coordinación';
                    if (h.accion === 'ASIGNACION_MUESTREO' || h.accion === 'CANCELACION_MUESTREO') areaStr = 'Coord. Muestreo';

                    sheet.getRow(currentRow).values = [
                        h.fecha ? new Date(h.fecha).toLocaleString('es-CL') : '-',
                        areaStr,
                        h.nombre_real || h.nombre_usuario || 'Sistema',
                        h.observacion || '-'
                    ];
                    currentRow++;
                });
            } else {
                sheet.getRow(currentRow).values = ['-', '-', '-', 'Sin observaciones'];
                currentRow++;
            }

            currentRow += 2;

            // --- SECCIÓN 3: ANÁLISIS ---
            sheet.getCell(`A${currentRow}`).value = 'DETALLE DE ANÁLISIS';
            sheet.getCell(`A${currentRow}`).font = titleStyle;
            currentRow++;

            const analHeaders = ['Análisis', 'Tipo Muestra', 'Límite Min', 'Límite Max', 'Error', 'Tipo Entrega', 'Lab. Derivado', 'Lab. Secundario'];
            sheet.getRow(currentRow).values = analHeaders;
            analHeaders.forEach((_, i) => {
                sheet.getCell(currentRow, i + 1).style = headerStyle;
            });
            currentRow++;

            if (ficha.detalles && ficha.detalles.length > 0) {
                ficha.detalles.forEach(d => {
                    sheet.getRow(currentRow).values = [
                        d.nombre_tecnica || d.nombre_referenciaanalisis || '-',
                        d.tipo_analisis || 'Terreno',
                        d.limitemax_d || '-',
                        d.limitemax_h || '-',
                        d.llevaerror === 'S' ? 'Sí' : 'No',
                        d.nombre_tipoentrega || '-',
                        d.nombre_laboratorioensayo || '-',
                        d.nombre_laboratorioensayo_2 || '-'
                    ];
                    currentRow++;
                });
            }

            currentRow += 2;

            // --- SECCIÓN 4: AGENDA ---
            sheet.getCell(`A${currentRow}`).value = 'ASIGNACIÓN DE FECHAS Y MUESTREADORES';
            sheet.getCell(`A${currentRow}`).font = titleStyle;
            currentRow++;

            const agendaHeaders = ['Correlativo', 'Fecha Muestreo', 'Instalación', 'Retiro', 'Estado'];
            sheet.getRow(currentRow).values = agendaHeaders;
            agendaHeaders.forEach((_, i) => {
                sheet.getCell(currentRow, i + 1).style = headerStyle;
            });
            currentRow++;

            if (agendaRes.recordset && agendaRes.recordset.length > 0) {
                agendaRes.recordset.forEach(a => {
                    sheet.getRow(currentRow).values = [
                        a.frecuencia_correlativo || '-',
                        a.fecha_muestreo ? new Date(a.fecha_muestreo).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'Sin fecha',
                        a.instalacion || '-',
                        a.retiro || '-',
                        a.nombre_estadomuestreo || '-'
                    ];
                    currentRow++;
                });
            }

            // Ajustar anchos de columna
            sheet.columns.forEach(column => {
                column.width = 20;
            });

            return await workbook.xlsx.writeBuffer();
        } catch (error) {
            logger.error('Error generating Ficha Excel:', error);
            throw error;
        }
    }
    async getMuestreosEjecutados() {
        const pool = await getConnection();
        const request = pool.request();

        const query = `
            SELECT 
                a.id_agendamam,
                a.caso_adlab,
                a.frecuencia_correlativo,
                a.fecha_muestreo,
                a.id_estadomuestreo,
                e.nombre_estadomuestreo as estado_muestreo,
                f.id_fichaingresoservicio,
                f.fichaingresoservicio as correlativo_ficha,
                f.fecha_fichacomercial,
                f.id_empresa,
                c.nombre_empresa as cliente,
                f.id_empresaservicio,
                cs.nombre_empresa as empresa_servicio,
                f.id_centro,
                ce.nombre_centro as centro,
                f.id_subarea,
                s.nombre_subarea,
                f.id_objetivomuestreo_ma,
                o.nombre_objetivomuestreo_ma as objetivo,
                m.nombre_muestreador as muestreador,
                m2.nombre_muestreador as muestreador_retiro,
                f.estado_ficha
            FROM App_Ma_Agenda_MUESTREOS a
            JOIN App_Ma_FichaIngresoServicio_ENC f ON a.id_fichaingresoservicio = f.id_fichaingresoservicio
            LEFT JOIN mae_estadomuestreo e ON a.id_estadomuestreo = e.id_estadomuestreo
            LEFT JOIN mae_empresa c ON f.id_empresa = c.id_empresa
            LEFT JOIN mae_empresa cs ON f.id_empresaservicio = cs.id_empresa
            LEFT JOIN mae_centro ce ON f.id_centro = ce.id_centro
            LEFT JOIN mae_subarea s ON f.id_subarea = s.id_subarea
            LEFT JOIN mae_objetivomuestreo_ma o ON f.id_objetivomuestreo_ma = o.id_objetivomuestreo_ma
            LEFT JOIN mae_muestreador m ON a.id_muestreador = m.id_muestreador
            LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
            WHERE a.id_estadomuestreo = 3
            ORDER BY a.caso_adlab DESC, a.fecha_muestreo DESC, f.id_fichaingresoservicio DESC
        `;

        try {
            const result = await request.query(query);
            return result.recordset || [];
        } catch (error) {
            logger.error('Error fetching muestreos ejecutados:', error);
            throw error;
        }
    }

    async getExecutionDetail(id, correlativo) {
        try {
            const pool = await getConnection();

            const ejecutarQueryPrincipal = async (frec) => {
                return await pool.request()
                    .input('id', sql.Int, id)
                    .input('frecuencia', sql.VarChar, frec)
                    .query(`
                        SELECT TOP 1
                            a.id_agendamam, a.frecuencia_correlativo, a.caso_adlab,
                            e.nombre_empresa, c.nombre_centro, f.tipo_fichaingresoservicio,
                            CONVERT(VARCHAR(10), a.fecha_muestreo, 103) AS fecha_muestreo,
                            o.nombre_objetivomuestreo_ma, f.instrumento_ambiental, s.nombre_subarea,
                            f.observaciones_coordinador, f.referencia_googlemaps, f.id_fichaingresoservicio,
                            m.nombre_muestreador AS muestreador_inicio, m2.nombre_muestreador AS muestreador_retiro,
                            a.ma_muestreo_horai, CONVERT(VARCHAR(10), a.ma_muestreo_fechai, 23) AS ma_muestreo_fechai, a.ma_temperaturai, a.ma_phi, a.totalizador_inicio,
                            a.ma_muestreo_horat, CONVERT(VARCHAR(10), a.ma_muestreo_fechat, 23) AS ma_muestreo_fechat, a.ma_temperaturat, a.ma_pht, a.totalizador_final,
                            a.ma_hora_compuesta, CONVERT(VARCHAR(10), a.ma_fecha_compuesta, 23) AS ma_fecha_compuesta, a.ma_temperatura_compuesta, a.ma_ph_compuesta,
                            a.vdd, a.id_archivo_terreno, f.medicion_caudal, dh.nombre_dispositivohidraulico,
                            a.instalacion_completado, a.retiro_completado,
                            a.condicionmedicion_flujolaminar, a.condicionmedicion_velocidaduniforme, a.condicionmedicion_observacion,
                            a.nombre_observadorterreno, a.cargo_observadorterreno,
                            a.nombre_observadorterreno_retiro, a.cargo_observadorterreno_retiro,
                            a.observaciones_muestreador, a.observaciones_muestreador2,
                            ct.nombre_contacto, ct.email_contacto,
                            a.temperatura_corregidai, a.temperatura_corregidat, a.temperatura_corregidacompuesta, a.temperatura_fc,
                            a.id_supervisor, a.id_supervisor_retiro,
                            f.ma_coordenadas, -- Add UTM coordinates as fallback
                            CONVERT(VARCHAR(10), a.fechaderivado, 103) AS fechaderivado, a.horaderivado,
                            l.nombre_laboratorioensayo AS laboratorio_derivacion_nombre
                        FROM App_Ma_FichaIngresoServicio_ENC f
                        INNER JOIN mae_empresa e ON f.id_empresa = e.id_empresa
                        INNER JOIN App_Ma_Agenda_MUESTREOS a ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
                        INNER JOIN mae_muestreador m ON a.id_muestreador = m.id_muestreador
                        LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
                        INNER JOIN mae_centro c ON f.id_centro = c.id_centro
                        LEFT JOIN mae_objetivomuestreo_ma o ON f.id_objetivomuestreo_ma = o.id_objetivomuestreo_ma
                        LEFT JOIN mae_subarea s ON f.id_subarea = s.id_subarea
                        LEFT JOIN mae_dispositivohidraulico dh ON f.id_dispositivohidraulico = dh.id_dispositivohidraulico
                        LEFT JOIN mae_contacto ct ON f.id_contacto = ct.id_contacto
                        LEFT JOIN App_Ma_Resultados r 
                            ON a.frecuencia_correlativo = r.frecuencia_correlativo
                            AND r.tipo_analisis = 'Laboratorio'
                        LEFT JOIN mae_laboratorioensayo l 
                            ON r.id_laboratorioensayo = l.id_laboratorioensayo
                        WHERE f.id_fichaingresoservicio = @id AND a.frecuencia_correlativo = @frecuencia
                    `);
            };

            const frecuenciaOriginal = correlativo.trim();
            let agendaResult = await ejecutarQueryPrincipal(frecuenciaOriginal);

            // Fallback strategy: Pendiente -> Ejecutado
            if (agendaResult.recordset.length === 0 && frecuenciaOriginal.includes("Pendiente")) {
                const frecuenciaEjecutado = frecuenciaOriginal.replace("Pendiente", "Ejecutado");
                logger.debug(`Reintentando getExecutionDetail con frecuencia Ejecutado: ${frecuenciaEjecutado}`);
                agendaResult = await ejecutarQueryPrincipal(frecuenciaEjecutado);
            }

            if (agendaResult.recordset.length === 0) {
                throw new Error('No se encontró la ficha con la frecuencia proporcionada');
            }

            const f = agendaResult.recordset[0];
            const frecuenciaReal = f.frecuencia_correlativo;

            // Coordinate extraction from Google Maps Link
            let lat = null;
            let lng = null;
            if (f.referencia_googlemaps) {
                // Try to extract from query parameters (e.g., query=-33.44,-70.66)
                const queryMatch = f.referencia_googlemaps.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (queryMatch) {
                    lat = queryMatch[1];
                    lng = queryMatch[2];
                } else {
                    // Try to extract from path (e.g., /@ -33.44,-70.66,15z)
                    const pathMatch = f.referencia_googlemaps.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                    if (pathMatch) {
                        lat = pathMatch[1];
                        lng = pathMatch[2];
                    }
                }
            }

            // Structured response matching what FichaDetailView expects
            const fichaData = {
                ...f,
                latitud: lat,
                longitud: lng
            };

            // Fetch Laboratories Principal/Suplente from DET
            const labResult = await pool.request()
                .input('id', sql.Int, id)
                .query(`
                    SELECT TOP 1
                        l1.nombre_laboratorioensayo AS lab_principal,
                        l2.nombre_laboratorioensayo AS lab_suplente
                    FROM App_Ma_FichaIngresoServicio_DET det
                    LEFT JOIN mae_laboratorioensayo l1 ON det.id_laboratorioensayo = l1.id_laboratorioensayo
                    LEFT JOIN mae_laboratorioensayo l2 ON det.id_laboratorioensayo_2 = l2.id_laboratorioensayo
                    WHERE det.id_fichaingresoservicio = @id AND det.tipo_analisis = 'Laboratorio'
                    ORDER BY CASE WHEN det.id_laboratorioensayo_2 > 0 THEN 0 ELSE 1 END
                `);

            const laboratorios = labResult.recordset[0] || { lab_principal: null, lab_suplente: null };

            // Fetch Analysis results with sub-query for Suplente
            const analisisResult = await pool.request()
                .input('id', sql.Int, id)
                .input('frecuencia', sql.VarChar, frecuenciaReal)
                .query(`
                    SELECT 
                        t.nombre_tecnica AS parametro, 
                        r.uf_individual, r.limitemax_d, r.limitemax_h,
                        CASE 
                            WHEN r.tipo_analisis = 'Laboratorio' THEN 'Lab'
                            ELSE ISNULL(r.estado, '')
                        END AS valor,
                        r.tipo_analisis,
                        r.id_laboratorioensayo,
                        l.nombre_laboratorioensayo,
                        COALESCE(detSuplente.id_laboratorioensayo_2, 0) AS id_laboratorioensayo_2,
                        l2.nombre_laboratorioensayo AS nombre_laboratorioensayo_2
                    FROM App_Ma_Resultados r
                    INNER JOIN mae_tecnica t ON r.id_tecnica = t.id_tecnica
                    LEFT JOIN mae_laboratorioensayo l ON r.id_laboratorioensayo = l.id_laboratorioensayo
                    OUTER APPLY (
                        SELECT TOP 1 det2.id_laboratorioensayo_2
                        FROM App_Ma_FichaIngresoServicio_DET det2
                        WHERE det2.id_fichaingresoservicio = r.id_fichaingresoservicio
                          AND det2.id_laboratorioensayo_2 IS NOT NULL
                          AND det2.id_laboratorioensayo_2 > 0
                    ) detSuplente
                    LEFT JOIN mae_laboratorioensayo l2 ON detSuplente.id_laboratorioensayo_2 = l2.id_laboratorioensayo
                    WHERE r.id_fichaingresoservicio = @id AND r.frecuencia_correlativo = @frecuencia
                    ORDER BY t.nombre_tecnica
                `);

            // Fetch Equipment
            const equiposResult = await pool.request()
                .input('id', sql.Int, id)
                .input('frecuencia', sql.VarChar, frecuenciaReal)
                .query(`
                    SELECT 
                        eq.nombre, eq.codigo, e.usado_instalacion, e.usado_retiro
                    FROM App_Ma_Equipos_MUESTREOS e
                    INNER JOIN mae_equipo eq ON e.id_equipo = eq.id_equipo
                    WHERE e.id_fichaingresoservicio = @id 
                      AND e.frecuencia_correlativo = @frecuencia 
                      AND e.seleccionado = 'S'
                      AND ISNULL(e.estado, 'ACTIVO') = 'ACTIVO'
                `);

            // Filesystem Media Logic
            const media = { ma_fotografia: '' };
            const rootFotosPath = process.env.RUTA_FOTOS || 'C:\\Users\\vremolcoy\\Documents\\FOTOS APP';
            const correlativoFolder = path.join(rootFotosPath, frecuenciaReal.trim());
            const signaturesRaw = [];

            if (fs.existsSync(correlativoFolder)) {
                try {
                    const files = fs.readdirSync(correlativoFolder);
                    const fsPhotos = [];
                    const fsDocs = [];

                    files.forEach(file => {
                        const publicUrl = `/fotos/${frecuenciaReal.trim()}/${file}`;
                        const lowerFile = file.toLowerCase();

                        if (lowerFile.includes('firma') && lowerFile.endsWith('.png')) {
                            signaturesRaw.push({
                                nombre: file,
                                ruta: publicUrl,
                                tipo: lowerFile.includes('instalacion') ? 'instalacion' : lowerFile.includes('retiro') ? 'retiro' : 'desconocido',
                                rol: lowerFile.includes('muestreador') ? 'muestreador' : lowerFile.includes('observador') ? 'observador' : lowerFile.includes('supervisor') ? 'supervisor' : 'otro'
                            });
                        } else if (lowerFile.includes('foto') && /\.(jpg|jpeg|png)$/i.test(file)) {
                            fsPhotos.push(publicUrl);
                        } else if (lowerFile.endsWith('.pdf')) {
                            if (lowerFile.startsWith('foma_')) {
                                fsDocs.push({
                                    nombre: file,
                                    tipo: 'FoMa',
                                    ruta: publicUrl,
                                    label: 'Documento FoMa'
                                });
                            } else if (lowerFile.startsWith('cadenacustodia_')) {
                                let labName = 'General';
                                const strippedFreq = frecuenciaReal.trim();
                                const prefixRegex = new RegExp(`^cadenacustodia_${strippedFreq}_`, 'i');
                                
                                if (prefixRegex.test(file)) {
                                    labName = file.replace(prefixRegex, '')
                                                  .replace(/\.pdf$/i, '')
                                                  .replace(/_/g, ' ');
                                } else {
                                    // Fallback
                                    const parts = file.split('_');
                                    if (parts.length > 2) {
                                        labName = parts.slice(2).join(' ').replace(/\.pdf$/i, '');
                                    }
                                }

                                fsDocs.push({
                                    nombre: file,
                                    tipo: 'Cadena de Custodia',
                                    ruta: publicUrl,
                                    label: labName
                                });
                            }
                        }
                    });

                    media.ma_fotografia = fsPhotos.join(';');
                    media.documentos = fsDocs;
                } catch (fsErr) {
                    logger.warn(`Could not read correlativo folder ${correlativoFolder}: ${fsErr.message}`);
                }
            }

            return {
                ficha: f,
                equipos: equiposResult.recordset,
                analisis: analisisResult.recordset,
                laboratorios: laboratorios,
                media,
                procesos: {
                    instalacion: f.instalacion_completado === 'S' || f.ma_muestreo_fechai ? {
                        nombreMuestreador: f.muestreador_inicio || 'S/D',
                        fecha: f.ma_muestreo_fechai,
                        hora: f.ma_muestreo_horai,
                        nombreObservador: f.nombre_observadorterreno || 'S/D',
                        cargoObservador: f.cargo_observadorterreno || 'S/D',
                        observaciones: f.observaciones_muestreador || 'Sin observaciones.',
                        supervisado: f.id_supervisor ? 'S' : 'N',
                        firmas: signaturesRaw.filter(fi => fi.tipo === 'instalacion'),
                        condiciones: {
                            flujoLaminar: f.condicionmedicion_flujolaminar,
                            velUniforme: f.condicionmedicion_velocidaduniforme,
                            observaciones: f.condicionmedicion_observacion
                        }
                    } : null,
                    retiro: f.retiro_completado === 'S' || f.ma_muestreo_fechat ? {
                        nombreMuestreador: f.muestreador_retiro || 'S/D',
                        fecha: f.ma_muestreo_fechat,
                        hora: f.ma_muestreo_horat,
                        nombreObservador: f.nombre_observadorterreno_retiro || 'S/D',
                        cargoObservador: f.cargo_observadorterreno_retiro || 'S/D',
                        observaciones: f.observaciones_muestreador2 || 'Sin observaciones.',
                        supervisado: f.id_supervisor_retiro ? 'S' : 'N',
                        derivacion: {
                            laboratorio: f.laboratorio_derivacion_nombre || 'Interno',
                            fecha: f.fechaderivado,
                            hora: f.horaderivado
                        },
                        firmas: signaturesRaw.filter(fi => fi.tipo === 'retiro'),
                        condiciones: {
                            flujoLaminar: f.condicionmedicion_flujolaminar,
                            velUniforme: f.condicionmedicion_velocidaduniforme,
                            observaciones: f.condicionmedicion_observacion
                        }
                    } : null
                }
            };
        } catch (error) {
            logger.error('Error in getExecutionDetail refactored:', error);
            throw error;
        }
    }

    async enviarDocumentosManual(data) {
        const { idFicha, correlativo, documento, to, cc, user } = data;
        const pool = await getConnection();

        try {
            // Override to and cc based on requirement
            const finalTo = 'vremolcoy@adldiagnostic.cl';

            // Get Ficha data
            const fichaResult = await pool.request()
                .input('id', sql.Int, idFicha)
                .input('correlativo', sql.VarChar, correlativo)
                .query(`
                    SELECT 
                        a.caso_adlab
                    FROM App_Ma_FichaIngresoServicio_ENC f
                    INNER JOIN App_Ma_Agenda_MUESTREOS a ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
                    WHERE f.id_fichaingresoservicio = @id AND a.frecuencia_correlativo = @correlativo
                `);
            
            let casoAdlab = 'Sin Caso';
            if (fichaResult.recordset.length > 0) {
                casoAdlab = fichaResult.recordset[0].caso_adlab || 'Sin Caso';
            }

            // Get Event Template (73 = FoMa, 74 = Cadena)
            const idEvento = documento.tipo === 'FoMa' ? 73 : 74;
            const eventResult = await pool.request()
                .input('idEvento', sql.Int, idEvento)
                .query('SELECT asunto_template, cuerpo_template_html FROM mae_evento_notificacion WHERE id_evento = @idEvento');

            if (eventResult.recordset.length === 0) {
                throw new Error('Plantilla de correo no encontrada.');
            }
            
            const eventInfo = eventResult.recordset[0];
            
            // Prepare replacements
            let asunto = eventInfo.asunto_template;
            let html = eventInfo.cuerpo_template_html;

            const labName = documento.label || 'Laboratorio';

            asunto = asunto.replace(/{CASO_ADLAB}/g, casoAdlab)
                           .replace(/{LABORATORIO_ASIGNADO}/g, labName);
            
            html = html.replace(/{CASO_ADLAB}/g, casoAdlab)
                       .replace(/{LABORATORIO_ASIGNADO}/g, labName)
                       .replace(/{LOGO_URL}/g, 'cid:logo_adl')
                       .replace(/{ANIO_ACTUAL}/g, new Date().getFullYear().toString());

            // Build attachments
            const attachments = [];
            const rootFotosPath = process.env.RUTA_FOTOS || 'C:\\Users\\vremolcoy\\Documents\\FOTOS APP';

            // Logo
            const logoPath = path.resolve(process.cwd(), '../frontend-adlone/src/assets/images/logo_adl.png');
            if (fs.existsSync(logoPath)) {
                attachments.push({
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'logo_adl'
                });
            }

            // PDF Document
            if (documento.ruta) {
                const parts = documento.ruta.split('/fotos/');
                if (parts.length > 1) {
                    const relativePath = parts[1]; 
                    const physicalPath = path.join(rootFotosPath, decodeURIComponent(relativePath));
                    if (fs.existsSync(physicalPath)) {
                        attachments.push({
                            filename: documento.nombre,
                            path: physicalPath
                        });
                    } else {
                        logger.warn(`PDF not found at physical path: ${physicalPath}`);
                        throw new Error('El archivo físico del documento no fue encontrado.');
                    }
                }
            } else {
                throw new Error('El documento no contiene una ruta válida.');
            }

            const transporter = getTransporter();
            const mailOptions = {
                from: process.env.SMTP_FROM || '"Notificaciones ADL" <no-reply@adldiagnostic.cl>',
                to: finalTo,
                subject: asunto,
                html: html,
                attachments: attachments
            };

            const info = await transporter.sendMail(mailOptions);
            logger.info(`Documento reenviado manualmente a ${finalTo} - MessageId: ${info.messageId}`);
            
            return {
                success: true,
                message: 'Documento reenviado correctamente al destinatario de prueba.'
            };

        } catch (error) {
            logger.error('Error en enviarDocumentosManual:', error);
            throw error;
        }
    }
}

export default new FichaIngresoService();
