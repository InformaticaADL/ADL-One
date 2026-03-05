
import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import fs from 'fs';

async function run() {
    try {
        console.log('Connecting...');
        const pool = await getConnection();
        console.log('Connected.');
        const res = await pool.request().query("SELECT codigo_evento, asunto_template FROM mae_evento_notificacion");
        console.log(`Found ${res.recordset.length} events.`);
        fs.writeFileSync('../all_subjects.json', JSON.stringify(res.recordset, null, 2));
        console.log('File written to ../all_subjects.json');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

run();
