import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';

const listAllRbac = async () => {
    try {
        const pool = await getConnection();

        console.log('--- ROLES ---');
        const roles = await pool.request().query('SELECT * FROM mae_rol');
        console.table(roles.recordset);

        console.log('\n--- PERMISSIONS ---');
        const perms = await pool.request().query('SELECT * FROM mae_permiso ORDER BY modulo, submodulo, id_permiso');
        console.table(perms.recordset);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

listAllRbac();
