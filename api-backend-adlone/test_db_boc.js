import { getConnection } from './src/config/database.js';

async function test() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT TOP 5 id_equipo, nombre, tipoequipo, sigla, correlativo, codigo FROM mae_equipo WHERE sigla = 'BOC' ORDER BY correlativo DESC");
        console.log("DB Result:", res.recordset);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

test();
