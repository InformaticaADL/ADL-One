import { getConnection } from './src/config/database.js';

async function check() {
    try {
        const pool = await getConnection();
        
        console.log("Checking mae_firma top 5:");
        const resFirma = await pool.request().query("SELECT TOP 5 * FROM mae_firma");
        console.log(JSON.stringify(resFirma.recordset, null, 2));

        console.log("\nChecking muestras top 5 for Ficha 31:");
        const resMuestras = await pool.request().query("SELECT TOP 5 * FROM muestras WHERE id_agendamam IS NOT NULL");
        console.log(JSON.stringify(resMuestras.recordset, null, 2));

        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
