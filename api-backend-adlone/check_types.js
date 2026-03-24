import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkDataTypes() {
    try {
        const pool = await getConnection();
        
        const result = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'rel_chat_participante'
        `);
        
        console.table(result.recordset);
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkDataTypes();
