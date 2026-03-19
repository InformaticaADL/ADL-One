
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkTable(tableName) {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('tableName', sql.NVarChar, tableName)
            .query("SELECT TOP 10 COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName ORDER BY ORDINAL_POSITION");
        console.log('First 10 columns for ' + tableName + ':');
        console.table(result.recordset);
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

const table = process.argv[2] || 'mae_usuario';
checkTable(table);
