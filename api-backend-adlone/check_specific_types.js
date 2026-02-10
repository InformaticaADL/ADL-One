import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkData() {
    try {
        const pool = await getConnection();
        const types = ['Analizador', 'Balanza', 'Cámara Fotográfica', 'Centrífuga', 'GPS', 'Instrumento', 'Medidor', 'Multiparámetro', 'Phmetro', 'Sonda'];
        const result = await pool.request().query(`
            SELECT tipoequipo, sigla, COUNT(*) as count 
            FROM mae_equipo 
            WHERE tipoequipo IN (${types.map(t => `'${t}'`).join(',')})
            GROUP BY tipoequipo, sigla
            ORDER BY tipoequipo, count DESC
        `);
        console.log(JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkData();
