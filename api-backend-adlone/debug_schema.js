import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function debug() {
    try {
        const pool = await getConnection();
        
        console.log('--- mae_solicitud (schema) ---');
        const res = await pool.request().query("SELECT TOP 1 * FROM mae_solicitud");
        console.log(Object.keys(res.recordset[0] || {}).join(', '));
        
        console.log('--- EVENT TEMPLATES ---');
        const res2 = await pool.request().query("SELECT codigo_evento, asunto_template, cuerpo_template_html FROM mae_evento_notificacion WHERE codigo_evento IN ('SOLICITUD_NUEVA', 'SOLICITUD_ESTADO_CAMBIO', 'SOLICITUD_COMENTARIO_NUEVO', 'SOLICITUD_DERIVACION')");
        res2.recordset.forEach(r => {
            console.log(`Event: ${r.codigo_evento}`);
            console.log(`Subject: ${r.asunto_template}`);
            console.log(`Body Sample (100 chars): ${r.cuerpo_template_html?.substring(0, 100)}`);
            console.log('---');
        });
        
        console.log('--- FULL BODY: SOLICITUD_COMENTARIO_NUEVO ---');
        const res3 = await pool.request().query("SELECT cuerpo_template_html FROM mae_evento_notificacion WHERE codigo_evento = 'SOLICITUD_COMENTARIO_NUEVO'");
        console.log(res3.recordset[0]?.cuerpo_template_html);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
