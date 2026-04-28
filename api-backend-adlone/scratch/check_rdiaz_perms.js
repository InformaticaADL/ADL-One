
import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

async function checkRdiaz() {
    try {
        const pool = await getConnection();
        const userRes = await pool.request()
            .input('user', 'rdiaz')
            .query('SELECT id_usuario, nombre_usuario, perfil_usuario FROM mae_usuario WHERE nombre_usuario = @user');
        
        if (userRes.recordset.length === 0) {
            console.log('User rdiaz not found');
            return;
        }
        
        const userId = userRes.recordset[0].id_usuario;
        console.log('User found:', userRes.recordset[0]);
        
        const rolesRes = await pool.request()
            .input('userId', userId)
            .query(`
                SELECT r.nombre_rol 
                FROM mae_rol r
                INNER JOIN rel_usuario_rol ur ON r.id_rol = ur.id_rol
                WHERE ur.id_usuario = @userId
            `);
        console.log('Roles:', rolesRes.recordset.map(r => r.nombre_rol));
        
        const permsRes = await pool.request()
            .input('userId', userId)
            .query(`
                SELECT DISTINCT p.codigo, p.nombre
                FROM mae_permiso p
                INNER JOIN rel_rol_permiso rp ON p.id_permiso = rp.id_permiso
                INNER JOIN rel_usuario_rol ur ON rp.id_rol = ur.id_rol
                WHERE ur.id_usuario = @userId
                ORDER BY p.codigo
            `);
        console.log('Permissions:');
        console.table(permsRes.recordset);
        
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkRdiaz();
