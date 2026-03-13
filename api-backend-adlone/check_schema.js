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

        console.log("Searching for Salmones Aysen...");
        const res1 = await pool.request().query("SELECT id_empresaservicio, nombre_empresaservicios, contacto_empresaservicios, email_contacto, email_empresaservicios FROM mae_empresaservicios WHERE nombre_empresaservicios LIKE '%Salmones Aysen%'");
        console.log("RESULTS:", JSON.stringify(res1.recordset, null, 2));

        pool.close();
    } catch (e) { console.error(e); }
})();
