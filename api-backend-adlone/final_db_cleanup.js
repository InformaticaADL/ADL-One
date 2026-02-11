import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';

const cleanup = async () => {
    try {
        const pool = await getConnection();

        console.log('--- Analizando roles con permisos obsoletos ---');

        // REC (45) -> EQUIPOS (40)
        // ENV (46) -> SOLICITUDES (41)

        // 1. Migrar roles que tienen REC (45) pero no EQUIPOS (40)
        const mig1 = await pool.request().query(`
            INSERT INTO rel_rol_permiso (id_rol, id_permiso)
            SELECT DISTINCT id_rol, 40
            FROM rel_rol_permiso
            WHERE id_permiso = 45
            AND id_rol NOT IN (SELECT id_rol FROM rel_rol_permiso WHERE id_permiso = 40)
        `);
        console.log(`✅ Migración 1: ${mig1.rowsAffected[0]} roles movidos de REC a EQUIPOS.`);

        // 2. Migrar roles que tienen ENV (46) pero no SOLICITUDES (41)
        const mig2 = await pool.request().query(`
            INSERT INTO rel_rol_permiso (id_rol, id_permiso)
            SELECT DISTINCT id_rol, 41
            FROM rel_rol_permiso
            WHERE id_permiso = 46
            AND id_rol NOT IN (SELECT id_rol FROM rel_rol_permiso WHERE id_permiso = 41)
        `);
        console.log(`✅ Migración 2: ${mig2.rowsAffected[0]} roles movidos de ENV a SOLICITUDES.`);

        // 3. Limpiar rel_rol_permiso
        const delRel = await pool.request().query(`DELETE FROM rel_rol_permiso WHERE id_permiso IN (45, 46)`);
        console.log(`✅ Limpieza: ${delRel.rowsAffected[0]} vínculos obsoletos eliminados de rel_rol_permiso.`);

        // 4. Borrar permisos de mae_permiso
        const delPerm = await pool.request().query(`DELETE FROM mae_permiso WHERE id_permiso IN (45, 46)`);
        console.log(`✅ Éxito: ${delPerm.rowsAffected[0]} permisos eliminados de mae_permiso.`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
        process.exit(1);
    }
};

cleanup();
