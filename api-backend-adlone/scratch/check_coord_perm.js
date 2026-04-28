
import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

async function checkPerm() {
    try {
        const pool = await getConnection();
        const res = await pool.request()
            .query("SELECT * FROM mae_permiso WHERE codigo = 'MA_COORDINACION_ACCESO'");
        console.table(res.recordset);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkPerm();
