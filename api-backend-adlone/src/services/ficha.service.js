import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

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
                for (const row of analisisList) {
                    const requestDet = new sql.Request(transaction);

                    requestDet.input('id_ficha', sql.Numeric(10, 0), newId);
                    requestDet.input('id_tecnica', sql.Numeric(10, 0), valNum(row.id_tecnica));
                    requestDet.input('id_normativa', sql.Numeric(10, 0), valNum(row.id_normativa));
                    requestDet.input('id_normativareferencia', sql.Numeric(10, 0), valNum(row.id_normativareferencia));
                    requestDet.input('id_referenciaanalisis', sql.Numeric(10, 0), valNum(row.id_referenciaanalisis));

                    requestDet.input('limitemax_d', sql.Numeric(10, 4), valNum(row.limitemax_d) || 0);
                    requestDet.input('limitemax_h', sql.Numeric(10, 4), valNum(row.limitemax_h) || 0);
                    requestDet.input('llevaerror', sql.VarChar(1), row.llevaerror === true || row.llevaerror === 'S' || row.llevaerror === 'Y' ? 'S' : 'N');
                    requestDet.input('error_min', sql.Numeric(10, 4), valNum(row.error_min) || 0);
                    requestDet.input('error_max', sql.Numeric(10, 4), valNum(row.error_max) || 0);

                    requestDet.input('tipo_analisis', sql.VarChar(20), valStr(row.tipo_analisis, 20));
                    requestDet.input('uf', sql.Numeric(10, 3), valNum(row.uf_individual || row.uf));
                    requestDet.input('item', sql.Numeric(10, 0), itemCounter);

                    let idLab = valNum(row.id_laboratorioensayo);
                    if (row.tipo_analisis && row.tipo_analisis.trim() === 'Terreno') {
                        idLab = 0;
                    }
                    requestDet.input('id_laboratorio', sql.Numeric(10, 0), idLab);
                    // NEW: Secondary Laboratory
                    let idLab2 = valNum(row.id_laboratorioensayo_2);
                    if (row.tipo_analisis && row.tipo_analisis.trim() === 'Terreno') {
                        idLab2 = 0;
                    }
                    requestDet.input('id_laboratorio_2', sql.Numeric(10, 0), idLab2 || 0);

                    requestDet.input('id_tipoentrega', sql.Numeric(10, 0), valNum(row.id_tipoentrega));

                    requestDet.input('res_fecha', sql.Date, new Date('1900-01-01'));

                    // FoxPro Parity: Missing DET fields
                    requestDet.input('id_transporte', sql.Numeric(10, 0), 0);
                    requestDet.input('transporte_orden', sql.VarChar(20), '');
                    requestDet.input('res_hora', sql.VarChar(10), '');
                    requestDet.input('llevatrad', sql.VarChar(1), 'N');
                    requestDet.input('trad_0', sql.VarChar(250), '');
                    requestDet.input('trad_1', sql.VarChar(250), '');


                    const queryDet = `
                        INSERT INTO App_Ma_FichaIngresoServicio_DET (
                            id_fichaingresoservicio, id_tecnica, id_normativa, id_normativareferencia, id_referenciaanalisis,
                            limitemax_d, limitemax_h, llevaerror, error_min, error_max,
                            tipo_analisis, uf_individual, item, id_laboratorioensayo, id_laboratorioensayo_2, id_tipoentrega,
                            id_transporte, transporte_orden, resultado_fecha, resultado_hora,
                            llevatraduccion, traduccion_0, traduccion_1,
                            estado, cumplimiento, cumplimiento_app
                        ) VALUES (
                            @id_ficha, @id_tecnica, @id_normativa, @id_normativareferencia, @id_referenciaanalisis,
                            @limitemax_d, @limitemax_h, @llevaerror, @error_min, @error_max,
                            @tipo_analisis, @uf, @item, @id_laboratorio, @id_laboratorio_2, @id_tipoentrega,
                            @id_transporte, @transporte_orden, @res_fecha, @res_hora,
                            @llevatrad, @trad_0, @trad_1,
                            '', '', ''
                        )
                    `;
                    await requestDet.query(queryDet);
                    itemCounter++;
                }
            }

            // 4. Insertar Agenda (MUESTREOS)
            const totalServicios = valNum(ant.totalServicios) || 1;
            const frecuencia = valNum(ant.frecuencia) || 1;
            const factor = valNum(ant.factor) || 1;

            logger.debug(`Inspector ID received: ${ant.selectedInspector}`);

            let idFrecuencia = valNum(ant.periodo);
            if (!idFrecuencia && ant.periodo && typeof ant.periodo === 'string' && ant.periodo.startsWith('freq-')) {
                idFrecuencia = Number(ant.periodo.replace('freq-', ''));
            }
            logger.info(`Insertando agenda para ${totalServicios} servicios...`);

            for (let i = 1; i <= totalServicios; i++) {
                const requestAgenda = new sql.Request(transaction);
                requestAgenda.input('id_ficha', sql.Numeric(10, 0), newId);
                requestAgenda.input('id_inspector', sql.Numeric(10, 0), valNum(ant.selectedInspector));
                requestAgenda.input('frecu', sql.Numeric(10, 0), frecuencia);
                requestAgenda.input('id_frecu', sql.Numeric(10, 0), idFrecuencia);

                requestAgenda.input('def_date', sql.Date, new Date('1900-01-01'));
                requestAgenda.input('calc_factor', sql.Numeric(10, 0), factor);
                requestAgenda.input('total_serv', sql.Numeric(10, 0), totalServicios);
                requestAgenda.input('dummy_corr', sql.VarChar(50), 'PorAsignarCorrelativo');

                const queryAgenda = `
                    INSERT INTO App_Ma_Agenda_MUESTREOS (
                        id_fichaingresoservicio, id_inspectorambiental, fecha_muestreo, frecuencia, frecuencia_correlativo, id_frecuencia,
                        id_caso, caso_adlab, estado_caso, id_coordinador, id_muestreador, id_supervisor,
                        dia, mes, ano, id_estadomuestreo, totalizador_inicio, totalizador_final, vdd,
                        calculo_horas, frecuencia_factor, total_servicios,
                        fecha_coordinador, fecha_muestreador, fechaderivado, ma_muestreo_fechai, ma_muestreo_fechat, ma_fecha_compuesta, muestreador_fechai, muestreador_fechat
                    ) VALUES (
                        @id_ficha, @id_inspector, NULL, @frecu, @dummy_corr, @id_frecu,
                        9999999998, '', '', 0, 0, 0,
                        0, 0, 0, 0, 0.00, 0.00, 0.00,
                        0.00, @calc_factor, @total_serv,
                        @def_date, @def_date, @def_date, @def_date, @def_date, @def_date, @def_date, @def_date
                    )
                `;
                // Added dates defaulting to 1900-01-01 to avoid NULL if table doesn't allow it or for consistency
                await requestAgenda.query(queryAgenda);
            }

            // 5. Asignar Correlativos (SP)
            logger.info('Ejecutando SP Asignar Correlativos...');
            const requestCorr = new sql.Request(transaction);
            requestCorr.input('xNumeroFichaIngresoServicio', sql.Numeric(10, 0), newId);

            const spResult = await requestCorr.query('EXEC Consulta_App_Agenda_AsignarCorrelativo @xNumeroFichaIngresoServicio');

            if (spResult.recordset && spResult.recordset.length > 0) {
                let correlativoCounter = 1;
                for (const row of spResult.recordset) {
                    const idAgenda = row.id_agendamam;
                    const nuevoCorrelativo = `${newId}-${correlativoCounter}-Pendiente-${idAgenda}`;

                    const requestUpdateCorr = new sql.Request(transaction);
                    requestUpdateCorr.input('corr', sql.VarChar(50), nuevoCorrelativo);
                    requestUpdateCorr.input('id_ag', sql.Numeric(10, 0), idAgenda);
                    requestUpdateCorr.input('id_fi', sql.Numeric(10, 0), newId);

                    await requestUpdateCorr.query('UPDATE App_Ma_Agenda_MUESTREOS SET frecuencia_correlativo = @corr WHERE id_agendamam = @id_ag AND id_fichaingresoservicio = @id_fi');
                    correlativoCounter++;
                }
            }

            // 6. Auditoria (SP)
            logger.info('Registrando Auditoría...');
            const requestAudit = new sql.Request(transaction);
            requestAudit.input('id_ref', sql.Numeric(10, 0), newId);
            requestAudit.input('ref', sql.VarChar(50), 'Ficha Comercial');
            requestAudit.input('campo', sql.VarChar(50), 'EstadoFicha');
            requestAudit.input('orig', sql.VarChar(50), ' ');
            requestAudit.input('tipo', sql.VarChar(50), 'JComercial');
            requestAudit.input('nval', sql.VarChar(50), 'NUEVA');
            requestAudit.input('mot', sql.VarChar(50), 'Nueva Ficha Comercial');
            requestAudit.input('usu', sql.Numeric(10, 0), userId);
            // Reuse standard 8-char HH:mm:ss string to avoid length errors
            requestAudit.input('hr', sql.VarChar(20), horaStr);
            requestAudit.input('fec', sql.VarChar(10), fechaHoy.toLocaleDateString('es-CL'));

            await requestAudit.query(`
                EXEC actualiza_auditoria @id_ref, @ref, @campo, @orig, @tipo, @nval, @mot, @usu, @hr, @fec
            `);

            await transaction.commit();

            logger.info(`Ficha creada exitosamente: ${newId}`);
            return { success: true, id: newId, message: 'Ficha creada exitosamente' };

        } catch (error) {
            console.error('CRITICAL TRANSACTION ERROR:', error);
            // We need to check if transaction is still active before rollback to avoid "Transaction has been aborted" error masking the real error
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                logger.error('Error rolling back transaction (it might have been aborted already):', rollbackError);
            }
            logger.error('Error creating ficha (Original Error):', error);
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
            logger.info(`Ficha ID ${id} Encabezado retrieved. Obs: ${ficha.observaciones_comercial}`);

            // 2. Get Agenda (MUESTREOS) using legacy SP
            const requestAgenda = pool.request();
            requestAgenda.input('xunafichacomercial', sql.Numeric(10, 0), id);
            const resultAgenda = await requestAgenda.execute('MAM_FichaComercial_ConsultaComercial_Agenda_MUESTREOS_unaficha');
            ficha.agenda = resultAgenda.recordset[0] || {};
            logger.info(`Ficha ID ${id} Agenda retrieved. Inspector: ${ficha.agenda.nombre_inspector}`);

            // 3. Get Detalle (DET) using legacy SP
            const requestDet = pool.request();
            requestDet.input('xunafichacomercial', sql.Numeric(10, 0), id);
            const resultDet = await requestDet.execute('MAM_FichaComercial_ConsultaComercial_DET_unaficha');
            ficha.detalles = resultDet.recordset || [];

            ficha.detalles = resultDet.recordset || [];

            logger.info(`Ficha ID ${id} Detalles retrieved. Count: ${ficha.detalles.length}`);

            return ficha;

        } catch (error) {
            logger.error('Error in getFichaById using SPs:', error);
            throw error;
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
            // 1 = Aprobada (Val Technique)
            await request.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET id_validaciontecnica = 1, observaciones_jefaturatecnica = @obs WHERE id_fichaingresoservicio = @id");

            // Audit logic would go here

            await transaction.commit();
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
            await transaction.commit();
            return { success: true, message: 'Ficha rechazada' };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }


    async approveCoordinacion(id, { observaciones }, user) {
        // Logic for 'Aprobar Coordinación' -> usually implies check ok for assignment
        // For now simple status update or log
        const pool = await getConnection();
        const request = pool.request();
        request.input('id', sql.Numeric(10, 0), id);
        request.input('obs', sql.VarChar(250), observaciones);
        // Maybe update obs_coordinador
        await request.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET observaciones_coordinador = @obs WHERE id_fichaingresoservicio = @id");
        return { success: true };
    }

    async reviewCoordinacion(id, { observaciones }, user) {
        // 'Enviar a Revisión' logic
        const pool = await getConnection();
        const request = pool.request();
        request.input('id', sql.Numeric(10, 0), id);
        request.input('obs', sql.VarChar(250), observaciones);
        // Reset validacion tecnica?
        await request.query("UPDATE App_Ma_FichaIngresoServicio_ENC SET id_validaciontecnica = 3, observaciones_coordinador = @obs WHERE id_fichaingresoservicio = @id");
        return { success: true };
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
            // Updated to use the correct Stored Procedure from FoxPro
            const result = await pool.request().execute('MAM_FichaComercial_ConsultaCoordinador');
            return result.recordset;
        } catch (error) {
            logger.warn('SP MAM_FichaComercial_ConsultaCoordinador failed, falling back to manual query', error);
            // Fallback logic matches the SP intent: Approved technically + Pending assignment
            const resultFallback = await pool.request().query(`
                SELECT DISTINCT
                    f.id_fichaingresoservicio as id,
                    f.fichaingresoservicio as correlativo,
                    e.nombre_empresa as cliente,
                    c.nombre_centro as centro,
                    f.fecha_fichacomercial as fecha,
                    f.estado_ficha as estado,
                    sa.nombre_subarea as subarea
                FROM App_Ma_FichaIngresoServicio_ENC f
                INNER JOIN App_Ma_Agenda_MUESTREOS a ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
                LEFT JOIN mae_empresa e ON f.id_empresa = e.id_empresa
                LEFT JOIN mae_centro c ON f.id_centro = c.id_centro
                LEFT JOIN mae_subarea sa ON f.id_subarea = sa.id_subarea
                WHERE f.id_validaciontecnica = 1
                  AND a.id_estadomuestreo = 1
                ORDER BY f.id_fichaingresoservicio DESC
            `);
            return resultFallback.recordset;
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

            logger.info(`SP executed for ficha ${id}, recordset length: ${result.recordset ? result.recordset.length : 'null/undefined'}`);


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
    async batchUpdateAgenda(data, user) {
        const { assignments } = data;

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

                await updateRequest.query(`
                    UPDATE App_Ma_Agenda_MUESTREOS 
                    SET fecha_muestreo = @fecha,
                        dia = @dia,
                        mes = @mes,
                        ano = @ano,
                        id_muestreador = @idMuestreadorInstalacion,
                        id_muestreador2 = @idMuestreadorRetiro,
                        id_estadomuestreo = @idEstadoMuestreo,
                        id_coordinador = @idCoordinador
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
                            INSERT INTO App_Ma_Resultados (
                                id_fichaingresoservicio, frecuencia_correlativo, id_muestreador,
                                id_tecnica, id_normativa, id_normativareferencia, id_referenciaanalisis,
                                limitemax_d, limitemax_h, llevaerror, error_min, error_max,
                                tipo_analisis, uf_individual, estado, cumplimiento, cumplimiento_app,
                                item, id_laboratorioensayo, id_tipoentrega, id_transporte,
                                transporte_orden, resultado_fecha, resultado_hora, llevatraduccion,
                                traduccion_0, traduccion_1
                            ) VALUES (
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
                            INSERT INTO App_Ma_Equipos_MUESTREOS (
                                id_fichaingresoservicio, frecuencia_correlativo, id_equipo,
                                tienefc, error0, error15, error30, id_muestreador,
                                seleccionado, usado_instalacion, usado_retiro
                            ) VALUES (
                                @idFicha, @correlativo, @idEquipo,
                                @tieneFC, @error0, @error15, @error30, @idMuestreador,
                                @seleccionado, @usadoInstalacion, @usadoRetiro
                            )
                        `);
                    }
                }

                successCount++;
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
