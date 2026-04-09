import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    try {
        const pool = await getConnection();
        const res = await pool.request()
            .input('code', sql.VarChar, 'AVISO_PERDIDO_NUEVO')
            .query('SELECT * FROM mae_evento_notificacion WHERE codigo_evento = @code');
        
        console.log('--- EMAIL TEMPLATE: AVISO_PERDIDO_NUEVO ---');
        const t = res.recordset[0];
        if (t) {
            console.log('Subject:', t.asunto_template);
            console.log('Has HTML:', !!t.cuerpo_template_html);
            console.log('HTML Snippet:', t.cuerpo_template_html?.substring(0, 200));
            console.log('Placeholders found in HTML:', t.cuerpo_template_html?.match(/\{[A-Z_]+\}/g));
        } else {
            console.log('Template NOT FOUND');
        }

        await pool.close();
    } catch (e) {
        console.error(e);
    }
}
check();
