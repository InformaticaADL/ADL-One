
import { getConnection } from './src/config/database.js';

async function checkBody() {
    const pool = await getConnection();
    const res = await pool.request().query("SELECT cuerpo_template_html FROM mae_evento_notificacion WHERE codigo_evento = 'AVISO_PERDIDO_NUEVO'");
    console.log(res.recordset[0].cuerpo_template_html);
    process.exit(0);
}

checkBody().catch(err => {
    console.error(err);
    process.exit(1);
});
