
import { getConnection } from './src/config/database.js';

async function checkADLApps() {
    const pool = await getConnection();
    const res = await pool.request().query("USE ADLApps; SELECT name FROM sys.tables WHERE name = 'mae_solicitud'");
    if (res.recordset.length > 0) {
        const top5 = await pool.request().query("USE ADLApps; SELECT TOP 5 id_solicitud, id_tipo, datos_json, fecha_creacion FROM mae_solicitud ORDER BY id_solicitud DESC");
        console.log(JSON.stringify(top5.recordset, null, 2));
    } else {
        console.log('mae_solicitud not in ADLApps');
    }
    process.exit(0);
}

checkADLApps().catch(err => {
    console.error(err);
    process.exit(1);
});
