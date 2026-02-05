import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import notificationService from './notification.service.js';

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
            const userId = data.user?.id || 1;

            // Helper for empty strings/nulls
            const val = (v) => v === undefined || v === null || v === '' ? null : v;
            const valStr = (v, len) => val(v) ? String(v).substring(0, len) : null;
            const valNum = (v) => val(v) ? Number(v) : null;

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
                    condicionmedicion_flujolaminar, condicionmedicion_velocidaduniforme, condicionmedicion_observacion,
                    condicionmedicion_cumple, id_jefaturatecnica, fecha_jefaturatecnica,
                    hora_jefaturatecnica, coordenadas_ruta, id_validaciontecnica,
                    observaciones_jefaturatecnica, observaciones_coordinador,
                    id_usuario, fecha_fichacomercial, hora_fichacomercial,
                    responsablemuestreo, id_cargo, observaciones_comercial, ubicacion
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
                    @cond_flujo, @cond_velocidad, @cond_obs,
                    @cond_cumple, @id_jefatura, @fecha_jefatura,
                    @hora_jefatura, @coord_ruta, @id_val_tecnica,
                    @obs_jefatura, @obs_coordinador,
                    @id_usuario, @fecha, @hora,
                    @responsable, @id_cargo, @obs_comercial, @ubicacion
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
                    requestDet.input('id_laboratorio_2', sql.Numeric(10, 0), idLab2 || 0);

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
            notificationService.send('FICHA_CREADA', { correlativo: String(newId) });

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
            const valStr = (v, len) => val(v) ? String(v).substring(0, len) : null;
            const valNum = (v) => val(v) ? Number(v) : null;

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

            // Condition Metrics defaults (simplified update for existing fields)
            request.input('cond_flujo', sql.VarChar(1), '');
            request.input('ubicacion', sql.VarChar(200), valStr(ant.ubicacion, 200));
            request.input('responsable', sql.VarChar(20), valStr(ant.responsableMuestreo, 20));
            request.input('obs_comercial', sql.VarChar(250), valStr(obs, 250));
            request.input('id_cargo', sql.Numeric(10, 0), valNum(ant.cargoResponsable));

            await request.query(`
                UPDATE App_Ma_FichaIngresoServicio_ENC
                SET 
                                        id_validaciontecnica = 3,
                    estado_ficha = 'PENDIENTE TÉCNICA',
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
                    id_dispositivohidraulico = @id_disp,
                    dispositivohidraulico_medida = @disp_medida,
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
                        reqUpdateDet.input('id_laboratorio_2', sql.Numeric(10, 0), idLab2 || 0);

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
                        requestDet.input('id_laboratorio_2', sql.Numeric(10, 0), idLab2 || 0);

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
            const activeRows = allRows.filter(r => r.estado_caso !== 'ANULADA');
            const anuladaRows = allRows.filter(r => r.estado_caso === 'ANULADA');
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
                logger.info(`Agenda Sync: Need ${itemsNeeded} more items. Checking ANULADAS for reactivation...`);

                let itemsReactivated = 0;
                let itemsCreated = 0;

                // STEP 1: Reactivate ANULADAS (up to itemsNeeded)
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

                    logger.info(`Reactivated ANULADA agenda item ${rowToReactivate.id_agendamam}`);
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
                logger.info(`Agenda Sync: Reducing items by ${itemsToRemove}. Marking as ANULADA.`);

                // We remove from the END (Tail)
                // e.g. if we have 4 items [0,1,2,3] and want 2, we mark indices 2 and 3 as ANULADA.
                for (let i = newTotalServicios; i < currentCount; i++) {
                    const rowToRemove = activeRows[i];

                    // Get current correlativo and update it to ANULA
                    const currentCorr = rowToRemove.frecuencia_correlativo || '';
                    const newCorr = currentCorr.replace('-Pendiente-', '-ANULA-');

                    const reqAnul = new sql.Request(transaction);
                    reqAnul.input('id_ag', sql.Numeric(10, 0), rowToRemove.id_agendamam);
                    reqAnul.input('new_corr', sql.VarChar(50), newCorr);

                    await reqAnul.query(`
                        UPDATE App_Ma_Agenda_MUESTREOS 
                        SET estado_caso = 'ANULADA', 
                            id_estadomuestreo = 99,
                            frecuencia_correlativo = @new_corr
                        WHERE id_agendamam = @id_ag
                    `);

                    logger.info(`Marked agenda item ${rowToRemove.id_agendamam} as ANULADA with correlativo ${newCorr}`);
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
                const estado = agRow.estado_caso === 'ANULADA' ? 'ANULA' : 'Pendiente';
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
            return { success: true, message: 'Ficha actualizada correctamente' };

        } catch (error) {
            console.error('CRITICAL UPDATE ERROR:', error);
            try { await transaction.rollback(); } catch (e) { }
            throw error;
        }
    }
    async getAllFichas() {
        const pool = await getConnection();
        // Updated to use the correct Stored Procedure provided by user
        try {
            const result = await pool.request().execute('MAM_FichaComercial_ConsultaComercial');
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

            if (!resultEnc.recordset || resultEnc.recordset.length === 0) {
                logger.warn(`Ficha ID ${id} not found via SP ENC`);
                return null;
            }

            const ficha = resultEnc.recordset[0];
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
                        a.frecuencia,
                        a.total_servicios,
                        a.frecuencia_factor,
                        a.id_frecuencia
                    FROM App_Ma_FichaIngresoServicio_ENC e
                    LEFT JOIN App_Ma_Agenda_MUESTREOS a ON e.id_fichaingresoservicio = a.id_fichaingresoservicio
                    WHERE e.id_fichaingresoservicio = @id
                `);

                if (parityCheck.recordset.length > 0) {
                    const raw = parityCheck.recordset[0];

                    // Merge raw data into ficha (Encabezado)
                    ficha.instrumento_ambiental = ficha.instrumento_ambiental || raw.instrumento_ambiental;
                    // Note: DB column is id_empresaservicio (singular), but frontend/params might expect plural key if legacy SP returned it.
                    // We map it to id_empresaservicios (plural) which is what CommercialDetailView expects (line 60).
                    ficha.id_empresaservicios = ficha.id_empresaservicios || raw.id_empresaservicio;

                    ficha.ma_punto_muestreo = ficha.ma_punto_muestreo || raw.ma_punto_muestreo;
                    ficha.ma_coordenadas = ficha.ma_coordenadas || raw.ma_coordenadas;
                    ficha.tipo_fichaingresoservicio = ficha.tipo_fichaingresoservicio || raw.tipo_fichaingresoservicio;
                    ficha.id_lugaranalisis = ficha.id_lugaranalisis || raw.id_lugaranalisis;

                    ficha.id_tipoagua = ficha.id_tipoagua || raw.id_tipoagua;
                    ficha.ubicacion = ficha.ubicacion || raw.ubicacion;
                    ficha.nombre_tabla_largo = ficha.nombre_tabla_largo || raw.nombre_tabla_largo;

                    // Merge raw data into ficha.agenda
                    ficha.agenda = ficha.agenda || {};
                    ficha.agenda.frecuencia = ficha.agenda.frecuencia || raw.frecuencia;
                    ficha.agenda.total_servicios = ficha.agenda.total_servicios || raw.total_servicios;
                    ficha.agenda.frecuencia_factor = ficha.agenda.frecuencia_factor || raw.frecuencia_factor;
                    ficha.agenda.id_frecuencia = ficha.agenda.id_frecuencia || raw.id_frecuencia;
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
                        calculatedStatus = 'Anulada';
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
            await request.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET id_validaciontecnica = 1, observaciones_jefaturatecnica = @obs WHERE id_fichaingresoservicio = @id");

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
            notificationService.send('FICHA_APROBADA_TECNICA', { correlativo: String(id) });

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
            await request.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET id_validaciontecnica = 2, observaciones_jefaturatecnica = @obs WHERE id_fichaingresoservicio = @id");

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
            notificationService.send('FICHA_RECHAZADA_TECNICA', { correlativo: String(id) });

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
            notificationService.send('FICHA_APROBADA_COORDINACION', { correlativo: String(id) });

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
            await request.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET id_validaciontecnica = 4, observaciones_coordinador = @obs WHERE id_fichaingresoservicio = @id");

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
            // Use MAM_FichaComercial_ConsultaComercial instead of ConsultaCoordinador
            // This SP shows ALL fichas (even without agenda) and has better state mapping
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

        try {
            // Use SP (now fixed)
            const result = await request.execute('MAM_FichaComercial_ConsultaCoordinadorDetalle');

            logger.info(`SP executed for ficha ${id}, recordset length: ${result.recordset ? result.recordset.length : 'null/undefined'} `);


            // If SP returns empty, use fallback query without estado filter
            if (!result.recordset || result.recordset.length === 0) {
                logger.info(`SP returned empty for ficha ${id}, trying fallback query`);
                const fallbackRequest = pool.request();
                fallbackRequest.input('xid_fichaingresoservicio', sql.Numeric(10, 0), id);

                const resFallback = await fallbackRequest.query(`
                    SELECT a.*,
                m.nombre_muestreador,
                m2.nombre_muestreador as nombre_muestreador2,
                em.nombre_estadomuestreo,
                f.nombre_frecuencia,
                f.dias,
                a.fecha_muestreo,
                a.id_muestreador2,
                fis.fichaingresoservicio,
                fis.tipo_fichaingresoservicio,
                emp.nombre_empresa as empresa_servicio,
                cen.nombre_centro as centro,
                obj.nombre_objetivomuestreo_ma,
                sub.nombre_subarea,
                coord.nombre_coordinador
                    FROM App_Ma_Agenda_MUESTREOS a
                    LEFT JOIN mae_muestreador m ON a.id_muestreador = m.id_muestreador
                    LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
                    LEFT JOIN mae_estadomuestreo em ON a.id_estadomuestreo = em.id_estadomuestreo
                    LEFT JOIN mae_frecuencia f ON a.id_frecuencia = f.id_frecuencia
                    LEFT JOIN App_Ma_FichaIngresoServicio_ENC fis ON a.id_fichaingresoservicio = fis.id_fichaingresoservicio
                    LEFT JOIN mae_empresa emp ON fis.id_empresa = emp.id_empresa
                    LEFT JOIN mae_centro cen ON fis.id_centro = cen.id_centro
                    LEFT JOIN mae_objetivomuestreo_ma obj ON fis.id_objetivomuestreo_ma = obj.id_objetivomuestreo_ma
                    LEFT JOIN mae_subarea sub ON fis.id_subarea = sub.id_subarea
                    LEFT JOIN mae_coordinador coord ON a.id_coordinador = coord.id_coordinador
                    WHERE a.id_fichaingresoservicio = @xid_fichaingresoservicio
                    ORDER BY a.id_agendamam
                `);
                return resFallback.recordset;
            }

            return result.recordset;

            // If SP returns data, enrich it with fecha_muestreo and id_muestreador2
            const enrichRequest = pool.request();
            enrichRequest.input('xid_fichaingresoservicio', sql.Numeric(10, 0), id);

            const enrichResult = await enrichRequest.query(`
            SELECT
            id_agendamam,
                fecha_muestreo,
                id_muestreador,
                id_muestreador2,
                m2.nombre_muestreador as nombre_muestreador2
                FROM App_Ma_Agenda_MUESTREOS a
                LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
                WHERE id_fichaingresoservicio = @xid_fichaingresoservicio
                `);

            // Merge the data
            const enrichMap = {};
            enrichResult.recordset.forEach(row => {
                enrichMap[row.id_agendamam] = {
                    fecha_muestreo: row.fecha_muestreo,
                    id_muestreador2: row.id_muestreador2,
                    nombre_muestreador2: row.nombre_muestreador2
                };
            });

            // Add missing fields to SP results
            const enrichedData = result.recordset.map(row => ({
                ...row,
                fecha_muestreo: enrichMap[row.id_agendamam]?.fecha_muestreo || null,
                id_muestreador2: enrichMap[row.id_agendamam]?.id_muestreador2 || null,
                nombre_muestreador2: enrichMap[row.id_agendamam]?.nombre_muestreador2 || null
            }));

            return enrichedData;
        } catch (err) {
            // Fallback if SP missing (though verified earlier)
            logger.error('SP MAM_FichaComercial_ConsultaCoordinadorDetalle failed', err);
            // Fallback query
            const fallbackRequest = pool.request();
            fallbackRequest.input('xid_fichaingresoservicio', sql.Numeric(10, 0), id);

            const resFallback = await fallbackRequest.query(`
                SELECT a.*, m.nombre_muestreador,
                em.nombre_estadomuestreo,
                f.nombre_frecuencia
                FROM App_Ma_Agenda_MUESTREOS a
                LEFT JOIN mae_muestreador m ON a.id_muestreador = m.id_muestreador
                LEFT JOIN mae_estadomuestreo em ON a.id_estadomuestreo = em.id_estadomuestreo
                LEFT JOIN mae_frecuencia f ON a.id_frecuencia = f.id_frecuencia
                WHERE a.id_fichaingresoservicio = @xid_fichaingresoservicio
                ORDER BY a.id_agendamam
                `);
            return resFallback.recordset;
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

            for (const assignment of assignments) {
                const {
                    id,                         // id_agendamam
                    fecha,                      // fecha en formato YYYY-MM-DD
                    idMuestreadorInstalacion,
                    idMuestreadorRetiro,
                    idFichaIngresoServicio,
                    frecuenciaCorrelativo
                } = assignment;

                // 1. ACTUALIZAR App_Ma_Agenda_MUESTREOS
                const dateObj = new Date(fecha);
                const day = dateObj.getUTCDate();
                const month = dateObj.getUTCMonth() + 1;
                const year = dateObj.getUTCFullYear();

                const updateRequest = new sql.Request(transaction);
                updateRequest.input('fecha', sql.Date, dateObj);
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

                // 3. CREAR REGISTROS EN App_Ma_Equipos_MUESTREOS
                // Obtener equipos del muestreador de instalación
                const equiposRequest = new sql.Request(transaction);
                equiposRequest.input('idMuestreador', sql.Numeric(10, 0), idMuestreadorInstalacion);

                const equiposResult = await equiposRequest.query(`
            SELECT *
                FROM mae_equipo 
                    WHERE id_muestreador = @idMuestreador 
                    ORDER BY nombre
                `);

                // Insertar cada equipo disponible
                for (const equipo of equiposResult.recordset) {
                    const equipoRequest = new sql.Request(transaction);

                    equipoRequest.input('idFicha', sql.Numeric(10, 0), idFichaIngresoServicio);
                    equipoRequest.input('correlativo', sql.VarChar(50), frecuenciaCorrelativo);
                    equipoRequest.input('idEquipo', sql.Numeric(10, 0), equipo.id_equipo);
                    equipoRequest.input('tieneFC', sql.VarChar(1), equipo.tienefc || null);
                    equipoRequest.input('error0', sql.Numeric(10, 1), equipo.error0);
                    equipoRequest.input('error15', sql.Numeric(10, 1), equipo.error15);
                    equipoRequest.input('error30', sql.Numeric(10, 1), equipo.error30);
                    equipoRequest.input('idMuestreador', sql.Numeric(10, 0), idMuestreadorInstalacion);
                    equipoRequest.input('seleccionado', sql.VarChar(1), 'N');
                    equipoRequest.input('usadoInstalacion', sql.VarChar(1), null);
                    equipoRequest.input('usadoRetiro', sql.VarChar(1), null);

                    // Check if equipment record exists
                    const checkEquipoResult = await equipoRequest.query(`
                        SELECT COUNT(*) as count
                        FROM App_Ma_Equipos_MUESTREOS
                        WHERE id_fichaingresoservicio = @idFicha
                          AND frecuencia_correlativo = @correlativo
                          AND id_equipo = @idEquipo
                `);

                    const equipoExists = checkEquipoResult.recordset[0].count > 0;

                    if (equipoExists) {
                        // UPDATE existing equipment record
                        await equipoRequest.query(`
                            UPDATE App_Ma_Equipos_MUESTREOS
                            SET tienefc = @tieneFC,
                error0 = @error0,
                error15 = @error15,
                error30 = @error30,
                id_muestreador = @idMuestreador
                            WHERE id_fichaingresoservicio = @idFicha
                              AND frecuencia_correlativo = @correlativo
                              AND id_equipo = @idEquipo
                `);
                    } else {
                        // INSERT new equipment record
                        await equipoRequest.query(`
                            INSERT INTO App_Ma_Equipos_MUESTREOS(
                    id_fichaingresoservicio, frecuencia_correlativo, id_equipo,
                    tienefc, error0, error15, error30, id_muestreador,
                    seleccionado, usado_instalacion, usado_retiro
                ) VALUES(
                    @idFicha, @correlativo, @idEquipo,
                    @tieneFC, @error0, @error15, @error30, @idMuestreador,
                    @seleccionado, @usadoInstalacion, @usadoRetiro
                )
                        `);
                    }
                }

                successCount++;
            }

            // NOTIFICATION: Asignada (Grouped by Ficha to avoid spam)
            // NOTIFICATION: Asignada (Grouped by Ficha to avoid spam)
            const distinctFichas = [...new Set(assignments.map(a => a.idFichaIngresoServicio))];
            distinctFichas.forEach(fid => {
                notificationService.send('FICHA_ASIGNADA', { correlativo: String(fid) });
            });

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

}

export default new FichaIngresoService();
