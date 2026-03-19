import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function seed() {
    try {
        const pool = await getConnection();
        console.log("Seeding UNS Rules for Communication & Traceability...");

        const rules = [
            // Evento: Nuevo Comentario
            {
                codigo_evento: 'SOLICITUD_COMENTARIO_NUEVO',
                envia_email: 1,
                envia_web: 1,
                plantilla_web_titulo: "Nuevo Mensaje en #{{id_solicitud}}",
                plantilla_web: "Has recibido un nuevo comentario de {{id_usuario}} en tu solicitud."
            },
            // Evento: Cambio de Estado
            {
                codigo_evento: 'SOLICITUD_ESTADO_CAMBIO',
                envia_email: 1,
                envia_web: 1,
                plantilla_web_titulo: "Estado Actualizado: #{{id_solicitud}}",
                plantilla_web: "Tu solicitud ha cambiado a estado: {{estado}}. {{observaciones}}"
            },
            // Evento: Derivación
            {
                codigo_evento: 'SOLICITUD_DERIVACION',
                envia_email: 1,
                envia_web: 1,
                plantilla_web_titulo: "Solicitud Derivada: #{{id_solicitud}}",
                plantilla_web: "Se ha derivado una solicitud desde {{area_origen}} hacia {{area_destino}}: {{motivo}}"
            }
        ];

        for (const rule of rules) {
            await pool.request()
                .input('code', sql.VarChar(50), rule.codigo_evento)
                .input('email', sql.Bit, rule.envia_email)
                .input('web', sql.Bit, rule.envia_web)
                .input('title', sql.NVarChar(200), rule.plantilla_web_titulo)
                .input('msg', sql.NVarChar(sql.MAX), rule.plantilla_web)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM mae_notificacion_regla WHERE codigo_evento = @code)
                    BEGIN
                        INSERT INTO mae_notificacion_regla (codigo_evento, envia_email, envia_web, plantilla_web_titulo, plantilla_web, estado)
                        VALUES (@code, @email, @web, @title, @msg, 1)
                    END
                    ELSE
                    BEGIN
                        UPDATE mae_notificacion_regla 
                        SET envia_email = @email, envia_web = @web, 
                            plantilla_web_titulo = @title, plantilla_web = @msg
                        WHERE codigo_evento = @code
                    END
                `);
        }

        console.log("Success! Communication rules seeded.");
        process.exit(0);
    } catch (err) {
        console.error("Seed failed:", err);
        process.exit(1);
    }
}

seed();
