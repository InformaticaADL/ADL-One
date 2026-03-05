import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function test() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT TOP 1 * FROM mae_centro');
        console.log(result.recordset[0]);
        console.log("Columns:", Object.keys(result.recordset[0]));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

test();
