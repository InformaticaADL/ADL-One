import { getConnection } from '../src/config/database.js';
import sql from 'mssql';

async function searchLagoVerde() {
    const pool = await getConnection();
    const res = await pool.request()
        .input('nombre', sql.VarChar, 'Lago Verde')
        .query(`
            SELECT c.id_centro, c.nombre_centro, c.direccion, c.ubicacion, c.id_empresa, e.nombre_empresa
            FROM mae_centro c
            LEFT JOIN mae_empresa e ON c.id_empresa = e.id_empresa
            WHERE c.nombre_centro LIKE '%' + @nombre + '%'
        `);
    
    console.log('--- SEARCH RESULTS ---');
    res.recordset.forEach(r => {
        console.log(`ID: ${r.id_centro} | Nombre: "${r.nombre_centro}" | Cliente: "${r.nombre_empresa}" (ID: ${r.id_empresa})`);
        console.log(`  Dirección: "${r.direccion}" | Ubicación: "${r.ubicacion}"`);
    });
    process.exit(0);
}

searchLagoVerde().catch(e => { console.error(e); process.exit(1); });
