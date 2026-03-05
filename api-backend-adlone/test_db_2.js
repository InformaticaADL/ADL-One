import sql from './src/config/database.js';
import { getConnection } from './src/config/database.js';
import fichaService from './src/services/ficha.service.js';

async function testQuery() {
    try {
        const pool = await getConnection();
        const fallbackEnc = await pool.request()
            .input('id', sql.Numeric(10, 0), 91)
            .query(`
                SELECT f.*,
                    e.nombre_empresaservicios,
                    em.nombre_empresa,
                    c.nombre_centro,
                    ta.nombre_tipoagua,
                    (SELECT u.nombre_usuario FROM mae_usuario u WHERE u.id_usuario = f.id_usuario) as nombre_usuario,
                    (SELECT r.nombre_region FROM mae_region r WHERE r.id_region = f.id_region) as nombre_region,
                    (SELECT co.nombre_comuna FROM mae_comuna co WHERE co.id_comuna = f.id_comuna) as nombre_comuna
                FROM App_Ma_FichaIngresoServicio_ENC f
                LEFT JOIN mae_empresaservicios e ON f.id_empresaservicio = e.id_empresaservicio
                LEFT JOIN mae_empresa em ON f.id_empresa = em.id_empresa
                LEFT JOIN mae_centro c ON f.id_centro = c.id_centro
                LEFT JOIN mae_tipoagua ta ON f.id_tipoagua = ta.id_tipoagua
                WHERE f.id_fichaingresoservicio = @id
            `);

        console.log("Fallback ENC length:", fallbackEnc.recordset.length);
        if (fallbackEnc.recordset.length > 0) {
            console.log("nombre_usuario:", fallbackEnc.recordset[0].nombre_usuario);
            console.log("nombre_region:", fallbackEnc.recordset[0].nombre_region);
            console.log("nombre_comuna:", fallbackEnc.recordset[0].nombre_comuna);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
testQuery();
