
import { getConnection } from './src/config/database.js';

async function inspect152() {
    const pool = await getConnection();
    const res = await pool.request().query(`
        SELECT s.id_solicitud, s.id_solicitante, s.id_tipo, s.datos_json,
               u.usuario as user_login, u.nombre_usuario as user_name,
               m.nombre_muestreador as sampler_name
        FROM mae_solicitud s
        LEFT JOIN mae_usuario u ON s.id_solicitante = u.id_usuario
        LEFT JOIN mae_muestreador m ON s.id_solicitante = m.id_muestreador
        WHERE s.id_solicitud = 152
    `);
    console.log(JSON.stringify(res.recordset[0], null, 2));
    process.exit(0);
}

inspect152().catch(err => {
    console.error(err);
    process.exit(1);
});
