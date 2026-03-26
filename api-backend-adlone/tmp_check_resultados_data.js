import { getConnection } from './src/config/database.js';

async function check() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT TOP 10 uf_individual, limitemax_d, limitemax_h, cumplimiento, cumplimiento_app FROM App_Ma_Resultados WHERE uf_individual IS NOT NULL");
        console.log(JSON.stringify(res.recordset, null, 2));
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
