import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function check() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT * FROM mae_estadomuestreo');
        console.log(JSON.stringify(result.recordset, null, 2));
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
