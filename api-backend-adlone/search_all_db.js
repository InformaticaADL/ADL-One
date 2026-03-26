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

async function test() {
    try {
        let pool = await sql.connect(config);
        let result = await pool.request().query(`
            SELECT t.name AS table_name, c.name AS column_name
            FROM sys.tables t
            JOIN sys.columns c ON t.object_id = c.object_id
            JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            WHERE ty.name IN ('varchar', 'nvarchar', 'text', 'ntext')
        `);
        console.log('Searching', result.recordset.length, 'columns...');
        for (let row of result.recordset) {
            let q = `SELECT TOP 1 1 FROM [${row.table_name}] WHERE [${row.column_name}] LIKE '%Go to Request%'`;
            try {
                let res = await pool.request().query(q);
                if(res.recordset.length > 0) {
                    console.log('FOUND IN:', row.table_name, '.', row.column_name);
                }
            } catch(e) {
                // Ignore query errors like max length issues
            }
        }
        console.log('Done searching');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
test();
