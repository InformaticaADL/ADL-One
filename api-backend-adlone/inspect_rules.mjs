import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function run() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT * FROM mae_notificacion_regla WHERE codigo_evento IN ('AVISO_PERDIDO_NUEVO', 'AVISO_PROBLEMA_NUEVO')");
        console.log(JSON.stringify(res.recordset, null, 2));
    } catch (e) {
        console.log('ERROR:', e.message);
    } finally {
        process.exit();
    }
}
run();
