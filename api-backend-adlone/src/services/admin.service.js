import { getConnection } from '../config/database.js';
import sql from 'mssql';
import fichaService from './ficha.service.js';
import PDFDocument from 'pdfkit-table';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

// Helper to execute Stored Procedures
const callSP = async (spName, params = {}) => {
    try {
        const pool = await getConnection();
        const request = pool.request();

        // Add inputs
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }

        const result = await request.execute(spName);
        return result.recordset || result.recordsets[0] || []; // Return first recordset default
    } catch (error) {
        console.error(`Error executing SP ${spName}:`, error);
        throw error;
    }
};

export const adminService = {
    // --- MUESTREADORES ---

    getMuestreadores: async (nombre, estado) => {
        // SP: MAM_Admin_Muestreadores_List @Nombre, @Estado
        return await callSP('MAM_Admin_Muestreadores_List', {
            Nombre: nombre || null,
            Estado: estado || 'ACTIVOS'
        });
    },

    createMuestreador: async (data) => {
        // SP: MAM_Admin_Muestreador_Create @Nombre, @Correo, @Clave, @Firma
        const result = await callSP('MAM_Admin_Muestreador_Create', {
            Nombre: data.nombre,
            Correo: data.correo,
            Clave: data.clave,
            Firma: data.firma // Base64 or URL
        });
        return result[0]; // Returns { id_muestreador }
    },

    updateMuestreador: async (id, data) => {
        // SP: MAM_Admin_Muestreador_Update @Id, @Nombre, @Correo, @Clave, @Firma
        await callSP('MAM_Admin_Muestreador_Update', {
            Id: id,
            Nombre: data.nombre,
            Correo: data.correo,
            Clave: data.clave,
            Firma: data.firma
        });
        return { success: true };
    },

    disableMuestreador: async (id) => {
        // SP: MAM_Admin_Muestreador_Disable @Id
        await callSP('MAM_Admin_Muestreador_Disable', { Id: id });
        return { success: true };
    },

    enableMuestreador: async (id) => {
        const pool = await getConnection();
        const request = pool.request();
        request.input('id', sql.Numeric(10, 0), id);
        await request.query("UPDATE mae_muestreador SET habilitado = 'S' WHERE id_muestreador = @id");
        return { success: true };
    },

    checkDuplicateMuestreador: async (nombre, correo) => {
        const pool = await getConnection();
        const request = pool.request();
        request.input('nombre', sql.VarChar(200), nombre);
        request.input('correo', sql.VarChar(200), correo);
        const result = await request.query(`
            SELECT id_muestreador, nombre_muestreador, correo_electronico, habilitado
            FROM mae_muestreador 
            WHERE nombre_muestreador = @nombre OR correo_electronico = @correo
        `);
        return result.recordset;
    },

    // --- DASHBOARD ---
    getDashboardStats: async () => {
        try {
            const pool = await getConnection();

            // 1. Solicitudes Pendientes (Totales y Desglosadas)
            const pdRq = pool.request();
            const pdResult = await pdRq.query(`
                SELECT 
                    SUM(CASE WHEN 
                        estado IN ('PENDIENTE', 'PENDIENTE_CALIDAD', 'PENDIENTE_TECNICA', 'EN_REVISION_TECNICA') 
                        OR (estado = 'APROBADO' AND estado_tecnica = 'PENDIENTE')
                    THEN 1 ELSE 0 END) as pendientesTotales,
                    SUM(CASE WHEN estado = 'PENDIENTE_CALIDAD' THEN 1 ELSE 0 END) as pendientesCalidad,
                    SUM(CASE WHEN 
                        estado IN ('PENDIENTE_TECNICA', 'EN_REVISION_TECNICA') 
                        OR (estado = 'APROBADO' AND estado_tecnica = 'PENDIENTE')
                    THEN 1 ELSE 0 END) as pendientesTecnica
                FROM mae_solicitud_equipo 
            `);
            const pendientes = pdResult.recordset[0].pendientesTotales || 0;
            const pendientesCalidad = pdResult.recordset[0].pendientesCalidad || 0;
            const pendientesTecnica = pdResult.recordset[0].pendientesTecnica || 0;

            // 2. Muestras Hoy
            const mhRq = pool.request();
            const mhResult = await mhRq.query(`
                SELECT count(*) as count 
                FROM App_Ma_Agenda_MUESTREOS 
                WHERE estado_caso != 'CANCELADO' 
                AND estado_caso != 'ANULADA' 
                AND CAST(fecha_muestreo as DATE) = CAST(GETDATE() as DATE)
            `);
            const muestrasHoy = mhResult.recordset[0].count;

            // 3. Informes por Realizar (Using REVISION requests as proxy)
            const ivRq = pool.request();
            const ivResult = await ivRq.query(`
                SELECT count(*) as count 
                FROM mae_solicitud_equipo 
                WHERE tipo_solicitud = 'REVISION' 
                AND estado IN ('PENDIENTE', 'PENDIENTE_TECNICA', 'PENDIENTE_CALIDAD', 'EN_REVISION_TECNICA')
            `);
            const informesPorRealizar = ivResult.recordset[0].count;

            // 4. Informes Realizados (Using REVISION requests APROBADO)
            const irRq = pool.request();
            const irResult = await irRq.query(`
                SELECT count(*) as count 
                FROM mae_solicitud_equipo 
                WHERE tipo_solicitud = 'REVISION' 
                AND estado = 'APROBADO'
            `);
            const informesRealizados = irResult.recordset[0].count;

            // 5. Equipos Activos e Inactivos
            const eqRq = pool.request();
            const eqResult = await eqRq.query(`
                SELECT 
                    SUM(CASE WHEN habilitado = 'S' THEN 1 ELSE 0 END) as activos,
                    SUM(CASE WHEN habilitado != 'S' OR habilitado IS NULL THEN 1 ELSE 0 END) as inactivos
                FROM mae_equipo
            `);
            const equiposActivos = eqResult.recordset[0].activos || 0;
            const equiposInactivos = eqResult.recordset[0].inactivos || 0;

            // 5b. Fichas Comerciales (Real operational data)
            const fcRq = pool.request();
            const fcResult = await fcRq.query(`
                SELECT 
                    SUM(CASE WHEN id_validaciontecnica IN (1, 3, 6) THEN 1 ELSE 0 END) as fichasPendientes,
                    SUM(CASE WHEN id_validaciontecnica = 5 THEN 1 ELSE 0 END) as fichasEnProceso,
                    COUNT(*) as totalFichas
                FROM App_Ma_FichaIngresoServicio_ENC
            `);
            const fichasPendientes = fcResult.recordset[0].fichasPendientes || 0;
            const fichasEnProceso = fcResult.recordset[0].fichasEnProceso || 0;
            const totalFichas = fcResult.recordset[0].totalFichas || 0;

            // 5c. Resumen de Agenda (Muestreos)
            const agRq = pool.request();
            const agResult = await agRq.query(`
                SELECT 
                    SUM(CASE WHEN estado_caso IS NULL OR estado_caso = '' THEN 1 ELSE 0 END) as muestreosPendientes,
                    SUM(CASE WHEN estado_caso = 'RETIRO' THEN 1 ELSE 0 END) as muestreosRetiro,
                    COUNT(*) as totalMuestreos
                FROM App_Ma_Agenda_MUESTREOS
                WHERE (estado_caso != 'CANCELADO' OR estado_caso IS NULL)
            `);
            const muestreosPendientes = agResult.recordset[0].muestreosPendientes || 0;
            const muestreosRetiro = agResult.recordset[0].muestreosRetiro || 0;
            const totalMuestreos = agResult.recordset[0].totalMuestreos || 0;

            // 5d. Metricas de Solicitudes Mensuales (GC)
            const msRq = pool.request();
            const msResult = await msRq.query(`
                SELECT 
                    SUM(CASE WHEN estado = 'APROBADO' AND MONTH(fecha_aprobacion) = MONTH(GETDATE()) AND YEAR(fecha_aprobacion) = YEAR(GETDATE()) THEN 1 ELSE 0 END) as aprobadasMes,
                    SUM(CASE WHEN estado = 'RECHAZADA' AND MONTH(fecha_revision) = MONTH(GETDATE()) AND YEAR(fecha_revision) = YEAR(GETDATE()) THEN 1 ELSE 0 END) as rechazadasMes
                FROM mae_solicitud_equipo
            `);
            const aprobadasMes = msResult.recordset[0].aprobadasMes || 0;
            const rechazadasMes = msResult.recordset[0].rechazadasMes || 0;

            // 5e. Equipos Vencidos (GC)
            const evcRq = pool.request();
            const evcResult = await evcRq.query(`
                SELECT COUNT(*) as count 
                FROM mae_equipo 
                WHERE habilitado = 'S' 
                AND fecha_vigencia < CAST(GETDATE() as DATE)
            `);
            const equiposVencidos = evcResult.recordset[0].count || 0;

            // 5f. Usuarios Totales (Informatica)
            const usRq = pool.request();
            const usResult = await usRq.query(`
                SELECT COUNT(*) as count 
                FROM mae_usuario 
                WHERE habilitado = 'S'
            `);
            const totalUsuarios = usResult.recordset[0].count || 0;

            // 6. Data for Charts: Solicitudes por Tipo
            const stRq = pool.request();
            const stResult = await stRq.query(`
                SELECT tipo_solicitud as name, count(*) as value 
                FROM mae_solicitud_equipo 
                GROUP BY tipo_solicitud
            `);
            const solicitudesPorTipo = stResult.recordset;

            // 7. Data for Charts: Evolución Solicitudes (Últimos 7 días)
            const evRq = pool.request();
            const evResult = await evRq.query(`
                SELECT CAST(fecha_solicitud as DATE) as name, count(*) as value 
                FROM mae_solicitud_equipo 
                WHERE fecha_solicitud >= DATEADD(day, -7, GETDATE())
                GROUP BY CAST(fecha_solicitud as DATE)
                ORDER BY name
            `);
            const evolucionSolicitudes = evResult.recordset;

            // 8. Data for Charts: Equipos por Tipo
            const etRq = pool.request();
            const etResult = await etRq.query(`
                SELECT ISNULL(tipoequipo, 'Sin Tipo') as name, count(*) as value 
                FROM mae_equipo 
                GROUP BY tipoequipo
            `);
            const equiposPorTipo = etResult.recordset;

            // 9. Data for Charts: Actividad Muestreo (Escala Mensual)
            const amRq = pool.request();
            const amResult = await amRq.query(`
                SELECT MONTH(fecha_muestreo) as name, count(*) as value
                FROM App_Ma_Agenda_MUESTREOS
                WHERE YEAR(fecha_muestreo) = YEAR(GETDATE())
                GROUP BY MONTH(fecha_muestreo)
                ORDER BY name
            `);
            const actividadMuestreo = amResult.recordset;

            return {
                pendientes,
                pendientesCalidad,
                pendientesTecnica,
                muestrasHoy,
                informesPorRealizar,
                informesRealizados,
                equiposActivos,
                equiposInactivos,
                fichasPendientes,
                fichasEnProceso,
                totalFichas,
                muestreosPendientes,
                muestreosRetiro,
                totalMuestreos,
                aprobadasMes,
                rechazadasMes,
                equiposVencidos,
                totalUsuarios,
                charts: {
                    solicitudesPorTipo,
                    evolucionSolicitudes,
                    equiposPorTipo,
                    actividadMuestreo
                }
            };
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            throw error;
        }
    },

    // --- CALENDARIO REPLICA ---
    getCalendario: async (mes, ano) => {
        try {
            const pool = await getConnection();
            const request = pool.request();

            let query = `
                SELECT 
                    a.id_agendamam,
                    a.fecha_muestreo,
                    a.dia, a.mes, a.ano,
                    a.frecuencia,
                    a.id_fichaingresoservicio,
                    a.id_estadomuestreo,
                    f.id_empresa,
                    e.nombre_empresa,
                    f.id_fuenteemisora,
                    fe.nombre_fuenteemisora,
                    fm.nombre_fuenteemisora as nombre_fuenteemisora_ma,
                    obj.nombre_objetivomuestreo_ma,
                    sec.nombre_sector
                FROM App_Ma_Agenda_MUESTREOS a
                LEFT JOIN App_Ma_FichaIngresoServicio_ENC f ON a.id_fichaingresoservicio = f.id_fichaingresoservicio
                LEFT JOIN mae_empresa e ON f.id_empresa = e.id_empresa
                LEFT JOIN mae_fuenteemisora fe ON f.id_fuenteemisora = fe.id_fuenteemisora
                LEFT JOIN mae_fuenteemisora_ma fm ON f.id_fuenteemisora = fm.id_fuenteemisora
                LEFT JOIN mae_objetivomuestreo_ma obj ON f.id_objetivomuestreo_ma = obj.id_objetivomuestreo_ma
                LEFT JOIN mae_sector sec ON f.id_sector = sec.id_sector
                WHERE (a.estado_caso IS NULL OR (a.estado_caso != 'CANCELADO' AND a.estado_caso != 'ANULADA'))
            `;

            if (mes) {
                request.input('mes', sql.Int, mes);
                query += ' AND a.mes = @mes';
            }
            if (ano) {
                request.input('ano', sql.Int, ano);
                query += ' AND a.ano = @ano';
            }

            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching calendario data:', error);
            throw error;
        }
    },

    // --- EXPORT DATA ---
    getTableData: async (name, type = 'TABLE', params = {}) => {
        const allowedTables = [
            'mae_empresaservicios',
            'mae_empresa',
            'mae_cargo',
            'mae_muestreador',
            'mae_instrumentoambiental',
            'mae_umedida',
            'mae_estadomuestreo',
            'App_Ma_FichaIngresoServicio_ENC',
            'mae_zonageografica',
            'mae_equipo',
            'mae_equipo_historial',
            'mae_solicitud_equipo'
        ];

        const allowedSPs = [
            'maestro_lugaranalisis',
            'consulta_contacto_una_empresa',
            'consulta_centro',
            'consulta_objetivomuestreo_ma_oservicios',
            'consulta_tipomuestra_medioambiente',
            'consulta_subarea_medioambiente',
            'consulta_inspectorambiental',
            'consulta_tipomuestreo_medio_ambiente',
            'consulta_tipomuestra_ma',
            'consulta_mae_actividadmuestreo',
            'consulta_mae_tipodescarga',
            'Consulta_Mae_Modalidad',
            'Consulta_Frecuencia_Periodo',
            'Consulta_Mae_Formacanal',
            'Consulta_Mae_Dispositivohidraulico',
            'Consulta_App_Ma_Normativa',
            'Consulta_App_Ma_NormativaReferencia',
            'Consulta_App_Ma_ReferenciaAnalisis',
            'consulta_laboratorioensayo',
            'Maestro_Tipoentrega'
        ];

        try {
            if (type === 'TABLE') {
                if (!allowedTables.includes(name)) {
                    throw new Error(`Acceso no autorizado a la tabla: ${name}`);
                }
                const pool = await getConnection();

                if (name === 'App_Ma_FichaIngresoServicio_ENC') {
                    const query = `
                        SELECT 
                            e.id_fichaingresoservicio as [ID Ficha],
                            e.tipo_fichaingresoservicio as [Tipo Monitoreo],
                            e.fecha_fichacomercial as [Fecha Creación],
                            cli.nombre_empresa as [Cliente],
                            cen.nombre_centro as [Centro],
                            la.nombre_lugaranalisis as [Lugar Análisis],
                            es.nombre_empresaservicios as [Empresa Servicio],
                            sub.nombre_subarea as [Sub-área],
                            tm.nombre_tipomuestra_ma as [Tipo Muestra],
                            e.ma_coordenadas as [Coordenadas],
                            e.ma_punto_muestreo as [Punto Muestreo],
                            e.instrumento_ambiental as [Instrumento Ambiental],
                            ag.frecuencia as [Frecuencia Valor],
                            nor.nombre_normativa as [Normativa],
                            nref.nombre_normativareferencia as [Referencia],
                            d.tipo_analisis as [Tipo Análisis],
                            d.uf_individual as [UF Individual]
                        FROM App_Ma_FichaIngresoServicio_ENC e
                        LEFT JOIN App_Ma_FichaIngresoServicio_DET d ON e.id_fichaingresoservicio = d.id_fichaingresoservicio AND d.activo = 1
                        LEFT JOIN mae_empresa cli ON e.id_empresa = cli.id_empresa
                        LEFT JOIN mae_centro cen ON e.id_centro = cen.id_centro
                        LEFT JOIN mae_lugaranalisis la ON e.id_lugaranalisis = la.id_lugaranalisis
                        LEFT JOIN mae_empresaservicios es ON e.id_empresaservicio = es.id_empresaservicio
                        LEFT JOIN mae_subarea sub ON e.id_subarea = sub.id_subarea
                        LEFT JOIN mae_tipomuestra_ma tm ON e.id_tipomuestra_ma = tm.id_tipomuestra_ma
                        LEFT JOIN mae_normativa nor ON d.id_normativa = nor.id_normativa
                        LEFT JOIN mae_normativareferencia nref ON d.id_normativareferencia = nref.id_normativareferencia
                        OUTER APPLY (
                            SELECT TOP 1 frecuencia 
                            FROM App_Ma_Agenda_MUESTREOS 
                            WHERE id_fichaingresoservicio = e.id_fichaingresoservicio
                        ) ag
                        WHERE 1=1
                    `;

                    const request = pool.request();
                    let filterQuery = '';

                    if (params.ficha) {
                        filterQuery += ' AND e.id_fichaingresoservicio = @ficha';
                        request.input('ficha', sql.Int, params.ficha);
                    }
                    if (params.estado) {
                        filterQuery += ' AND e.estado_ficha = @estado';
                        request.input('estado', sql.VarChar, params.estado);
                    }
                    if (params.fechaDesde) {
                        filterQuery += ' AND e.fecha_fichacomercial >= @fechaDesde';
                        request.input('fechaDesde', sql.Date, params.fechaDesde);
                    }
                    if (params.fechaHasta) {
                        filterQuery += ' AND e.fecha_fichacomercial <= @fechaHasta';
                        request.input('fechaHasta', sql.Date, params.fechaHasta);
                    }
                    if (params.tipo) {
                        filterQuery += ' AND e.tipo_fichaingresoservicio = @tipo';
                        request.input('tipo', sql.VarChar, params.tipo);
                    }
                    if (params.empresaFacturar) {
                        filterQuery += ' AND cli.nombre_empresa = @empresaFacturar';
                        request.input('empresaFacturar', sql.VarChar, params.empresaFacturar);
                    }
                    if (params.empresaServicio) {
                        filterQuery += ' AND es.nombre_empresaservicios = @empresaServicio';
                        request.input('empresaServicio', sql.VarChar, params.empresaServicio);
                    }
                    if (params.centro) {
                        filterQuery += ' AND cen.nombre_centro = @centro';
                        request.input('centro', sql.VarChar, params.centro);
                    }
                    if (params.objetivo) {
                        filterQuery += ' AND e.ma_objetivo_muestreo = @objetivo';
                        request.input('objetivo', sql.VarChar, params.objetivo);
                    }
                    if (params.subArea) {
                        filterQuery += ' AND sub.nombre_subarea = @subArea';
                        request.input('subArea', sql.VarChar, params.subArea);
                    }

                    const finalQuery = query + filterQuery + ' ORDER BY e.id_fichaingresoservicio DESC, d.item ASC';
                    const result = await request.query(finalQuery);
                    return result.recordset;
                }

                if (name === 'mae_equipo') {
                    const query = `
                        SELECT 
                            e.id_equipo as [ID],
                            e.codigo as [Código],
                            e.nombre as [Nombre Equipo],
                            e.tipoequipo as [Categoría],
                            e.sede as [Ubicación],
                            FORMAT(e.fecha_vigencia, 'dd/MM/yyyy') as [Vigencia],
                            m.nombre_muestreador as [Responsable],
                            CASE WHEN e.habilitado = 'S' THEN 'Activo' ELSE 'Inactivo' END as [Estado],
                            e.sigla as [Sigla],
                            e.correlativo as [Número],
                            CASE WHEN e.tienefc = 'S' THEN 'SI' ELSE 'NO' END as [Tiene FC],
                            e.que_mide as [Qué Mide],
                            e.unidad_medida_textual as [Unidad],
                            e.error0 as [Error 0%],
                            e.error15 as [Error 15%],
                            e.error30 as [Error 30%],
                            e.observacion as [Observaciones],
                            e.version as [Versión]
                        FROM mae_equipo e
                        LEFT JOIN mae_muestreador m ON e.id_muestreador = m.id_muestreador
                        ORDER BY e.codigo ASC
                    `;
                    const result = await pool.request().query(query);
                    return result.recordset;
                }

                if (name === 'mae_equipo_historial') {
                    const query = `
                        SELECT 
                            h.id_equipo as [ID Equipo],
                            h.version as [Versión],
                            h.codigo as [Código],
                            h.nombre as [Nombre],
                            h.sede as [Ubicación],
                            FORMAT(h.fecha_vigencia, 'dd/MM/yyyy') as [Vigencia],
                            m.nombre_muestreador as [Responsable],
                            CASE WHEN h.habilitado = 'S' THEN 'Activo' ELSE 'Inactivo' END as [Estado],
                            h.que_mide as [Qué Mide],
                            u.nombre_usuario as [Modificado Por],
                            FORMAT(h.fecha_cambio, 'dd/MM/yyyy HH:mm') as [Fecha Cambio],
                            h.observacion as [Notas de Cambio]
                        FROM mae_equipo_historial h
                        LEFT JOIN mae_muestreador m ON h.id_muestreador = m.id_muestreador
                        LEFT JOIN mae_usuario u ON h.usuario_cambio = u.id_usuario
                        ORDER BY h.fecha_cambio DESC
                    `;
                    const result = await pool.request().query(query);
                    return result.recordset;
                }

                if (name === 'mae_solicitud_equipo') {
                    const query = `
                        SELECT 
                            s.id_solicitud as [ID Solicitud],
                            s.tipo_solicitud as [Tipo],
                            s.estado as [Estado Calidad],
                            s.estado_tecnica as [Estado Técnica],
                            FORMAT(s.fecha_solicitud, 'dd/MM/yyyy HH:mm') as [Fecha],
                            u.nombre_usuario as [Solicitante],
                            s.origen_solicitud as [Origen],
                            s.feedback_aprobacion as [Respuesta Calidad],
                            s.feedback_tecnica as [Respuesta Técnica],
                            s.datos_json as [Detalles (JSON Raw)]
                        FROM mae_solicitud_equipo s
                        LEFT JOIN mae_usuario u ON s.usuario_solicita = u.id_usuario
                        ORDER BY s.id_solicitud DESC
                    `;
                    const result = await pool.request().query(query);
                    return result.recordset;
                }

                const result = await pool.request().query(`SELECT * FROM ${name}`);
                return result.recordset;
            } else if (type === 'SP') {
                if (!allowedSPs.includes(name)) {
                    throw new Error(`Acceso no autorizado al procedimiento: ${name}`);
                }

                // Si no hay parámetros y es un SP conocido que falla sin ellos, 
                // hacemos bypass a la tabla directamente para exportación completa.
                const spToTableMap = {
                    'consulta_subarea_medioambiente': 'mae_subarea',
                    'consulta_tipomuestra_ma': 'mae_tipomuestra_ma',
                    'Consulta_App_Ma_NormativaReferencia': 'mae_normativareferencia',
                    'consulta_contacto_una_empresa': 'maestro_contacto',
                    'Consulta_App_Ma_ReferenciaAnalisis': 'mae_referenciaanalisis'
                };

                const isNoParams = !params || Object.keys(params).length === 0;

                if (isNoParams && spToTableMap[name]) {
                    const tableName = spToTableMap[name];
                    try {
                        const pool = await getConnection();
                        const result = await pool.request().query(`SELECT * FROM ${tableName}`);
                        return result.recordset;
                    } catch (tableError) {
                        console.error(`Error bypass SP ${name} to table ${tableName}:`, tableError);
                        // No lanzamos error aquí, dejaremos que intente el SP por si acaso
                    }
                }

                try {
                    return await callSP(name, params);
                } catch (spError) {
                    // Si falla el SP y habíamos intentado un bypass, lanzamos el error del bypass o del SP detallado
                    const detail = spError.message.includes('expects parameter') 
                        ? `El procedimiento ${name} requiere un ID para filtrar, pero se intentó exportación completa. Error DB: ${spError.message}`
                        : spError.message;
                    throw new Error(detail);
                }
            } else {
                throw new Error('Tipo de exportación no soportado');
            }
        } catch (error) {
            console.error(`Error fetching export data for ${name} (${type}):`, error);
            const finalMessage = error.message.includes('Acceso no autorizado') ? error.message : `Error en recurso ${name}: ${error.message}`;
            throw new Error(finalMessage);
        }
    },
    
    async getExportPdf(params) {
        try {
            // Re-use logic for App_Ma_FichaIngresoServicio_ENC but return IDs
            const pool = await getConnection();
            
            const baseQuery = `
                SELECT f.id_fichaingresoservicio
                FROM App_Ma_FichaIngresoServicio_ENC f
                LEFT JOIN mae_empresa e ON f.id_empresa = e.id_empresa
                LEFT JOIN mae_centro c ON f.id_centro = c.id_centro
                LEFT JOIN mae_empresa es ON f.id_empresaservicio = es.id_empresa
                LEFT JOIN mae_objetivomuestreo_ma om ON f.id_objetivomuestreo_ma = om.id_objetivomuestreo_ma
                LEFT JOIN mae_subarea sa ON f.id_subarea = sa.id_subarea
                LEFT JOIN mae_usuario u ON f.id_usuario = u.id_usuario
                WHERE 1=1
            `;

            const request = pool.request();
            let filterQuery = '';

            if (params.ficha) {
                filterQuery += ' AND f.id_fichaingresoservicio = @ficha';
                request.input('ficha', sql.Int, params.ficha);
            }
            if (params.estado) {
                filterQuery += ' AND f.estado_ficha = @estado';
                request.input('estado', sql.VarChar, params.estado);
            }
            if (params.fechaDesde) {
                filterQuery += ' AND f.fecha_fichacomercial >= @fechaDesde';
                request.input('fechaDesde', sql.Date, params.fechaDesde);
            }
            if (params.fechaHasta) {
                filterQuery += ' AND f.fecha_fichacomercial <= @fechaHasta';
                request.input('fechaHasta', sql.Date, params.fechaHasta);
            }
            if (params.tipo) {
                filterQuery += ' AND f.tipo_fichaingresoservicio = @tipo';
                request.input('tipo', sql.VarChar, params.tipo);
            }
            if (params.empresaFacturar) {
                filterQuery += ' AND e.nombre_empresa = @empresaFacturar';
                request.input('empresaFacturar', sql.VarChar, params.empresaFacturar);
            }
            if (params.empresaServicio) {
                filterQuery += ' AND es.nombre_empresa = @empresaServicio';
                request.input('empresaServicio', sql.VarChar, params.empresaServicio);
            }
            if (params.centro) {
                filterQuery += ' AND c.nombre_centro = @centro';
                request.input('centro', sql.VarChar, params.centro);
            }
            if (params.objetivo) {
                filterQuery += ' AND om.nombre_objetivomuestreo_ma = @objetivo';
                request.input('objetivo', sql.VarChar, params.objetivo);
            }
            if (params.subArea) {
                filterQuery += ' AND sa.nombre_subarea = @subArea';
                request.input('subArea', sql.VarChar, params.subArea);
            }
            if (params.usuario) {
                filterQuery += ' AND u.nombre_usuario = @usuario';
                request.input('usuario', sql.VarChar, params.usuario);
            }

            const finalQuery = baseQuery + filterQuery + ' ORDER BY f.id_fichaingresoservicio DESC';
            const result = await request.query(finalQuery);
            const ids = result.recordset.map(r => r.id_fichaingresoservicio);

            if (ids.length === 0) {
                throw new Error('No se encontraron fichas con los filtros seleccionados');
            }

            return await fichaService.generateBulkFichaPdfBuffer(ids);
        } catch (error) {
            console.error('Error in getExportPdf:', error);
            throw error;
        }
    },

    async generateMuestreadoresPdfBuffer(nombre, estado) {
        try {
            const muestreadores = await this.getMuestreadores(nombre, estado);
            
            return new Promise((resolve, reject) => {
                const doc = new PDFDocument({ margin: 40, size: 'A4' });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });
                doc.on('error', reject);

                // Header
                const logoPath = path.resolve(process.cwd(), '../frontend-adlone/src/assets/images/logo-adlone.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 40, 30, { width: 100 });
                }
                
                doc.font('Helvetica-Bold').fontSize(14).fillColor('#1f4e78').text('LISTADO DE MUESTREADORES', 40, 80, { align: 'center', width: 515 });
                doc.fontSize(10).fillColor('#64748b').text(`Generado el: ${new Date().toLocaleString('es-CL')}`, { align: 'center', width: 515 });
                doc.moveDown(2);

                const table = {
                    title: "Información de Personal de Muestreo",
                    headers: [
                        { label: "ID", property: 'id_muestreador', width: 40 },
                        { label: "Nombre", property: 'nombre_muestreador', width: 180 },
                        { label: "Correo Electrónico", property: 'correo_electronico', width: 180 },
                        { label: "Estado", property: 'habilitado', width: 50 },
                        { label: "Firma", property: 'tiene_firma', width: 50 }
                    ],
                    rows: muestreadores.map(m => [
                        m.id_muestreador,
                        m.nombre_muestreador,
                        m.correo_electronico || '-',
                        m.habilitado === 'S' ? 'Activo' : 'Inactivo',
                        m.firma ? 'Sí' : 'No'
                    ])
                };

                doc.table(table, {
                    width: 515,
                    prepareHeader: () => doc.font("Helvetica-Bold").fontSize(9).fillColor('black'),
                    prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                        doc.font("Helvetica").fontSize(8).fillColor('#374151');
                    }
                });

                doc.end();
            });
        } catch (error) {
            logger.error('Error generating Muestreadores PDF:', error);
            throw error;
        }
    }
};

export default adminService;
