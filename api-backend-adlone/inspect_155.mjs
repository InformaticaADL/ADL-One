
import { getConnection } from './src/config/database.js';

async function inspect155() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT id_solicitud, id_solicitante, id_tipo, datos_json FROM mae_solicitud WHERE id_solicitud = 155");
    console.log(JSON.stringify(res.recordset[0], null, 2));
    process.exit(0);
}

inspect155().catch(err => {
    console.error(err);
    process.exit(1);
});
