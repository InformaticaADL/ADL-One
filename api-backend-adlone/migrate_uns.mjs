import { getConnection } from './src/config/database.js';

async function run() {
    try {
        const pool = await getConnection();
        
        // 1. Add plantilla_web_titulo if not exists
        const checkColumn = await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'mae_notificacion_regla' 
                AND COLUMN_NAME = 'plantilla_web_titulo'
            )
            BEGIN
                ALTER TABLE mae_notificacion_regla ADD plantilla_web_titulo NVARCHAR(200) NULL
            END
        `);
        console.log('Column plantilla_web_titulo ensured');

        // 2. Migration: Copy data from rel_evento_destinatario to mae_notificacion_regla
        // Defaulting to envia_email = 1 and envia_web = 0 to preserve current behavior without sudden spam
        const migrate = await pool.request().query(`
            INSERT INTO mae_notificacion_regla (codigo_evento, id_rol_destino, id_usuario_destino, envia_email, envia_web, estado)
            SELECT 
                (SELECT codigo_evento FROM mae_evento_notificacion WHERE id_evento = r.id_evento),
                r.id_rol,
                r.id_usuario,
                1, -- envia_email
                0, -- envia_web (off by default for legacy)
                1  -- active
            FROM rel_evento_destinatario r
            WHERE NOT EXISTS (
                SELECT 1 FROM mae_notificacion_regla nr 
                WHERE nr.codigo_evento = (SELECT codigo_evento FROM mae_evento_notificacion WHERE id_evento = r.id_evento)
                AND (nr.id_rol_destino = r.id_rol OR (nr.id_rol_destino IS NULL AND r.id_rol IS NULL))
                AND (nr.id_usuario_destino = r.id_usuario OR (nr.id_usuario_destino IS NULL AND r.id_usuario IS NULL))
            )
        `);
        console.log('Migration from rel_evento_destinatario completed');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
