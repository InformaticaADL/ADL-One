
import sql from './src/config/database.js';
import { getConnection } from './src/config/database.js';

async function listEvents() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_evento_notificacion'");
        console.log(result.recordset.map(r => r.COLUMN_NAME));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listEvents();
