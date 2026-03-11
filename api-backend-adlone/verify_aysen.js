import { getConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT id_muestreador, nombre_muestreador FROM mae_muestreador WHERE nombre_muestreador LIKE 'Base Ays%'");
        console.log('Muestreador en BD:', res.recordset);

        const res2 = await pool.request().query("SELECT TOP 10 id_equipo, id_muestreador, nombre_asignado FROM mae_equipo WHERE nombre_asignado LIKE 'Base Ays%'");
        console.log('Equipos de Aysén en BD:', res2.recordset);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
