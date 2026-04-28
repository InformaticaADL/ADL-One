import dotenv from 'dotenv';
dotenv.config();

const { getConnection } = await import('./src/config/database.js');

async function explore() {
    try {
        const pool = await getConnection();
        const keywords = ['direccion', 'giro', 'ciudad', 'pago', 'precio', 'comuna', 'empresa'];
        console.log('BUSCANDO TABLAS RELACIONADAS:');
        for (const kw of keywords) {
            const res = await pool.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%${kw}%'`);
            console.log(`Keyword "${kw}":`, res.recordset.map(t => t.TABLE_NAME));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

explore();
