import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function check() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE (COLUMN_NAME LIKE '%foto%' 
               OR COLUMN_NAME LIKE '%firma%' 
               OR COLUMN_NAME LIKE '%imagen%' 
               OR COLUMN_NAME LIKE '%archivo%')
               AND TABLE_NAME LIKE 'App_Ma_%'
        `);
        console.log(JSON.stringify(result.recordset, null, 2));
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
