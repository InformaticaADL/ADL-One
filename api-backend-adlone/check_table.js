
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkTable() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT TOP 0 * FROM APP_MA_EQUIPOS_MUESTREOS");
        console.log("Table exists!");
        const columns = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'APP_MA_EQUIPOS_MUESTREOS'
        `);
        console.log("Columns:", columns.recordset);
    } catch (error) {
        console.error("Error checking table:", error.message);
    } finally {
        process.exit();
    }
}

checkTable();
