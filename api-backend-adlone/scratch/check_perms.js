import { getConnection } from '../src/config/database.js';
import sql from 'mssql';

async function checkPerms() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query('SELECT TOP 1 * FROM mae_permiso');
        console.log('--- COLUMNS IN mae_permiso ---');
        console.log(Object.keys(res.recordset[0]).join(', '));
        
        const roles = await pool.request().query('SELECT id_rol, nombre_rol FROM mae_rol');
        console.log('\n--- ROLES ---');
        roles.recordset.forEach(r => console.log(`${r.id_rol}: ${r.nombre_rol}`));
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkPerms();
