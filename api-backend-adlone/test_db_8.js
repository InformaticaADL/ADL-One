import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function test() {
    try {
        const pool = await getConnection();

        let e = await pool.request().query("SELECT *, id_empresaservicio, nombre_empresa AS nombre_empresaservicio FROM mae_empresa WHERE habilitado = 'S' ORDER BY nombre_empresa");
        let volcanesE = e.recordset.find(r => r.nombre_empresa && r.nombre_empresa.includes('VOLCANES'));
        console.log("getEmpresasServicio record for Volcanes:", volcanesE);

        let c = await pool.request().execute('maestro_empresa');
        let volcanesC = c.recordset.find(r => r.nombre_empresa && r.nombre_empresa.includes('VOLCANES'));
        console.log("getClientes record for Volcanes:", volcanesC);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

test();
