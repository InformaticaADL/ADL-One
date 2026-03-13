const sql = require('mssql');
const dotenv = require('dotenv');
dotenv.config({ path: 'c:/Users/rdiaz/Desktop/PrAdl/ADL-One/api-backend-adlone/.env' });

async function checkCols() {
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            options: { encrypt: false, trustServerCertificate: true },
            port: parseInt(process.env.DB_PORT || '1433')
        });

        let result = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'App_Ma_FichaIngresoServicio_ENC'");
        console.log('Columns:');
        result.recordset.forEach(row => {
            console.log(row.COLUMN_NAME);
        });
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

checkCols();


checkCols();
