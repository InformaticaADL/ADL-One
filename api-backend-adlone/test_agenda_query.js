import { getConnection, closeConnection } from './src/config/database.js';

async function testQuery() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT TOP 10
                a.id_agendamam,
                a.fecha_muestreo,
                a.mes,
                a.ano,
                a.id_inspectorambiental as id_muestreador,
                f.id_fichaingresoservicio,
                f.id_empresaservicio,
                e.nombre_fantasia as empresa_nombre,
                f.id_centro,
                c.nombre_centro as centro_nombre,
                f.instrumento_ambiental as objetivo
            FROM App_Ma_Agenda_MUESTREOS a
            LEFT JOIN App_Ma_FichaIngresoServicio_ENC f ON a.id_fichaingresoservicio = f.id_fichaingresoservicio
            LEFT JOIN mae_empresa e ON f.id_empresaservicio = e.id_empresaservicio
            LEFT JOIN mae_centro c ON f.id_centro = c.id_centro
            ORDER BY a.id_agendamam DESC
        `);
        console.log(result.recordset);
        await closeConnection();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testQuery();
