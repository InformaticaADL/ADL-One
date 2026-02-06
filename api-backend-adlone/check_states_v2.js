
import { getConnection } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const pool = await getConnection();

        console.log('--- MAE_VALIDACIONTECNICA ---');
        const vt = await pool.request().query('SELECT * FROM mae_validaciontecnica');
        console.table(vt.recordset);

        console.log('\n--- DISTINCT ESTADO_FICHA ---');
        const distinct = await pool.request().query('SELECT DISTINCT estado_ficha FROM App_Ma_FichaIngresoServicio_ENC');
        console.table(distinct.recordset);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

run();
