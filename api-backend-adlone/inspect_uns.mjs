import { getConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        // Check mae_notificacion_regla
        const resRegla = await pool.request().query("SELECT TOP 1 * FROM mae_notificacion_regla");
        console.log('--- MAE_NOTIFICACION_REGLA ---');
        console.log(JSON.stringify(resRegla.recordset, null, 2));
        
        // Check mae_evento (if exists)
        try {
            const resEvento = await pool.request().query("SELECT TOP 1 * FROM mae_evento_notificacion");
            console.log('--- MAE_EVENTO_NOTIFICACION ---');
            console.log(JSON.stringify(resEvento.recordset, null, 2));
        } catch(e) {}

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
