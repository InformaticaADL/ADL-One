
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function run() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT name FROM sys.tables WHERE name LIKE '%notif%' OR name LIKE '%aviso%'");
        console.log(result.recordset);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
