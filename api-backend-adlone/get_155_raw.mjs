
import { getConnection } from './src/config/database.js';

async function get155() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT id_solicitud, datos_json FROM mae_solicitud WHERE id_solicitud = 155");
    console.log(res.recordset[0].datos_json);
    process.exit(0);
}

get155().catch(err => {
    console.error(err);
    process.exit(1);
});
