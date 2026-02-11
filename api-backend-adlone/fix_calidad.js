import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

const fixCalidadRole = async () => {
    try {
        const pool = await getConnection();

        // Find Role ID for 'Calidad'
        const roleResult = await pool.request()
            .input('name', 'Calidad')
            .query('SELECT id_rol FROM mae_rol WHERE nombre_rol = @name');

        if (roleResult.recordset.length === 0) {
            console.error('Role Calidad not found');
            process.exit(1);
        }

        const roleId = roleResult.recordset[0].id_rol;
        console.log(`Found Calidad Role ID: ${roleId}`);

        // 1. Remove AI_MA_NOTIF_ENV (id 46) if exists
        const removeRes = await pool.request()
            .input('roleId', roleId)
            .input('permId', 46)
            .query('DELETE FROM rel_rol_permiso WHERE id_rol = @roleId AND id_permiso = @permId');
        console.log(`Removed AI_MA_NOTIF_ENV: ${removeRes.rowsAffected[0]} rows`);

        // 2. Add MA_ACCESO (id 1) if not exists
        const checkAcceso = await pool.request()
            .input('roleId', roleId)
            .input('permId', 1)
            .query('SELECT 1 FROM rel_rol_permiso WHERE id_rol = @roleId AND id_permiso = @permId');

        if (checkAcceso.recordset.length === 0) {
            await pool.request()
                .input('roleId', roleId)
                .input('permId', 1)
                .query('INSERT INTO rel_rol_permiso (id_rol, id_permiso) VALUES (@roleId, @permId)');
            console.log('Added MA_ACCESO to Calidad role');
        } else {
            console.log('MA_ACCESO already exists in Calidad role');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixCalidadRole();
