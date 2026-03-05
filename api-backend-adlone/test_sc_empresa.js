import { getConnection } from './src/config/database.js';

async function testQuery() {
    try {
        const pool = await getConnection();

        console.log("--- sc_empresa ---");
        const res1 = await pool.request().query("SELECT DISTINCT id_empresa, nombre_empresa FROM sc_empresa WHERE nombre_empresa IS NOT NULL ORDER BY nombre_empresa");
        console.log(res1.recordset);

        console.log("--- mae_muestreador ---");
        const res2 = await pool.request().query("SELECT id_muestreador, nombre_muestreador FROM mae_muestreador WHERE habilitado = 'S'");
        console.log(res2.recordset);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

testQuery();
