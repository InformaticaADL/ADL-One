import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';

const checkTableStructure = async () => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_evento_notificacion'");

        console.log('Structure of mae_evento_notificacion:');
        console.log(result.recordset);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkTableStructure();
