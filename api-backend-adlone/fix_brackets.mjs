import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function fixBrackets() {
    try {
        const pool = await getConnection();
        console.log("Fixing Rule 56 brackets...");

        await pool.request()
            .query(`
                -- Fix any rule that has brackets around USUARIO_ACCION
                UPDATE mae_notificacion_regla 
                SET plantilla_web = REPLACE(plantilla_web, '[{{usuario_accion}}]', '{{usuario_accion}}')
                WHERE plantilla_web LIKE '%[{{usuario_accion}}]%';
                
                -- Specifically clean Rule 56 of any remaining brackets
                UPDATE mae_notificacion_regla 
                SET plantilla_web = REPLACE(REPLACE(plantilla_web, '[', ''), ']', '')
                WHERE id_regla = 56;
            `);

        console.log("Success! Brackets removed from database rules.");
        process.exit(0);
    } catch (err) {
        console.error("Fix failed:", err);
        process.exit(1);
    }
}

fixBrackets();
