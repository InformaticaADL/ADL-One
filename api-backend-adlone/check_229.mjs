
import { getConnection } from './src/config/database.js';

async function check229() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT id_muestreador, nombre_muestreador FROM mae_muestreador WHERE id_muestreador = 229");
    console.log(JSON.stringify(res.recordset[0], null, 2));
    process.exit(0);
}

check229().catch(err => {
    console.error(err);
    process.exit(1);
});
