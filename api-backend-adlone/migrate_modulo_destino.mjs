import { getConnection, closeConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        console.log('--- Migrando mae_solicitud_tipo ---');
        
        // 1. Add column if not exists
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mae_solicitud_tipo') AND name = 'modulo_destino')
            BEGIN
                ALTER TABLE mae_solicitud_tipo ADD modulo_destino VARCHAR(50);
            END
        `);
        console.log('✅ Columna modulo_destino asegurada');

        // 2. Populate for EQUIPOS
        // 1: Activación, 2: Baja, 3: Traspaso, 4: Nuevo, 5: Reporte Problema, 6: Solicitud Baja
        await pool.request().query(`
            UPDATE mae_solicitud_tipo 
            SET modulo_destino = 'EQUIPOS' 
            WHERE id_tipo IN (1, 2, 3, 4, 5, 6)
        `);
        console.log('✅ Tipos de equipo actualizados a modulo_destino = EQUIPOS');

        // 3. Verify
        const check = await pool.request().query("SELECT id_tipo, nombre, modulo_destino FROM mae_solicitud_tipo");
        console.table(check.recordset);

    } catch(e) {
        console.error('❌ Error en migración:', e);
    } finally {
        await closeConnection();
        process.exit(0);
    }
}
run();
