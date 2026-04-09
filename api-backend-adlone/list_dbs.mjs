
import { getConnection } from './src/config/database.js';

async function listDatabases() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT name FROM sys.databases");
    console.log(JSON.stringify(res.recordset, null, 2));
    process.exit(0);
}

listDatabases().catch(err => {
    console.error(err);
    process.exit(1);
});
