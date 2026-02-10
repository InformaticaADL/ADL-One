import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkData() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT DISTINCT tipoequipo, sigla FROM mae_equipo ORDER BY tipoequipo');
        console.log(JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkData();
