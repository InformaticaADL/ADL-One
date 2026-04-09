import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function run() {
    try {
        const pool = await getConnection();
        
        console.log('--- AVISO_PERDIDO_NUEVO Template ---');
        const eventRes = await pool.request()
            .input('code', sql.VarChar(50), 'AVISO_PERDIDO_NUEVO')
            .query("SELECT * FROM mae_evento_notificacion WHERE codigo_evento = @code");
        console.log(JSON.stringify(eventRes.recordset, null, 2));

        console.log('\n--- URS Types ---');
        const typesRes = await pool.request()
            .query("SELECT id_tipo, nombre FROM mae_solicitud_tipo WHERE nombre LIKE '%PERDIDO%' OR nombre LIKE '%EXTRAVIO%'");
        console.log(JSON.stringify(typesRes.recordset, null, 2));

    } catch (e) {
        console.log('ERROR:', e.message);
    } finally {
        process.exit();
    }
}
run();
