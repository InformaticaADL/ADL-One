
import { getConnection } from './api-backend-adlone/src/config/database.js';
import sql from 'mssql';

async function checkTemplate() {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('code', sql.VarChar, 'SOL_EQUIPO_REVISION_NUEVA')
            .query("SELECT cuerpo_template_html FROM MAE_EVENTO_NOTIFICACION WHERE codigo_evento = @code");
        
        if (result.recordset.length > 0) {
            console.log("TEMPLATE CONTENT:");
            console.log(result.recordset[0].cuerpo_template_html);
        } else {
            console.log("Template not found");
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTemplate();
