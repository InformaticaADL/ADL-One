import { getConnection } from './src/config/database.js';

async function testQuery() {
    try {
        const pool = await getConnection();

        console.log("--- maestro_empresa / mae_cliente ---");
        try {
            const res = await pool.request().query("SELECT TOP 20 * FROM mae_cliente WHERE razon_social LIKE '%Copihue%' OR nombre_fantasia LIKE '%Copihue%'");
            console.log("mae_cliente:", res.recordset);
        } catch (e) { }

        try {
            const res2 = await pool.request().query("SELECT TOP 20 * FROM mae_cliente WHERE razon_social LIKE '%Prima Farms%' OR nombre_fantasia LIKE '%Prima Farms%'");
            console.log("mae_cliente Prima Farms:", res2.recordset);
        } catch (e) { }

        console.log("--- Checking specific query from image ---");
        // Look at the image, names: Piscicultura Copihue, Piscicultura Río Petrohué.
        // Let's search table mae_centro again.
        const res3 = await pool.request().query("SELECT id_centro, nombre_centro, id_empresa FROM mae_centro WHERE nombre_centro LIKE '%Copihue%' OR nombre_centro LIKE '%Petrohue%'");
        console.log("mae_centro:", res3.recordset);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

testQuery();
