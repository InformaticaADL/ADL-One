import { getConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        
        const r1 = await pool.request().query("SELECT * FROM mae_estadomuestreo");
        console.log("mae_estadomuestreo:", r1.recordset);
        
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
run();
