
import { getConnection } from './src/config/database.js';

async function checkTemplates() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT codigo_evento, asunto_template FROM mae_evento_notificacion WHERE codigo_evento IN ('AVISO_PERDIDO_NUEVO', 'AVISO_PROBLEMA_NUEVO')");
    console.log(JSON.stringify(res.recordset, null, 2));
    process.exit(0);
}

checkTemplates().catch(err => {
    console.error(err);
    process.exit(1);
});
