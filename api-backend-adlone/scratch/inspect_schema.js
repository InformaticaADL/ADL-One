import { getConnection } from '../src/config/database.js';
import sql from 'mssql';

async function inspectSchema() {
    const pool = await getConnection();
    const res = await pool.request()
        .query(`SELECT TOP 1 * FROM mae_centro`);
    
    console.log('--- COLUMNS IN mae_centro ---');
    console.log(Object.keys(res.recordset[0]).join(', '));
    
    const searchRes = await pool.request()
        .input('nombre', sql.VarChar, 'Lago Verde')
        .query(`SELECT TOP 5 * FROM mae_centro WHERE nombre_centro LIKE '%' + @nombre + '%'`);
    
    console.log('\n--- SEARCH RESULTS (TOP 5) ---');
    searchRes.recordset.forEach(r => {
        console.log(`ID: ${r.id_centro} | Nombre: "${r.nombre_centro}" | ID_Empresa: ${r.id_empresa}`);
        console.log(JSON.stringify(r, null, 2));
    });
    process.exit(0);
}

inspectSchema().catch(e => { console.error(e); process.exit(1); });
