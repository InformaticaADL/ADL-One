import { getConnection } from './api-backend-adlone/src/config/database.js';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config({ path: './api-backend-adlone/.env' });

async function debug() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT s.*, t.nombre as tipo_nombre FROM mae_solicitud s JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo WHERE id_solicitud = 174");
        console.log(JSON.stringify(res.recordset[0], null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
debug();
