import { getConnection } from './src/config/database.js';

async function testQuery() {
    try {
        const pool = await getConnection();

        // Find which tables contain a column with 'nombre' and search 'Copihue'
        const req = await pool.request().query(`
            SELECT table_name = t.name, column_name = c.name 
            FROM sys.tables t 
            INNER JOIN sys.columns c ON t.object_id = c.object_id 
            WHERE c.system_type_id IN (167, 231) -- varchar, nvarchar
        `);

        const tables = req.recordset;

        for (const { table_name, column_name } of tables) {
            try {
                const searchReq = await pool.request().query(`
                    SELECT TOP 1 * FROM [${table_name}] 
                    WHERE [${column_name}] LIKE '%Copihue%' OR [${column_name}] LIKE '%Petrohue%'
                `);
                if (searchReq.recordset && searchReq.recordset.length > 0) {
                    console.log(`Found in table: ${table_name}, column: ${column_name}`);
                    const val = searchReq.recordset[0][column_name];
                    console.log(`Value: ${val}`);
                }
            } catch (e) {
                // ignore errors for specific tables
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

testQuery();
