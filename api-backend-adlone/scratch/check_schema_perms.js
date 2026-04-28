
import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

async function checkSchema() {
    try {
        const pool = await getConnection();
        const res = await pool.request()
            .query("SELECT TOP 1 * FROM mae_permiso");
        console.log('Columns in mae_permiso:', Object.keys(res.recordset[0]));
        
        const roleRes = await pool.request()
            .query("SELECT TOP 1 * FROM mae_rol");
        console.log('Columns in mae_rol:', Object.keys(roleRes.recordset[0]));
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkSchema();
