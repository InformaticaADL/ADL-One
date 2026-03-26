import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function check() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT name FROM sys.tables 
            WHERE name LIKE '%foto%' 
               OR name LIKE '%media%' 
               OR name LIKE '%archivo%' 
               OR name LIKE '%imagen%' 
               OR name LIKE '%firma%'
        `);
        console.log(JSON.stringify(result.recordset, null, 2));
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
