import { getConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'mae_notificacion_regla'
        `);
        console.log('--- SCHEMA: mae_notificacion_regla ---');
        console.log(JSON.stringify(res.recordset, null, 2));
        console.log('---------------------------------------');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
