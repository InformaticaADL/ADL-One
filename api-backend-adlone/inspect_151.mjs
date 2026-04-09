
import { getConnection } from './src/config/database.js';

async function check150() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT id_solicitante, id_tipo, datos_json FROM mae_solicitud WHERE id_solicitud = 150");
    console.log(JSON.stringify(res.recordset[0], null, 2));
    process.exit(0);
}

check150().catch(err => {
    console.error(err);
    process.exit(1);
});
