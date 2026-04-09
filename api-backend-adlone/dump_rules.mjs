import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query('SELECT * FROM mae_notificacion_regla');
        console.log('--- RULES IN mae_notificacion_regla ---');
        console.log(JSON.stringify(res.recordset, null, 2));
        
        const res2 = await pool.request().query('SELECT codigo_evento, plantilla_web FROM mae_notificacion_regla WHERE plantilla_web IS NOT NULL');
        console.log('\n--- CUSTOM WEB TEMPLATES ---');
        console.log(JSON.stringify(res2.recordset, null, 2));

        await pool.close();
    } catch (e) {
        console.error(e);
    }
}
check();
