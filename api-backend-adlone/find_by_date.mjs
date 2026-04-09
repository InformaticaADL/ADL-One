
import { getConnection } from './src/config/database.js';

async function findByDate() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT TOP 20 id_solicitud, id_tipo, fecha_creacion, CAST(datos_json AS NVARCHAR(MAX)) as datos_json FROM mae_solicitud ORDER BY fecha_creacion DESC");
    console.log(JSON.stringify(res.recordset, null, 2));
    process.exit(0);
}

findByDate().catch(err => {
    console.error(err);
    process.exit(1);
});
