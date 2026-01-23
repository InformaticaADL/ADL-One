import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

class FichaIngresoService {

    async getAllFichas() {
        try {
            const pool = await getConnection();
            // Execute Stored Procedure provided by user
            const result = await pool.request().execute('MAM_FichaComercial_ConsultaComercial');
            return result.recordset;
        } catch (error) {
            logger.error('Error getting all fichas (MAM_FichaComercial_ConsultaComercial):', error);
            throw error;
        }
    }

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
            requestEnc.input('id_tipomuestrama', sql.Numeric(10, 0), valNum(ant.selectedTipoMuestra));
            requestEnc.input('id_actividad', sql.Numeric(10, 0), valNum(ant.selectedActividad));
            requestEnc.input('duracion', sql.VarChar(10), valStr(ant.duracion, 10));

            requestEnc.input('ref_google', sql.VarChar(200), valStr(ant.refGoogle, 200));
            requestEnc.input('medicion_caudal', sql.VarChar(10), valStr(ant.medicionCaudal, 10));
            requestEnc.input('id_modalidad', sql.Numeric(10, 0), valNum(ant.selectedModalidad));
            requestEnc.input('id_formacanal', sql.Numeric(10, 0), valNum(ant.formaCanal));
            requestEnc.input('formacanal_medida', sql.VarChar(50), valStr(ant.detalleCanal, 50));
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
                    @id_tipomuestreo, @id_tipomuestrama, @id_actividad, @duracion,
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
                            tipo_analisis, uf_individual, item, id_laboratorioensayo, id_tipoentrega,
                            id_transporte, transporte_orden, resultado_fecha, resultado_hora,
                            llevatraduccion, traduccion_0, traduccion_1,
                            estado, cumplimiento, cumplimiento_app
                        ) VALUES (
                            @id_ficha, @id_tecnica, @id_normativa, @id_normativareferencia, @id_referenciaanalisis,
                            @limitemax_d, @limitemax_h, @llevaerror, @error_min, @error_max,
                            @tipo_analisis, @uf, @item, @id_laboratorio, @id_tipoentrega,
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
}

export default new FichaIngresoService();
