import { getConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query(`
            SELECT r.nombre_rol, p.codigo 
            FROM rel_rol_permiso rrp 
            JOIN mae_rol r ON rrp.id_rol = r.id_rol 
            JOIN mae_permiso p ON rrp.id_permiso = p.id_permiso 
            WHERE p.codigo = 'INF_SOLICITUDES'
        `);
        console.log('--- PERMISSION ASSIGNMENTS ---');
        console.log(JSON.stringify(res.recordset, null, 2));
        console.log('------------------------------');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
