import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkSchema() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT TOP 1 * FROM mae_permiso");
        console.log('Columns in mae_permiso:', Object.keys(result.recordset[0]));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
