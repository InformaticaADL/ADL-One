import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';

const table = process.argv[2] || 'mae_evento_notificacion';

const getSchema = async () => {
    try {
        const pool = await getConnection();
        console.log(`--- ${table} columns ---`);
        const columns = await pool.request()
            .input('tableName', table)
            .query("SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName");
        console.table(columns.recordset);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error getting schema:', error);
        process.exit(1);
    }
};

getSchema();
