import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkSolicitudes() {
    try {
        const pool = await getConnection();
        
        console.log("Checking mae_solicitud_tipo:");
        const typeRes = await pool.request().query(`
            SELECT id_tipo, nombre, area_destino FROM mae_solicitud_tipo
        `);
        console.table(typeRes.recordset);

        console.log("Checking total mae_solicitud:");
        const countRes2 = await pool.request().query(`
            SELECT COUNT(*) as total, MAX(id_solicitud) as maxId FROM mae_solicitud
        `);
        console.table(countRes2.recordset);
        
        console.log("Checking columns in mae_solicitud:");
        const colRes2 = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'mae_solicitud'
        `);
        console.table(colRes2.recordset);

        console.log("\nChecking last 5 mae_solicitud:");
        const solRes2 = await pool.request().query(`
            SELECT TOP 5 * FROM mae_solicitud ORDER BY id_solicitud DESC
        `);
        console.table(solRes2.recordset);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSolicitudes();
