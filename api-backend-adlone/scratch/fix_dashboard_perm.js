
import 'dotenv/config';
import { getConnection } from '../src/config/database.js';

async function fixPermissions() {
    try {
        const pool = await getConnection();
        
        // 1. Check if permission exists
        const checkPerm = await pool.request()
            .query("SELECT id_permiso FROM mae_permiso WHERE codigo = 'MA_COORDINACION_ACCESO'");
        
        let permId;
        if (checkPerm.recordset.length === 0) {
            console.log('Creating permission MA_COORDINACION_ACCESO...');
            
            // Get next ID (if not identity)
            const idRes = await pool.request().query('SELECT ISNULL(MAX(id_permiso), 0) + 1 as newId FROM mae_permiso');
            const newId = idRes.recordset[0].newId;
            
            const insertPerm = await pool.request()
                .input('codigo', 'MA_COORDINACION_ACCESO')
                .input('nombre', 'Acceso al Dashboard de Coordinación')
                .input('modulo', 'Medio Ambiente')
                .input('submodulo', 'Fichas de Ingreso')
                .input('tipo', 'Vista')
                .query(`
                    INSERT INTO mae_permiso (codigo, nombre, modulo, submodulo, tipo, habilitado, orden)
                    OUTPUT INSERTED.id_permiso
                    VALUES (@codigo, @nombre, @modulo, @submodulo, @tipo, 1, 95)
                `);
            permId = insertPerm.recordset[0].id_permiso;
            console.log('Permission created with ID:', permId);
        } else {
            permId = checkPerm.recordset[0].id_permiso;
            console.log('Permission already exists with ID:', permId);
        }
        
        // 2. Assign to Administrator role (usually ID 1)
        // Let's find the role ID first
        const roleRes = await pool.request()
            .input('name', 'Administrador')
            .query("SELECT id_rol FROM mae_rol WHERE nombre_rol = @name");
        
        if (roleRes.recordset.length > 0) {
            const roleId = roleRes.recordset[0].id_rol;
            console.log('Assigning to role:', roleId);
            
            // Check if already assigned
            const checkRel = await pool.request()
                .input('rid', roleId)
                .input('pid', permId)
                .query('SELECT * FROM rel_rol_permiso WHERE id_rol = @rid AND id_permiso = @pid');
            
            if (checkRel.recordset.length === 0) {
                await pool.request()
                    .input('rid', roleId)
                    .input('pid', permId)
                    .query('INSERT INTO rel_rol_permiso (id_rol, id_permiso) VALUES (@rid, @pid)');
                console.log('Assigned successfully');
            } else {
                console.log('Already assigned');
            }
        } else {
            console.log('Role Administrador not found');
        }
        
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

fixPermissions();
