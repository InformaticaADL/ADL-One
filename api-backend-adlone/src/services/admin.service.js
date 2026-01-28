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
    }
};

export default adminService;
