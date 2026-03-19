import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function debug() {
    try {
        const pool = await getConnection();
        
        console.log('--- mae_solicitud_tipo ---');
        const res = await pool.request().query("SELECT id_tipo, nombre FROM mae_solicitud_tipo");
        console.table(res.recordset);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
