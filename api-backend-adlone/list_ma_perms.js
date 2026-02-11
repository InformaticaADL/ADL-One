import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';

const listPerms = async () => {
    try {
        const pool = await getConnection();
        const res = await pool.request().query("SELECT id_permiso, codigo, nombre FROM mae_permiso WHERE submodulo = 'Medio Ambiente'");
        console.log(JSON.stringify(res.recordset, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

listPerms();
