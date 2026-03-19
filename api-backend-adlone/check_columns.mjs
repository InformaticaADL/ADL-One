import mssql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '1nformatica.2024',
    server: process.env.DB_SERVER || 'WS2016',
    database: process.env.DB_NAME || 'PruebasInformatica',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function check() {
    try {
        let pool = await mssql.connect(config);
        console.log('--- Columns in mae_solicitud ---');
        let res = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_solicitud'");
        console.log(res.recordset.map(r => r.COLUMN_NAME));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
