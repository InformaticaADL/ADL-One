
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function search() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT codigo_evento, cuerpo_template_html FROM MAE_EVENTO_NOTIFICACION WHERE cuerpo_template_html LIKE '%cta_text%' OR cuerpo_template_html LIKE '%Go to Request%'");
        console.log(JSON.stringify(result.recordset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

search();
