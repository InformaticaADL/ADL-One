const sql = require('mssql');
const config = {
    server: '192.168.10.5',
    database: 'PruebasInformatica',
    user: 'sa',
    password: 'MGmerlin.10',
    options: {
        trustServerCertificate: true
    }
};

async function checkEquipos() {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query("SELECT COUNT(*) as total FROM mae_equipo");
        console.log('Total equipos in mae_equipo:', result.recordset[0].total);
        
        const first5 = await pool.request().query("SELECT TOP 5 id_equipo, codigo, nombre, habilitado FROM mae_equipo");
        console.log('First 5 equipos:', JSON.stringify(first5.recordset, null, 2));
        
        await sql.close();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkEquipos();
