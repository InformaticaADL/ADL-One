import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkData() {
    try {
        const pool = await getConnection();
        const types = ['Analizador', 'Balanza', 'Cámara', 'Centrífuga', 'GPS', 'Instrumento', 'Medidor', 'Multiparámetro', 'Phmetro', 'Sonda'];
        let query = 'SELECT DISTINCT tipoequipo, sigla FROM mae_equipo WHERE ';
        query += types.map(t => `tipoequipo LIKE '%${t}%'`).join(' OR ');
        query += ' ORDER BY tipoequipo';

        const result = await pool.request().query(query);
        console.log(JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkData();
