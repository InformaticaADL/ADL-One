import 'dotenv/config';
import { getConnection, closeConnection } from './src/config/database.js';

async function checkBMConfig() {
    const pool = await getConnection();

    console.log('--- 1. USUARIOS ENAVAS Y HGROTHUSEN ---');
    const users = await pool.request().query(`
        SELECT u.id_usuario, u.usuario, u.nombre_usuario, u.email, u.habilitado, r.id_rol, r.nombre_rol
        FROM mae_usuario u
        LEFT JOIN rel_usuario_rol ur ON u.id_usuario = ur.id_usuario
        LEFT JOIN mae_rol r ON ur.id_rol = r.id_rol
        WHERE u.usuario IN ('enavas', 'hgrothusen') OR u.nombre_usuario LIKE '%navas%' OR u.nombre_usuario LIKE '%grothusen%';
    `);
    console.table(users.recordset);

    console.log('--- 2. PERMISOS BM EN MAE_PERMISO ---');
    const perms = await pool.request().query(`
        SELECT id_permiso, codigo, nombre, modulo, submodulo, habilitado
        FROM mae_permiso
        WHERE codigo LIKE '%BM%' OR codigo LIKE '%BIOL%' OR modulo LIKE '%Biol%';
    `);
    console.table(perms.recordset);

    console.log('--- 3. ROLES RELACIONADOS EN MAE_ROL ---');
    const roles = await pool.request().query(`
        SELECT id_rol, nombre_rol, descripcion, estado
        FROM mae_rol
        WHERE nombre_rol LIKE '%Biol%' OR nombre_rol LIKE '%BM%' OR nombre_rol LIKE '%Lab%';
    `);
    console.table(roles.recordset);

    console.log('--- 4. MÓDULOS DE MENÚ EN MAE_MENU_MODULO ---');
    const modules = await pool.request().query(`
        SELECT id_modulo, label, icon_name, grupo, permissions_str, sort_order, activo
        FROM mae_menu_modulo
        WHERE id_modulo LIKE '%biol%' OR permissions_str LIKE '%BM%';
    `);
    console.table(modules.recordset);

    console.log('--- 5. LINKS DE MENÚ EN MAE_MENU_LINK ---');
    const links = await pool.request().query(`
        SELECT id_link, id_modulo, id_accion, label, permissions_str, sort_order, activo
        FROM mae_menu_link
        WHERE id_modulo LIKE '%biol%' OR permissions_str LIKE '%BM%' OR id_accion LIKE '%bm%';
    `);
    console.table(links.recordset);

    await closeConnection();
    process.exit(0);
}

checkBMConfig();
