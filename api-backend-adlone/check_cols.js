import dotenv from 'dotenv';
dotenv.config();

const { getConnection } = await import('./src/config/database.js');

async function checkCols() {
    const pool = await getConnection();
    const tables = ['mae_permiso', 'mae_notificacion_regla', 'mae_evento_notificacion'];
    for (const t of tables) {
        try {
            const r = await pool.request().query(`SELECT TOP 1 * FROM ${t}`);
            const row = r.recordset[0] || {};
            console.log(`\nTABLE: ${t}`);
            console.log('  COLS:', Object.keys(row).join(', '));
            console.log('  DATA:', JSON.stringify(row).substring(0, 300));
        } catch(e) {
            console.log(`TABLE: ${t} -> ERROR:`, e.message);
        }
    }
    process.exit(0);
}
checkCols().catch(e => { console.error(e); process.exit(1); });
