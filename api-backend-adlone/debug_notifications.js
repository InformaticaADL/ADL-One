
import { getConnection } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkRecipients() {
    try {
        const pool = await getConnection();
        const events = [
            'SOL_EQUIPO_ALTA_APR',
            'SOL_EQUIPO_TRASPASO_APR',
            'SOL_EQUIPO_BAJA_APR',
            'SOL_EQUIPO_REAC_APR'
        ];

        console.log('--- Configured Recipients ---');

        for (const code of events) {
            console.log(`\nEvent: ${code}`);

            // Get Event ID
            const eventRes = await pool.request().query(`SELECT id_evento FROM mae_evento_notificacion WHERE codigo_evento = '${code}'`);
            if (eventRes.recordset.length === 0) {
                console.log('Event not found.');
                continue;
            }
            const eventId = eventRes.recordset[0].id_evento;

            // Get Recipients
            const recipients = await pool.request().query(`
                SELECT r.tipo_envio,
                       CASE WHEN r.id_usuario IS NOT NULL THEN u.nombre_usuario ELSE 'ROLE: ' + rol.nombre_rol END as recipient,
                       u.correo_electronico
                FROM rel_evento_destinatario r
                LEFT JOIN mae_usuario u ON r.id_usuario = u.id_usuario
                LEFT JOIN mae_rol rol ON r.id_rol = rol.id_rol
                WHERE r.id_evento = ${eventId}
            `);

            if (recipients.recordset.length === 0) {
                console.log('No recipients configured.');
            } else {
                recipients.recordset.forEach(r => {
                    console.log(`- ${r.tipo_envio}: ${r.recipient} (${r.correo_electronico || 'N/A'})`);
                });
            }
        }

        console.log('\n--- Checking User: vremolcoy ---');
        const userRes = await pool.request().query("SELECT id_usuario, nombre_usuario, correo_electronico FROM mae_usuario WHERE nombre_usuario LIKE '%remolcoy%' OR correo_electronico LIKE '%remolcoy%'");
        console.log(userRes.recordset);

        console.log('\n--- Latest Approved Request ---');
        const reqRes = await pool.request().query(`
            SELECT TOP 1 s.id_solicitud, s.tipo_solicitud, s.fecha_solicitud, s.usuario_solicita, u.nombre_usuario as solicitante, u.correo_electronico
            FROM mae_solicitud_equipo s
            JOIN mae_usuario u ON s.usuario_solicita = u.id_usuario
            WHERE s.estado = 'APROBADO'
            ORDER BY s.fecha_solicitud DESC
        `);
        console.log(reqRes.recordset);
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkRecipients();
