import { getConnection } from './src/config/database.js';

async function check() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME LIKE '%firma%'");
        console.log(JSON.stringify(res.recordset, null, 2));
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
