import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/rdiaz/Desktop/PrAdl/ADL-One/api-backend-adlone/.env' });
(async () => {
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            options: { encrypt: false, trustServerCertificate: true },
            port: parseInt(process.env.DB_PORT || '1433')
        });
        const res = await pool.request().query("SELECT id_empresa, nombre_empresa, id_empresaservicio FROM mae_empresa WHERE nombre_empresa LIKE '%Chalhua%'");
        console.log(res.recordset);
        pool.close();
    } catch (e) { console.error(e); }
})();
