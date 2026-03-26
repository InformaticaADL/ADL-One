import { getConnection } from './src/config/database.js';

async function check() {
    try {
        const pool = await getConnection();
        
        console.log("Searching for id_firma columns in App_Ma_% tables:");
        const resAppMa = await pool.request().query("SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME LIKE 'App_Ma_%' AND COLUMN_NAME LIKE 'id_firma%'");
        console.log(JSON.stringify(resAppMa.recordset, null, 2));

        console.log("\nSearching for any firma related columns in App_Ma_Agenda_MUESTREOS:");
        const resAgenda = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'App_Ma_Agenda_MUESTREOS' AND (COLUMN_NAME LIKE '%firma%' OR COLUMN_NAME LIKE '%sign%')");
        console.log(JSON.stringify(resAgenda.recordset, null, 2));

        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
