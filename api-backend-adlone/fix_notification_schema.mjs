import { getConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'mae_notificacion' 
                AND COLUMN_NAME = 'id_referencia'
            )
            BEGIN
                ALTER TABLE mae_notificacion ADD id_referencia NUMERIC(10,0) NULL
            END
        `);
        console.log('Column id_referencia ensured in mae_notificacion');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
