import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';

async function query() {
    const { getConnection, closeConnection } = await import('../config/database.js');
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT id_evento, codigo_evento, descripcion, id_funcionalidad, oculto_en_hub, es_transaccional, asunto_template
            FROM mae_evento_notificacion
            WHERE codigo_evento IN ('FICHA_ASIGNADA', 'FICHA_MUESTREO_COMPLETADO')
        `);
        const cfg = await pool.request().query(`
            SELECT c.*
            FROM cfg_notificacion_config c
            JOIN mae_evento_notificacion e ON e.id_evento = c.id_evento
            WHERE e.codigo_evento IN ('FICHA_ASIGNADA', 'FICHA_MUESTREO_COMPLETADO')
        `);
        fs.writeFileSync('db_muestreadores_events.json', JSON.stringify({ eventos: result.recordset, configs: cfg.recordset }, null, 2), 'utf8');
        console.log('Saved to db_muestreadores_events.json');
    } catch (err) {
        console.error(err);
    } finally {
        await closeConnection();
    }
}
query();
