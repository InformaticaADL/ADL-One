
import { getConnection } from './src/config/database.js';

async function emulateQuery() {
    const pool = await getConnection();
    const idSolicitud = 155;
    const res = await pool.request()
        .input('id', 155)
        .query(`
            SELECT s.*, t.nombre as nombre_tipo, 
                   COALESCE(m.nombre_muestreador, u.nombre_usuario, u.usuario, 'Desconocido') as nombre_solicitante
            FROM mae_solicitud s
            JOIN mae_solicitud_tipo t ON s.id_tipo = t.id_tipo
            LEFT JOIN mae_muestreador m ON s.id_solicitante = m.id_muestreador
            LEFT JOIN mae_usuario u ON s.id_solicitante = u.id_usuario
            WHERE s.id_solicitud = @id
        `);
    console.log(JSON.stringify(res.recordset[0], null, 2));
    process.exit(0);
}

emulateQuery().catch(err => {
    console.error(err);
    process.exit(1);
});
