import { getConnection } from './src/config/database.js';

async function testQuery() {
    try {
        const pool = await getConnection();

        console.log("--- mae_empresa parents ---");
        const res1 = await pool.request().query("SELECT id_empresa, rut_empresa, nombre_empresa FROM mae_empresa WHERE id_empresa IN (11, 14, 47, 67, 60, 8, 62)");
        console.log(res1.recordset);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

testQuery();
