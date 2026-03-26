import { getConnection } from './src/config/database.js';

async function check() {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME = 'id_referenciaanalisis'");
        console.log(JSON.stringify(res.recordset.map(t => t.TABLE_NAME), null, 2));
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

check();
