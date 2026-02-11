import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';

const checkUserPermissions = async (username) => {
    try {
        const pool = await getConnection();

        const rolesResult = await pool.request()
            .input('username', username)
            .query(`
                SELECT r.nombre_rol 
                FROM mae_usuario u
                JOIN rel_usuario_rol ur ON u.id_usuario = ur.id_usuario
                JOIN mae_rol r ON ur.id_rol = r.id_rol
                WHERE u.nombre_usuario = @username
            `);

        console.log(`Roles for ${username}:`);
        console.log(rolesResult.recordset);

        const result = await pool.request()
            .input('username', username)
            .query(`
                SELECT p.* 
                FROM mae_usuario u
                JOIN rel_usuario_rol ur ON u.id_usuario = ur.id_usuario
                JOIN rel_rol_permiso rp ON ur.id_rol = rp.id_rol
                JOIN mae_permiso p ON rp.id_permiso = p.id_permiso
                WHERE u.nombre_usuario = @username
            `);

        console.log(`Permissions for ${username}:`);
        console.log(result.recordset);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

const username = process.argv[2] || 'msanchez';
checkUserPermissions(username);
