import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function test() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT * FROM mae_dispositivohidraulico');
        console.log("dispositivos:");
        result.recordset.forEach(r => console.log(`${r.id_dispositivohidraulico}: ${r.nombre_dispositivohidraulico}`));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

test();
