const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'MGmerlin.10',
    server: '192.168.10.5',
    database: 'PruebasInformatica',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        await sql.connect(config);
        const id = 130;

        console.log(`\n=== FINAL AUDIT: FICHA ${id} ===`);

        // 1. Header (ENC)
        const enc = await sql.query(`
            SELECT 
                f.id_fichaingresoservicio,
                f.fichaingresoservicio as correlativo,
                f.id_empresa as id_cliente,
                e.nombre_empresa as cliente_nombre,
                f.id_empresaservicio,
                es.nombre_empresaservicios as servicio_nombre,
                f.id_subarea,
                sa.nombre_subarea,
                f.id_validaciontecnica,
                f.estado_ficha
            FROM App_Ma_FichaIngresoServicio_ENC f
            LEFT JOIN mae_empresa e ON f.id_empresa = e.id_empresa
            LEFT JOIN mae_empresaservicios es ON f.id_empresaservicio = es.id_empresaservicio
            LEFT JOIN mae_subarea sa ON f.id_subarea = sa.id_subarea
            WHERE f.id_fichaingresoservicio = ${id}
        `);
        console.log('--- ENCABEZADO (ENC) ---');
        console.dir(enc.recordset, { depth: null });

        // 2. Agenda (MUESTREOS)
        const agenda = await sql.query(`
            SELECT 
                id_agendamam,
                frecuencia_correlativo,
                estado_caso
            FROM App_Ma_Agenda_MUESTREOS
            WHERE id_fichaingresoservicio = ${id}
        `);
        console.log('\n--- AGENDA (MUESTREOS) ---');
        console.dir(agenda.recordset, { depth: null });

        // 3. Detail (DET) - Analysis
        const det = await sql.query(`
            SELECT 
                d.id_det_fichaingresoservicio,
                d.id_referenciaanalisis,
                ra.nombre_referenciaanalisis as analisis_nombre,
                d.id_normativa,
                n.nombre_normativa as normativa,
                d.id_normativareferencia as id_tabla,
                nr.nombre_normativareferencia as tabla_nombre,
                d.id_laboratorioensayo,
                d.tipo_analisis
            FROM App_Ma_FichaIngresoServicio_DET d
            LEFT JOIN mae_referenciaanalisis ra ON d.id_referenciaanalisis = ra.id_referenciaanalisis
            LEFT JOIN mae_normativa n ON d.id_normativa = n.id_normativa
            LEFT JOIN mae_normativareferencia nr ON d.id_normativareferencia = nr.id_normativareferencia
            WHERE d.id_fichaingresoservicio = ${id}
        `);
        console.log('\n--- DETALLE (ANALISIS) ---');
        console.dir(det.recordset, { depth: null });

    } catch (err) {
        console.error(err);
    } finally {
        await sql.close();
    }
}

run();
