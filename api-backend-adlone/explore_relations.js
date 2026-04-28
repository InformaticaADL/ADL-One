import dotenv from 'dotenv';
dotenv.config();

const { getConnection } = await import('./src/config/database.js');

async function explore() {
    try {
        const pool = await getConnection();
        const targets = [
            { kw: 'comuna', table: 'mae_comuna' },
            { kw: 'region', table: 'mae_region' },
            { kw: 'giro', table: 'mae_giro' },
            { kw: 'pago', table: 'mae_formapago' },
            { kw: 'precio', table: 'mae_listaprecio' },
            { kw: 'ciudad', table: 'mae_ciudad' }
        ];
        for (const t of targets) {
            console.log(`\n--- Buscando "${t.kw}" ---`);
            const res = await pool.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%${t.kw}%'`);
            console.log('Tablas encontradas:', res.recordset.map(r => r.TABLE_NAME));

            for (const found of res.recordset) {
                try {
                    const data = await pool.request().query(`SELECT TOP 3 * FROM ${found.TABLE_NAME}`);
                    console.log(`Data de ${found.TABLE_NAME}:`, data.recordset.length > 0 ? 'EXISTE DATA' : 'VACÍA');
                    if (data.recordset.length > 0) {
                        console.log('Columnas:', Object.keys(data.recordset[0]));
                    }
                } catch (e) {
                    console.log(`Error leyendo ${found.TABLE_NAME}`);
                }
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

explore();
