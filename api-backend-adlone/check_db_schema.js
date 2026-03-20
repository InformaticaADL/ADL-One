import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

async function checkSchema() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT 
                column_name, 
                data_type, 
                character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'mae_usuario'
        `);
        console.log(JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
