import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function run() {
    try {
        const pool = await getConnection();
        
        console.log('--- Checking Solicitud 150 ---');
        const solRes = await pool.request()
            .input('id', sql.Numeric(10, 0), 150)
            .query("SELECT * FROM mae_solicitud WHERE id_solicitud = @id");
        
        if (solRes.recordset.length > 0) {
            const sol = solRes.recordset[0];
            console.log('ID:', sol.id_solicitud);
            console.log('Datos JSON:', sol.datos_json);
        } else {
            console.log('Solicitud 150 not found.');
        }

        console.log('\n--- Checking mae_evento_notificacion AVISO_PERDIDO_NUEVO ---');
        const eventRes = await pool.request()
            .input('code', sql.VarChar(50), 'AVISO_PERDIDO_NUEVO')
            .query("SELECT * FROM mae_evento_notificacion WHERE codigo_evento = @code");
        console.log(JSON.stringify(eventRes.recordset, null, 2));

    } catch (e) {
        console.log('ERROR:', e.message);
    } finally {
        process.exit();
    }
}
run();
