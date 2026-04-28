import dotenv from 'dotenv';
dotenv.config();
const { getConnection } = await import('./src/config/database.js');

// ALL tables from MaestrosHub config
const tables = [
    'mae_empresa', 'mae_empresaservicios', 'mae_contacto',
    'mae_cargo', 'mae_rol', 'mae_usuario',
    'mae_tipomuestra_ma', 'mae_subarea', 'mae_objetivomuestreo_ma',
    'mae_tipomuestreo', 'mae_actividadmuestreo', 'mae_tipodescarga',
    'mae_inspectorambiental', 'mae_muestreador', 'mae_coordinador',
    'mae_centro', 'mae_modalidad', 'mae_frecuencia', 'mae_estadomuestreo',
    'mae_equipo', 'mae_instrumentoambiental', 'mae_umedida',
    'mae_lugaranalisis', 'mae_formacanal', 'mae_dispositivohidraulico',
    'mae_solicitud_tipo', 'mae_permiso', 'mae_notificacion_regla', 'mae_evento_notificacion'
];

async function check() {
    const pool = await getConnection();
    const ok = [], errors = [];
    for (const t of tables) {
        try {
            const r = await pool.request().query(`SELECT TOP 1 * FROM ${t}`);
            const cols = r.recordset.length > 0 ? Object.keys(r.recordset[0]) : ['<EMPTY>'];
            const count = await pool.request().query(`SELECT COUNT(*) as n FROM ${t}`);
            ok.push({ table: t, rows: count.recordset[0].n, cols: cols.join(', ') });
        } catch(e) {
            errors.push(t);
        }
    }
    console.log('\n✅ TABLAS QUE EXISTEN:');
    for (const r of ok) console.log(`  [${r.rows} rows] ${r.table}\n    → ${r.cols}`);
    console.log('\n❌ TABLAS QUE NO EXISTEN:');
    for (const t of errors) console.log(`  ${t}`);
    process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
