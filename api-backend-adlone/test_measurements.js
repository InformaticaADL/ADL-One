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

        console.log("--- DATA from mae_umedida ---");
        const umedida = await pool.request().query("SELECT TOP 100 * FROM mae_umedida");
        console.log("UMEDIDA:", JSON.stringify(umedida.recordset, null, 2));

        console.log("\n--- Searching for any other 'tipo' + 'medida' tables ---");
        const otherTables = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%tipo%' AND TABLE_NAME LIKE '%med%'");
        console.log("OTHER TABLES:", otherTables.recordset.map(r => r.TABLE_NAME));

        console.log("\n--- Definition of Consulta_Mae_Formacanal ---");
        const defCanal = await pool.request().query("SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('Consulta_Mae_Formacanal')");
        console.log("DEF CANAL:", defCanal.recordset[0]?.definition);

        console.log("\n--- Definition of Consulta_Mae_Dispositivohidraulico ---");
        const defDisp = await pool.request().query("SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('Consulta_Mae_Dispositivohidraulico')");
        console.log("DEF DISP:", defDisp.recordset[0]?.definition);

        pool.close();
    } catch (e) { console.error(e); }
})();
