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
        const res1 = await pool.request().query("SELECT id_empresa, nombre_empresa FROM mae_empresa WHERE nombre_empresa LIKE '%Chalhuamapu%'");
        console.log("CLIENTE (mae_empresa):", res1.recordset);
        
        const res2 = await pool.request().query("SELECT id_empresaservicio, nombre_empresaservicios FROM mae_empresaservicios WHERE nombre_empresaservicios LIKE '%Chalhuamapu%'");
        console.log("EMPRESA SERVICIO (mae_empresaservicios):", res2.recordset);
        pool.close();
    } catch (e) { console.error(e); }
})();
