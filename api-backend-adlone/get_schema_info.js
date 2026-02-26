import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';

const getSchema = async () => {
    try {
        const pool = await getConnection();

        console.log('--- mae_permiso columns ---');
        const permsCols = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_permiso'");
        console.table(permsCols.recordset);

        console.log('--- rel_rol_permiso columns ---');
        const relCols = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'rel_rol_permiso'");
        console.table(relCols.recordset);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error getting schema:', error);
        process.exit(1);
    }
};

getSchema();
