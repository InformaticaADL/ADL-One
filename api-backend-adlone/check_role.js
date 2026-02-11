import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';

const checkRolePermissions = async (roleName) => {
    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('roleName', roleName)
            .query(`
                SELECT p.codigo, p.nombre 
                FROM mae_rol r
                JOIN rel_rol_permiso rp ON r.id_rol = rp.id_rol
                JOIN mae_permiso p ON rp.id_permiso = p.id_permiso
                WHERE r.nombre_rol = @roleName
            `);

        console.log(`Permissions for role ${roleName}:`);
        console.log(result.recordset);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

const roleName = process.argv[2] || 'Calidad';
checkRolePermissions(roleName);
