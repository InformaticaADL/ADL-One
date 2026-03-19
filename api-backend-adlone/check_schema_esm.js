import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkSchema() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT TOP 1 * FROM App_Ma_FichaIngresoServicio_ENC");
        console.log('Columns in App_Ma_FichaIngresoServicio_ENC:');
        console.log(Object.keys(result.recordset[0]).join(', '));
        
        const resultUser = await pool.request().query("SELECT TOP 1 * FROM mae_usuario");
        console.log('\nColumns in mae_usuario:');
        console.log(Object.keys(resultUser.recordset[0]).join(', '));

        const resultEmp = await pool.request().query("SELECT TOP 1 * FROM mae_empresa");
        console.log('\nColumns in mae_empresa:');
        console.log(Object.keys(resultEmp.recordset[0]).join(', '));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
