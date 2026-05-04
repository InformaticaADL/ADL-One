import { getConnection } from '../src/config/database.js';
import sql from 'mssql';

async function analyzePerms() {
    try {
        const pool = await getConnection();
        
        console.log('--- PERMISSIONS IN SUBMODULO "1. Ingreso y Consulta" ---');
        const res = await pool.request()
            .query(`
                SELECT id_permiso, codigo, nombre, modulo, submodulo, tipo, orden, habilitado
                FROM mae_permiso
                WHERE submodulo = '1. Ingreso y Consulta'
                ORDER BY orden
            `);
        
        res.recordset.forEach(p => {
            console.log(`${p.orden} | ${p.codigo} | ${p.nombre}`);
        });

        const maxOrden = await pool.request()
            .query("SELECT MAX(orden) as max_ord FROM mae_permiso WHERE submodulo = '1. Ingreso y Consulta'");
        
        console.log(`\nNext recommended order: ${(maxOrden.recordset[0].max_ord || 0) + 1}`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

analyzePerms();
