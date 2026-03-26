import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function check() {
    try {
        const pool = await getConnection();
        
        console.log("Checking App_Ma_Resultados columns:");
        const resCol = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'App_Ma_Resultados'");
        console.log(JSON.stringify(resCol.recordset.map(c => c.COLUMN_NAME), null, 2));

        console.log("\nChecking tables like mae_referencia%:");
        const resTab = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE 'mae_referencia%'");
        console.log(JSON.stringify(resTab.recordset, null, 2));

        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
