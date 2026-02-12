
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function run() {
    try {
        const pool = await getConnection();
        console.log('Connected to database.');

        // Update all SOL_EQUIPO templates to include {EQUIPOS_DETALLE} before the signature/footer
        const updateQuery = `
            UPDATE mae_evento_notificacion
            SET cuerpo_template_html = REPLACE(cuerpo_template_html, 
                '</div></td></tr><tr><td style="padding:25px 40px;background-color:#f8fafc;', 
                '{EQUIPOS_DETALLE}</div></td></tr><tr><td style="padding:25px 40px;background-color:#f8fafc;')
            WHERE codigo_evento LIKE 'SOL_EQUIPO_%'
            AND cuerpo_template_html NOT LIKE '%{EQUIPOS_DETALLE}%'
        `;

        const result = await pool.request().query(updateQuery);
        console.log(`Updated ${result.rowsAffected[0]} templates with {EQUIPOS_DETALLE} placeholder.`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
