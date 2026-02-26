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

    // --- DASHBOARD ---
    getDashboardStats: async () => {
        try {
            const pool = await getConnection();

            // 1. Solicitudes Pendientes (Totales y Desglosadas)
            const pdRq = pool.request();
            const pdResult = await pdRq.query(`
                SELECT 
                    SUM(CASE WHEN estado IN ('PENDIENTE', 'PENDIENTE_CALIDAD', 'PENDIENTE_TECNICA', 'EN_REVISION_TECNICA') THEN 1 ELSE 0 END) as pendientesTotales,
                    SUM(CASE WHEN estado = 'PENDIENTE_CALIDAD' THEN 1 ELSE 0 END) as pendientesCalidad,
                    SUM(CASE WHEN estado IN ('PENDIENTE_TECNICA', 'EN_REVISION_TECNICA') THEN 1 ELSE 0 END) as pendientesTecnica
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
                WHERE estado_caso != 'ANULADA' 
                AND CAST(fecha_muestreo as DATE) = CAST(GETDATE() as DATE)
            `);
            const muestrasHoy = mhResult.recordset[0].count;

            // 3. Informes por Validar (Using REVISION requests as proxy)
            const ivRq = pool.request();
            const ivResult = await ivRq.query(`
                SELECT count(*) as count 
                FROM mae_solicitud_equipo 
                WHERE tipo_solicitud = 'REVISION' 
                AND estado IN ('PENDIENTE', 'PENDIENTE_TECNICA', 'PENDIENTE_CALIDAD', 'EN_REVISION_TECNICA')
            `);
            const informesPorValidar = ivResult.recordset[0].count;

            return {
                pendientes,
                pendientesCalidad,
                pendientesTecnica,
                muestrasHoy,
                informesPorValidar
            };
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            throw error;
        }
    }
};

export default adminService;
