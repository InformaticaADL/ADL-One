import { getConnection } from './src/config/database.js';

async function testQuery() {
    try {
        const pool = await getConnection();

        console.log("--- mae_empresa ---");
        const res1 = await pool.request().query("SELECT TOP 20 * FROM mae_empresa WHERE nombre_empresa LIKE '%Piscicultura%' OR nombre_empresa LIKE '%Copihue%'");
        console.log(res1.recordset);

        console.log("--- mae_empresaservicios ---");
        const result = await pool.request().query('SELECT TOP 5 * FROM mae_empresaservicios');
        console.log("COLUMNS mae_empresaservicios:");
        console.log(result.recordset.length ? Object.keys(result.recordset[0]) : "No data");
        console.log("FIRST ROW:");
        console.log(result.recordset[0]);

        console.log("--- mae_centro ---");
        const res3 = await pool.request().query("SELECT TOP 20 * FROM mae_centro WHERE nombre_centro LIKE '%Piscicultura%' OR nombre_centro LIKE '%Copihue%'");
        console.log(res3.recordset);

        console.log("--- maestro_empresa ---");
        const res4 = await pool.request().query("SELECT TOP 20 * FROM maestro_empresa WHERE nombre_empresa LIKE '%Piscicultura%' OR nombre_empresa LIKE '%Copihue%'");
        console.log(res4.recordset);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

testQuery();
