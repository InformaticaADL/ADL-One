import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkMaSchema() {
    try {
        const pool = await getConnection();
        
        // Find relevant tables
        const res = await pool.request()
            .query("SELECT name FROM sys.tables WHERE name LIKE '%foto%' OR name LIKE '%firma%' OR name LIKE '%archivo%' OR name LIKE '%muestreador%' OR name LIKE '%equipo%' ORDER BY name");
        
        const tables = res.recordset.map(r => r.name);
        console.log('Relevant Tables found:', tables.join(', '));
        
        for (const table of tables) {
            const columnsResult = await pool.request()
                .input('tableName', sql.VarChar, table)
                .query(`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = @tableName
                `);
            console.log(`\n--- ${table} ---`);
            console.log(columnsResult.recordset.map(r => r.COLUMN_NAME).join(', '));
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkMaSchema();
