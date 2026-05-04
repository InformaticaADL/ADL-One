const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'MGmerlin.10',
    server: '192.168.10.5',
    database: 'PruebasInformatica',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        await sql.connect(config);
        
        console.log('--- SP: MAM_FichaComercial_ConsultaComercial ---');
        const res1 = await sql.query("EXEC sp_helptext 'MAM_FichaComercial_ConsultaComercial'");
        console.log(res1.recordset.map(r => r.Text).join(''));

    } catch (err) {
        console.error(err);
    } finally {
        await sql.close();
    }
}

run();
