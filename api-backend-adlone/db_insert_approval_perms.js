import { getConnection, closeConnection } from './src/config/database.js';

async function addApprovalPermissions() {
    try {
        const pool = await getConnection();

        // First, check if they already exist
        const checkResult = await pool.request().query(`
            SELECT * FROM mae_permiso 
            WHERE codigo IN ('GC_ACEPTAR_SOLICITUD', 'GC_RECHAZAR_SOLICITUD')
        `);

        if (checkResult.recordset.length > 0) {
            console.log('Permissions already exist:', checkResult.recordset);
        } else {
            console.log('Permissions not found, inserting...');
            // Insert both permissions
            const insertResult = await pool.request().query(`
                INSERT INTO mae_permiso (nombre, codigo, modulo, submodulo)
                VALUES 
                ('Aceptar Solicitudes Equipo', 'GC_ACEPTAR_SOLICITUD', 'Gestión de Calidad', 'GC - Equipos'),
                ('Rechazar Solicitudes Equipo', 'GC_RECHAZAR_SOLICITUD', 'Gestión de Calidad', 'GC - Equipos')
            `);

            console.log('Insert result rows affected:', insertResult.rowsAffected);
        }

        // Verify final state
        const verifyResult = await pool.request().query(`
            SELECT id_permiso, nombre, codigo, modulo, submodulo FROM mae_permiso 
            WHERE codigo IN ('GC_ACEPTAR_SOLICITUD', 'GC_RECHAZAR_SOLICITUD')
        `);
        console.log('Final Permissions State:', verifyResult.recordset);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await closeConnection();
        console.log('Connection closed');
    }
}

addApprovalPermissions();
