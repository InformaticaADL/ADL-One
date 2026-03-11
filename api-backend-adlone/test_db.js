import { getConnection } from './src/config/database.js';

async function check() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT id_equipo, habilitado, version FROM mae_equipo WHERE id_equipo = 10");
    console.log('Equipo actual:', res.recordset);

    const resHist = await pool.request().query("SELECT id_historial, habilitado, version FROM mae_equipo_historial WHERE id_equipo = 10 ORDER BY id_historial DESC");
    console.log("Historial:", resHist.recordset);

    process.exit(0);
}
check().catch(console.error);
