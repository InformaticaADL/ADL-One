import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function run() {
    try {
        const pool = await getConnection();
        console.log('--- Updating Notification Templates ---');

        // 1. AVISO_PERDIDO_NUEVO
        const res1 = await pool.request()
            .input('code', sql.VarChar(50), 'AVISO_PERDIDO_NUEVO')
            .query("SELECT cuerpo_template_html FROM mae_evento_notificacion WHERE codigo_evento = @code");
        
        if (res1.recordset.length > 0) {
            let html = res1.recordset[0].cuerpo_template_html;
            html = html.replace(/<strong>ID Equipo:<\/strong>/g, '<strong>Equipo:</strong>');
            
            await pool.request()
                .input('code', sql.VarChar(50), 'AVISO_PERDIDO_NUEVO')
                .input('html', sql.NVarChar(sql.MAX), html)
                .query("UPDATE mae_evento_notificacion SET cuerpo_template_html = @html WHERE codigo_evento = @code");
            console.log('Updated AVISO_PERDIDO_NUEVO');
        }

        // 2. AVISO_PROBLEMA_NUEVO
        const res2 = await pool.request()
            .input('code', sql.VarChar(50), 'AVISO_PROBLEMA_NUEVO')
            .query("SELECT cuerpo_template_html FROM mae_evento_notificacion WHERE codigo_evento = @code");
        
        if (res2.recordset.length > 0) {
            let html = res2.recordset[0].cuerpo_template_html;
            html = html.replace(/<strong>ID Equipo:<\/strong>/g, '<strong>Equipo:</strong>');
            
            await pool.request()
                .input('code', sql.VarChar(50), 'AVISO_PROBLEMA_NUEVO')
                .input('html', sql.NVarChar(sql.MAX), html)
                .query("UPDATE mae_evento_notificacion SET cuerpo_template_html = @html WHERE codigo_evento = @code");
            console.log('Updated AVISO_PROBLEMA_NUEVO');
        }

        console.log('Done.');
    } catch (e) {
        console.log('ERROR:', e.message);
    } finally {
        process.exit();
    }
}
run();
