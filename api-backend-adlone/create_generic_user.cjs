const sql = require('mssql');
const config = {
    server: '192.168.10.5',
    port: 1433,
    database: 'PruebasInformatica',
    user: 'sa',
    password: 'MGmerlin.10',
    options: {
        trustServerCertificate: true
    }
};

async function run() {
    try {
        await sql.connect(config);
        
        console.log('--- BUSCANDO O CREANDO USUARIO GENÉRICO ---');
        let genericId = null;

        const existRes = await sql.query("SELECT id_usuario FROM mae_usuario WHERE correo_electronico = 'appmovil@adldiagnostic.cl'");
        if (existRes.recordset.length > 0) {
            genericId = existRes.recordset[0].id_usuario;
            console.log('✅ Usuario genérico encontrado. ID:', genericId);
        } else {
            console.log('Creando nuevo usuario genérico "App Móvil"...');
            
            // Generate next manual ID
            const maxIdRes = await sql.query("SELECT ISNULL(MAX(id_usuario), 0) + 1 as nextId FROM mae_usuario");
            const newId = maxIdRes.recordset[0].nextId;
            
            const insertRes = await sql.query(`
                INSERT INTO mae_usuario (
                    id_usuario, usuario, nombre_usuario, correo_electronico, 
                    clave_usuario, habilitado
                ) 
                VALUES (
                    ${newId}, 'appmovil', 'App Móvil Terreno', 'appmovil@adldiagnostic.cl',
                    '$2b$10$XXXXXXXXXXXXXXXXXXXXX', 'S'
                )
            `);
            genericId = newId;
            
            // Asignar Rol 4 (Coordinador / Terreno) para que le validen los permisos
            await sql.query(`INSERT INTO rel_usuario_rol (id_usuario, id_rol) VALUES (${genericId}, 4)`);
            console.log('✅ Usuario genérico creado. ID asignado:', genericId);
        }

        console.log('\\n📝 **ENVIAR A DESARROLLADORES MÓVILES:**');
        console.log(`Su nuevo id_solicitante obligatorio para el INSERT es: **${genericId}**`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        sql.close();
    }
}

run();
