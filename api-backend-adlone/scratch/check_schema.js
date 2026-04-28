import 'dotenv/config';
import { getConnection } from '../src/config/database.js';
import sql from 'mssql';

async function run() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT 
                COLUMN_NAME, 
                DATA_TYPE, 
                CHARACTER_MAXIMUM_LENGTH 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'mae_empresaservicios'
            ORDER BY COLUMN_NAME
        `);
        console.log(JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error querying schema:', error);
        process.exit(1);
    }
}

run();
