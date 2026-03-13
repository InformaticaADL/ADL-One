const sql = require('mssql');
const dotenv = require('dotenv');
dotenv.config({ path: 'c:/Users/rdiaz/Desktop/PrAdl/ADL-One/api-backend-adlone/.env' });

async function migrate() {
    try {
        const pool = await sql.connect({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            options: { encrypt: false, trustServerCertificate: true },
            port: parseInt(process.env.DB_PORT || '1433')
        });

        console.log('Adding columns to App_Ma_FichaIngresoServicio_ENC...');
        
        await pool.request().query("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('App_Ma_FichaIngresoServicio_ENC') AND name = 'id_um_formacanal') ALTER TABLE App_Ma_FichaIngresoServicio_ENC ADD id_um_formacanal INT;");
        await pool.request().query("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('App_Ma_FichaIngresoServicio_ENC') AND name = 'id_um_dispositivohidraulico') ALTER TABLE App_Ma_FichaIngresoServicio_ENC ADD id_um_dispositivohidraulico INT;");
        
        console.log('✅ Columns added successfully.');
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}

migrate();
