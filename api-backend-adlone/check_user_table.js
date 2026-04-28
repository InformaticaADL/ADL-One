import dotenv from 'dotenv';
dotenv.config();

const { getConnection } = await import('./src/config/database.js');

async function checkUserTable() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT TOP 1 * FROM mae_usuario");
        console.log('COLUMNAS MAE_USUARIO:');
        console.log(JSON.stringify(Object.keys(result.recordset[0] || {}), null, 2));
        console.log('\nEJEMPLO:');
        console.log(JSON.stringify(result.recordset[0], null, 2));
        // También ver roles disponibles ya que un usuario necesita un rol
        const roles = await pool.request().query("SELECT id_rol, nombre_rol FROM mae_rol WHERE habilitado = 'S' OR habilitado = 1");
        console.log('\nROLES DISPONIBLES:');
        console.log(JSON.stringify(roles.recordset, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUserTable();
