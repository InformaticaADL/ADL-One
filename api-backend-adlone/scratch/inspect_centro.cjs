const { getConnection } = require('../config/database.js');
const sql = require('mssql');

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
}

inspectCentro().catch(console.error);
