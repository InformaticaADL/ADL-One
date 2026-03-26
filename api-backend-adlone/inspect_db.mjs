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

async function check() {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query("SELECT TOP 10 * FROM rel_solicitud_tipo_permiso ORDER BY id_permiso_sol DESC");
        console.table(result.recordset);
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}
check();
