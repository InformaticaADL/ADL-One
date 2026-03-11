import { getConnection } from './src/config/database.js';

async function test() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT TOP 5 m.nombre_muestreador, COUNT(e.id_equipo) as c FROM mae_muestreador m JOIN mae_equipo e ON m.id_muestreador = e.id_muestreador GROUP BY m.nombre_muestreador ORDER BY c DESC");
        console.log("Muestreadores:", res.recordset);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

test();
