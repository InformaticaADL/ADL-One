import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function run() {
    try {
        const pool = await getConnection();
        
        console.log('--- Notificacion Eventos (TEMPLATES) ---');
        const eventRes = await pool.request().query("SELECT codigo_evento, asunto_template, cuerpo_template_html FROM mae_evento_notificacion WHERE codigo_evento IN ('AVISO_PERDIDO_NUEVO', 'AVISO_PROBLEMA_NUEVO', 'AVISO_CANCELACION_NUEVA')");
        console.log(JSON.stringify(eventRes.recordset, null, 2));

        console.log('\n--- Recent Web Notifications ---');
        const notifRes = await pool.request().query("SELECT TOP 5 * FROM mae_notificacion ORDER BY fecha_creacion DESC");
        console.log(JSON.stringify(notifRes.recordset, null, 2));

    } catch (e) {
        console.log('ERROR:', e.message);
    } finally {
        process.exit();
    }
}
run();
