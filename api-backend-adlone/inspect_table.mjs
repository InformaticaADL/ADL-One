import { getConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_notificacion'");
        console.log(JSON.stringify(res.recordset, null, 2));
    } catch(e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
