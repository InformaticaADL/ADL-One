import { getConnection } from './api-backend-adlone/src/config/database.js';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config({ path: './api-backend-adlone/.env' });

async function check() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT codigo_evento FROM mae_notificacion_regla");
        console.log("RULES IN DB:", res.recordset.map(r => r.codigo_evento));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
