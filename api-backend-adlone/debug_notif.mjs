import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    try {
        const pool = await getConnection();
        
        console.log('--- RULES ---');
        const rules = await pool.request()
            .input('code', sql.VarChar, 'AVISO_PERDIDO_NUEVO')
            .query('SELECT * FROM mae_notificacion_regla WHERE codigo_evento = @code');
        console.log(JSON.stringify(rules.recordset, null, 2));
        
        console.log('\n--- TEMPLATES ---');
        const templates = await pool.request()
            .input('code', sql.VarChar, 'AVISO_PERDIDO_NUEVO')
            .query('SELECT * FROM mae_evento_notificacion WHERE codigo_evento = @code');
        console.log(JSON.stringify(templates.recordset, null, 2));

        await pool.close();
    } catch (e) {
        console.error(e);
    }
}
check();
