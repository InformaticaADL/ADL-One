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
        const result = await pool.request().query('SELECT TOP 1 * FROM mae_empresaservicios');
        console.log("COLUMNS:");
        console.log(Object.keys(result.recordset[0]));
        console.log("FIRST ROW:");
        console.log(result.recordset[0]);
        pool.close();
    } catch (e) { console.error(e); }
})();
