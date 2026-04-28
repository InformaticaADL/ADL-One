
import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

async function listAllPerms() {
    try {
        const pool = await getConnection();
        const res = await pool.request()
            .query("SELECT codigo FROM mae_permiso ORDER BY codigo");
        console.log(res.recordset.map(x => x.codigo));
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

listAllPerms();
