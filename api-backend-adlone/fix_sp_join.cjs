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
        
        console.log('Retrieving SP definition...');
        const res = await sql.query("EXEC sp_helptext 'MAM_FichaComercial_ConsultaComercial'");
        const fullDef = res.recordset.map(r => r.Text).join('');
        
        console.log('Original JOIN found:');
        const joinPattern = /LEFT JOIN mae_empresa es ON f.id_empresaservicio = es.id_empresa/gi;
        const namePattern = /es\.nombre_empresa as empresa_servicio/gi;

        if (!joinPattern.test(fullDef)) {
            console.error('ERROR: Could not find the expected JOIN pattern in the SP definition.');
            return;
        }

        console.log('Applying fixes to definition...');
        let fixedDef = fullDef
            .replace(joinPattern, 'LEFT JOIN mae_empresaservicios es ON f.id_empresaservicio = es.id_empresaservicio')
            .replace(namePattern, 'es.nombre_empresaservicios as empresa_servicio');

        // Convert CREATE to ALTER
        fixedDef = fixedDef.replace(/CREATE\s+PROCEDURE/i, 'ALTER PROCEDURE');

        console.log('Executing ALTER PROCEDURE...');
        await sql.query(fixedDef);
        
        console.log('SP MAM_FichaComercial_ConsultaComercial updated successfully!');

    } catch (err) {
        console.error('CRITICAL ERROR:', err);
    } finally {
        await sql.close();
    }
}

run();
