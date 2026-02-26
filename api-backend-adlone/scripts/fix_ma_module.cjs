const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '123456',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'ADL_One',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function fixPerms() {
    try {
        const pool = await sql.connect(config);

        // 1. Resolve MA_ACCESO conflict
        // If MA_ACCESO exists and AI_MA_ACCESO exists, we transfer relations from MA_ACCESO to AI_MA_ACCESO and delete MA_ACCESO
        await pool.request().query(`
            DECLARE @old_ma_acceso INT;
            DECLARE @new_ai_ma_acceso INT;
            SELECT @old_ma_acceso = id_permiso FROM mae_permiso WHERE codigo = 'MA_ACCESO';
            SELECT @new_ai_ma_acceso = id_permiso FROM mae_permiso WHERE codigo = 'AI_MA_ACCESO';

            IF @old_ma_acceso IS NOT NULL AND @new_ai_ma_acceso IS NOT NULL
            BEGIN
                -- Transfer roles that have old but not new
                INSERT INTO rel_rol_permiso (id_rol, id_permiso)
                SELECT id_rol, @new_ai_ma_acceso FROM rel_rol_permiso WHERE id_permiso = @old_ma_acceso
                AND id_rol NOT IN (SELECT id_rol FROM rel_rol_permiso WHERE id_permiso = @new_ai_ma_acceso);

                -- Delete old relations
                DELETE FROM rel_rol_permiso WHERE id_permiso = @old_ma_acceso;
                -- Delete old permission
                DELETE FROM mae_permiso WHERE id_permiso = @old_ma_acceso;
            END
        `);

        // 2. Rename the 4 requested permissions
        await pool.request().query(`
            UPDATE mae_permiso SET codigo = 'MA_A_GEST_EQUIPO' WHERE codigo = 'AI_MA_A_GEST_EQUIPO';
            UPDATE mae_permiso SET codigo = 'MA_A_REPORTES' WHERE codigo = 'AI_MA_A_REPORTES';
            UPDATE mae_permiso SET codigo = 'MA_ACCESO' WHERE codigo = 'AI_MA_ACCESO';
            UPDATE mae_permiso SET codigo = 'MA_MUESTREADORES' WHERE codigo = 'AI_MA_MUESTREADORES';
        `);

        // 3. Move ALL Medio Ambiente permissions back to the correct module so they appear in the UI
        await pool.request().query(`
            UPDATE mae_permiso 
            SET modulo = 'Medio Ambiente' 
            WHERE codigo LIKE 'AI_MA_%' OR codigo LIKE 'MA_%';
        `);

        console.log("✅ Custom Medio Ambiente permissions fixed and moved!");

    } catch (err) {
        console.error("❌ Error: ", err);
    } finally {
        sql.close();
        process.exit();
    }
}
fixPerms();
