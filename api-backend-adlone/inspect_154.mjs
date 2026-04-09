
import { getConnection } from './src/config/database.js';

async function inspect154() {
    const pool = await getConnection();
    const res = await pool.request().query(`
        SELECT s.id_solicitud, s.id_solicitante, s.id_tipo, s.datos_json,
               t.nombre as tipo_nombre,
               m.nombre_muestreador as sampler_name,
               u.usuario as user_login
        FROM mae_solicitud s
        JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
        LEFT JOIN mae_muestreador m ON s.id_solicitante = m.id_muestreador
        LEFT JOIN mae_usuario u ON s.id_solicitante = u.id_usuario
        WHERE s.id_solicitud = 154
    `);
    console.log(JSON.stringify(res.recordset[0], null, 2));
    process.exit(0);
}

inspect154().catch(err => {
    console.error(err);
    process.exit(1);
});
