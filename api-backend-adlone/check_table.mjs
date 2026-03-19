import { getConnection } from './src/config/database.js';

async function checkTable() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_solicitud_tipo'");
    console.table(res.recordset);
    process.exit(0);
}
checkTable();
