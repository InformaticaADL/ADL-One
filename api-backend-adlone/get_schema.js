
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function run() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT TOP 1 * FROM mae_evento_notificacion");
        console.log('Columns:', Object.keys(result.recordset[0]));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
