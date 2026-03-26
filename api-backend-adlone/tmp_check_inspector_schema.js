import { getConnection } from './src/config/database.js';

async function check() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_inspectorambiental'");
        console.log(JSON.stringify(res.recordset.map(c => c.COLUMN_NAME), null, 2));
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
