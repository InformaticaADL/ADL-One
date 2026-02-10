import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const pool = await getConnection();
        // Execute the SP
        const result = await pool.request().execute('MAM_FichaComercial_ConsultaCoordinador');
        console.log('--- SP OUTPUT SAMPLE (First 3 rows) ---');
        console.log(JSON.stringify(result.recordset.slice(0, 3), null, 2));

        // Also check if there is a ficha with inconsistent state
        console.log('\n--- CHECKING INCONSISTENT FICHAS ---');
        const check = await pool.request().query(`
            SELECT id_fichaingresoservicio, id_validaciontecnica, estado_ficha 
            FROM App_Ma_FichaIngresoServicio_ENC 
            WHERE id_validaciontecnica = 6
        `);
        console.log(JSON.stringify(check.recordset, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

run();
