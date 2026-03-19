import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || 'ADL_ONE_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function checkSchema() {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mae_solicitud_adjunto'");
        console.log(JSON.stringify(result.recordset, null, 2));
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
