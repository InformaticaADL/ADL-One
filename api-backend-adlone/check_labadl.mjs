
import { getConnection } from './src/config/database.js';

async function checkLaboratorioADL() {
    const pool = await getConnection();
    const res = await pool.request().query("USE LaboratorioADL; SELECT TOP 5 id_solicitud, id_tipo, datos_json, fecha_creacion FROM mae_solicitud ORDER BY id_solicitud DESC");
    console.log(JSON.stringify(res.recordset, null, 2));
    process.exit(0);
}

checkLaboratorioADL().catch(err => {
    console.error(err);
    process.exit(1);
});
