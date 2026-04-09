import { getConnection } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query('SELECT TOP 1 * FROM mae_evento_notificacion');
        console.log('Columns:', Object.keys(res.recordset[0]));
        await pool.close();
    } catch (e) {
        console.error(e);
    }
}
check();
