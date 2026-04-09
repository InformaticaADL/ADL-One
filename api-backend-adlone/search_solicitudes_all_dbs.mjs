
import { getConnection } from './src/config/database.js';

async function findTableInDbs() {
    const pool = await getConnection();
    const dbsRes = await pool.request().query("SELECT name FROM sys.databases WHERE database_id > 4");
    const dbs = dbsRes.recordset.map(r => r.name);
    
    for (const db of dbs) {
        try {
            const tableRes = await pool.request().query(`USE [${db}]; SELECT COUNT(*) as cnt FROM sys.tables WHERE name = 'mae_solicitud'`);
            if (tableRes.recordset[0].cnt > 0) {
                const countRes = await pool.request().query(`USE [${db}]; SELECT MAX(id_solicitud) as max_id FROM mae_solicitud`);
                console.log(`DATABASE [${db}] has mae_solicitud. MAX ID: ${countRes.recordset[0].max_id}`);
            }
        } catch (e) {
            // Silently skip if no access
        }
    }
    process.exit(0);
}

findTableInDbs().catch(err => {
    console.error(err);
    process.exit(1);
});
