import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function debug() {
    try {
        const pool = await getConnection();
        
        console.log('--- rel_solicitud_tipo_notificacion ---');
        const res1 = await pool.request().query("SELECT * FROM rel_solicitud_tipo_notificacion WHERE accion = 'COMENTARIO'");
        console.table(res1.recordset);
        
        console.log('--- mae_notificacion_regla (Chat) ---');
        const res2 = await pool.request().query("SELECT * FROM mae_notificacion_regla WHERE codigo_evento = 'SOLICITUD_COMENTARIO_NUEVO'");
        console.table(res2.recordset);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
