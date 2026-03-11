import mssql from 'mssql';
import { getConnection } from '../src/config/database.js';

async function seedTestTimeline() {
    try {
        const pool = await getConnection();

        console.log('Fetching a recent request to seed history for...');
        // Find a recent request
        const requestRes = await pool.request().query('SELECT TOP 1 id_solicitud, estado FROM mae_solicitud_equipo ORDER BY id_solicitud DESC');

        if (requestRes.recordset.length === 0) {
            console.log('No requests found.');
            process.exit(0);
        }

        const solicitudId = requestRes.recordset[0].id_solicitud;
        const currentState = requestRes.recordset[0].estado;

        console.log(`Seeding history for Request ID: ${solicitudId} (Current State: ${currentState})`);

        // Add a fake creation log
        await pool.request()
            .input('id_solicitud', mssql.Int, solicitudId)
            .input('accion', mssql.VarChar, 'CREACION_SISTEMA')
            .input('observacion', mssql.VarChar, 'Solicitud ingresada al sistema (seeded)')
            .input('id_usuario', mssql.Int, 1) // Assuming admin user ID is 1
            .input('estado_anterior', mssql.VarChar, null)
            .input('estado_nuevo', mssql.VarChar, 'PENDIENTE_TECNICA')
            .query(`
                INSERT INTO mae_solicitud_historial 
                (id_solicitud, accion, observacion, id_usuario, estado_anterior, estado_nuevo)
                VALUES (@id_solicitud, @accion, @observacion, @id_usuario, @estado_anterior, @estado_nuevo)
            `);

        console.log('Inserted creation log.');

        // Add a fake action log
        await pool.request()
            .input('id_solicitud', mssql.Int, solicitudId)
            .input('accion', mssql.VarChar, 'REVISION_TECNICA')
            .input('observacion', mssql.VarChar, 'Revisión técnica completada, derivado a calidad (seeded)')
            .input('id_usuario', mssql.Int, 1)
            .input('estado_anterior', mssql.VarChar, 'PENDIENTE_TECNICA')
            .input('estado_nuevo', mssql.VarChar, 'PENDIENTE_CALIDAD')
            .query(`
                INSERT INTO mae_solicitud_historial 
                (id_solicitud, accion, observacion, id_usuario, estado_anterior, estado_nuevo)
                VALUES (@id_solicitud, @accion, @observacion, @id_usuario, @estado_anterior, @estado_nuevo)
            `);

        console.log('Inserted technical review log.');

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

seedTestTimeline();
