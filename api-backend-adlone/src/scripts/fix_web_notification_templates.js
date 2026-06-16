import dotenv from 'dotenv';
dotenv.config();

/**
 * Corrige plantillas web (mae_notificacion_regla) que muestran información
 * incorrecta o incongruente:
 *  - id_regla 55, 72 (SOLICITUD_COMENTARIO_NUEVO): {{id_usuario}} (ID numérico) -> {{usuario_accion}} (nombre)
 *  - id_regla 56 (SOLICITUD_ESTADO_CAMBIO): {{estado}} (código crudo, ej. "EN_REVISION") -> {{estado_legible}},
 *    y se quita el "{{observaciones}}" final que dejaba un punto colgando cuando venía vacío.
 *  - id_regla 81 (AVISO_CONSULTA_FICHA_NUEVA): {{equipo_nombre}} (no aplica a este evento) -> #{{correlativo}}
 */
async function run() {
    const { getConnection, closeConnection } = await import('../config/database.js');
    try {
        const pool = await getConnection();

        const updates = [
            {
                id_regla: 55,
                plantilla_web: 'Has recibido un nuevo comentario de {{usuario_accion}} en tu solicitud.',
            },
            {
                id_regla: 72,
                plantilla_web: 'Has recibido un nuevo comentario de {{usuario_accion}} en tu solicitud.',
            },
            {
                id_regla: 56,
                plantilla_web: 'Tu solicitud ha cambiado a estado: {{estado_legible}}.',
            },
            {
                id_regla: 81,
                plantilla_web: '{{usuario_accion}} realizó una consulta técnica sobre el servicio #{{correlativo}}.',
            },
        ];

        for (const u of updates) {
            const result = await pool.request()
                .input('id', u.id_regla)
                .input('plantilla', u.plantilla_web)
                .query(`
                    UPDATE mae_notificacion_regla
                    SET plantilla_web = @plantilla
                    WHERE id_regla = @id
                `);
            console.log(`id_regla ${u.id_regla}: ${result.rowsAffected[0]} fila(s) actualizada(s)`);
        }

        // Verificación
        const verify = await pool.request().query(`
            SELECT id_regla, codigo_evento, plantilla_web_titulo, plantilla_web
            FROM mae_notificacion_regla
            WHERE id_regla IN (55, 72, 56, 81)
            ORDER BY id_regla
        `);
        console.log(JSON.stringify(verify.recordset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await closeConnection();
    }
}
run();
