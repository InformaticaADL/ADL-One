
import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        request.input('xid_fichaingresoservicio', sql.Numeric(10, 0), 93);
        request.input('xid_estadomuestreo', sql.Numeric(10, 0), 1);

        console.log('Executing SP...');
        const result = await request.execute('MAM_FichaComercial_ConsultaCoordinadorDetalle');
        console.log('Result:', result.recordset ? result.recordset.length : 'No recordset');
    } catch (err) {
        console.error('Error details:', JSON.stringify(err, null, 2));
    } finally {
        process.exit();
    }
}

run();
