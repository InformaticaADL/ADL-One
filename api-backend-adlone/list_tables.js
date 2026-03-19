import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function listAllTables() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT name FROM sys.tables ORDER BY name");
        console.log('Tables in database:');
        console.log(result.recordset.map(r => r.name).join(', '));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listAllTables();
