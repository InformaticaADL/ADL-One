import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function test() {
    try {
        const pool = await getConnection();

        let c = await pool.request().query('SELECT TOP 1 * FROM mae_contacto');
        console.log("mae_contacto columns:", Object.keys(c.recordset[0]));

        let e = await pool.request().query('SELECT TOP 1 * FROM mae_empresa');
        console.log("mae_empresa columns:", Object.keys(e.recordset[0]));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

test();
