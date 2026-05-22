import dotenv from 'dotenv';
dotenv.config();
import { getConnection, closeConnection } from './src/config/database.js';

async function listPermissions() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT * FROM mae_permiso');
        console.log('Total permisos:', result.recordset.length);
        console.log('Permisos disponibles:');
        result.recordset.forEach(p => {
            console.log(`- ${p.codigo}: ${p.nombre_permiso}`);
        });
        await closeConnection();
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

listPermissions();
