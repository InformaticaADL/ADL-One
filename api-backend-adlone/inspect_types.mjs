import { getConnection, closeConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        const types = await pool.request().query("SELECT id_tipo, nombre FROM mae_solicitud_tipo");
        console.log('TYPES:', types.recordset);
    } catch(e) {
        console.error(e);
    } finally {
        await closeConnection();
        process.exit(0);
    }
}
run();
