import dotenv from 'dotenv';
dotenv.config();

const { getConnection } = await import('./src/config/database.js');

async function findRelatedTables() {
    try {
        const pool = await getConnection();
        const keywords = ['giro', 'pago', 'ciudad', 'precio', 'comuna', 'direccion', 'forma'];
        
        console.log('BUSCANDO TABLAS RELACIONADAS POR PALABRAS CLAVE:');
        for (const kw of keywords) {
            const res = await pool.request().query(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME LIKE '%${kw}%'
            `);
            if (res.recordset.length > 0) {
                console.log(`Keyword "${kw}":`, res.recordset.map(t => t.TABLE_NAME));
            }
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findRelatedTables();
