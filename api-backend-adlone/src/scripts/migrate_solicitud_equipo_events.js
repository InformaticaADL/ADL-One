import dotenv from 'dotenv';
dotenv.config();
import { getConnection, closeConnection } from '../config/database.js';

const TEMPLATE = `
<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px; font-family: Arial, sans-serif;">
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Solicitante:</strong> <span style="color: #475569;">{SOLICITANTE}</span></td></tr>
    <tr><td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-family: Arial, sans-serif;"><strong>Responsable / Asignado:</strong> <span style="color: #475569;">{RESPONSABLE}</span></td></tr>
</table>

{EQUIPOS_DETALLE}

{BLOQUE_OBSERVACION|Observaciones/Motivo}
`;

async function migrate() {
    try {
        console.log('Connecting to DB...');
        const pool = await getConnection();
        
        console.log('Fetching SOL_EQUIPO events...');
        const result = await pool.request().query("SELECT codigo_evento FROM mae_evento_notificacion WHERE codigo_evento LIKE 'SOL_EQUIPO_%'");
        const events = result.recordset.map(r => r.codigo_evento);
        console.log(`Found ${events.length} events to migrate.`);

        for (const eventCode of events) {
            let html = TEMPLATE.trim();
            
            await pool.request()
                .input('code', eventCode)
                .input('html', html)
                .query('UPDATE mae_evento_notificacion SET cuerpo_template_html = @html WHERE codigo_evento = @code');
            console.log(`- Updated ${eventCode}`);
        }
        
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await closeConnection();
    }
}

migrate();
