import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT, 10),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        let pool = await sql.connect(config);
        
        console.log('--- Inspecting Triggers ---');
        let triggers = await pool.request().query("SELECT name, OBJECT_DEFINITION(object_id) as definition FROM sys.triggers WHERE is_ms_shipped = 0");
        
        for (const row of triggers.recordset) {
            const def = row.definition || '';
            if (def.toLowerCase().includes('cta') || def.toLowerCase().includes('request') || def.toLowerCase().includes('json')) {
                console.log(`[Trigger Match] Name: ${row.name}`);
                console.log(def);
            }
        }

        console.log('Done');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
