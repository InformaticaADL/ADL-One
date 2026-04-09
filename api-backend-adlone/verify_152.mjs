
import { getConnection } from './src/config/database.js';

async function check152() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT id_solicitud, datos_json, id_solicitante FROM mae_solicitud WHERE id_solicitud = 152");
    console.log(JSON.stringify(res.recordset[0], null, 2));
    process.exit(0);
}

check152().catch(err => {
    console.error(err);
    process.exit(1);
});
