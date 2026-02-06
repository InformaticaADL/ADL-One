
import { getConnection } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const pool = await getConnection();
        console.log('--- MAE_ESTADOMUESTREO ---');
        const result = await pool.request().query('SELECT * FROM mae_estadomuestreo');
        console.table(result.recordset);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

run();
