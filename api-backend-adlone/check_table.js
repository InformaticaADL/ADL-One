import dotenv from 'dotenv';
dotenv.config();

const { getConnection } = await import('./src/config/database.js');

async function checkTable() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT TOP 1 * FROM mae_empresaservicios");
        console.log('COLUMNAS DETECTADAS:');
        if (result.recordset.length > 0) {
            console.log(JSON.stringify(Object.keys(result.recordset[0]), null, 2));
            console.log('\nVALORES DE EJEMPLO:');
            console.log(JSON.stringify(result.recordset[0], null, 2));
        } else {
            // Si no hay datos, consultar información de esquema
            const schema = await pool.request().query(`
                SELECT COLUMN_NAME, DATA_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'mae_empresaservicios'
            `);
            console.log(JSON.stringify(schema.recordset, null, 2));
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTable();
