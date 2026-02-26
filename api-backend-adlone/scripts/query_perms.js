import { getConnection } from '../src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT id_permiso, codigo, nombre, modulo, submodulo FROM mae_permiso WHERE codigo LIKE 'AI_%' OR modulo LIKE '%AI%' OR modulo LIKE '%Administraci%' OR modulo LIKE '%MA%' OR modulo LIKE '%Medio%' ORDER BY modulo, submodulo, id_permiso");
        console.table(res.recordset);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
