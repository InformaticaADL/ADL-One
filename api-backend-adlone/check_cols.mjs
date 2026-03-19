import { getConnection } from './src/config/database.js';

async function checkCols() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_solicitud_tipo'");
    console.log(res.recordset.map(c => c.COLUMN_NAME).join(', '));
    process.exit(0);
}
checkCols();
