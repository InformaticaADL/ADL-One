import LinkInfo from '../services/admin.service.js'; // Just kidding, this is the service.
import { getConnection } from '../config/database.js';
import sql from 'mssql';

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
    }
};

export default adminService;
