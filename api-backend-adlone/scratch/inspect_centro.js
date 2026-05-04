import { getConnection } from '../src/config/database.js';
import sql from 'mssql';

async function inspectCentro() {
    const pool = await getConnection();
    const res = await pool.request()
        .input('nombre', sql.VarChar, 'Piscicultura Lago Verde')
        .query("SELECT * FROM mae_centro WHERE nombre_centro LIKE '%' + @nombre + '%'");
    
    console.log('--- DATA FROM mae_centro ---');
    if (res.recordset.length === 0) {
        console.log('No se encontró el centro.');
    } else {
        res.recordset.forEach(r => {
            console.log(`ID: ${r.id_centro}`);
            console.log(`Nombre: "${r.nombre_centro}"`);
            console.log(`Dirección: "${r.direccion}"`);
            console.log(`Ubicación: "${r.ubicacion}"`);
            console.log(`---`);
        });
    }
    process.exit(0);
}

inspectCentro().catch(e => { console.error(e); process.exit(1); });
