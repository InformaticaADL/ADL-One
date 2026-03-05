import { getConnection } from './src/config/database.js';

async function queryFichaDetails() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT TOP 5
                f.id_fichaingresoservicio,
                e.nombre_empresaservicio,
                c.nombre_centro,
                f.instrumento_ambiental,
                (SELECT COUNT(*) FROM App_Ma_Agenda_MUESTREOS a WHERE a.id_fichaingresoservicio = f.id_fichaingresoservicio) as cantidad_agendas
            FROM App_Ma_FichaIngresoServicio_ENC f
            LEFT JOIN mae_empresaservicio e ON f.id_empresaservicio = e.id_empresaservicio
            LEFT JOIN mae_centro c ON f.id_centro = c.id_centro
            WHERE f.id_fichaingresoservicio IN (
                SELECT TOP 100 id_fichaingresoservicio FROM App_Ma_Agenda_MUESTREOS ORDER BY id_agendamam DESC
            )
        `);
        console.table(result.recordset);

        const agendaResult = await pool.request().query(`
            SELECT TOP 5
                id_agendamam,
                id_fichaingresoservicio,
                dia, mes, ano,
                id_inspectorambiental,
                id_muestreador,
                frecuencia
            FROM App_Ma_Agenda_MUESTREOS
            ORDER BY id_agendamam DESC
        `);
        console.table(agendaResult.recordset);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

queryFichaDetails();
