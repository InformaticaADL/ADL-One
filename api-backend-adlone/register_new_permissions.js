import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function registerPermissions() {
    try {
        console.log('--- Iniciando registro de permisos ADL-One ---');
        const pool = await getConnection();
        
        // 1. Identificar el ID del módulo de Medio Ambiente (basado en prefijos MA_)
        const moduleResult = await pool.request().query(`
            SELECT TOP 1 modulo 
            FROM mae_permiso 
            WHERE codigo = 'MA_COMERCIAL_ACCESO'
        `);
        
        let idModulo = 'Fichas Ingreso'; 
        if (moduleResult.recordset.length > 0) {
            idModulo = moduleResult.recordset[0].modulo;
            console.log(`✅ Módulo identificado: ${idModulo}`);
        }

        const permissions = [
            {
                code: 'MA_COMERCIAL_HISTORIAL_ACCESO',
                name: 'Ver Historial de Muestreos',
                mod: idModulo,
                sub: 'Muestreos Completados',
                tipo: 'ver'
            },
            {
                code: 'MA_COMERCIAL_HISTORIAL_DETALLE',
                name: 'Ver Detalle de Muestreo Histórico',
                mod: idModulo,
                sub: 'Muestreos Completados',
                tipo: 'ver'
            },
            {
                code: 'MA_COMERCIAL_REMUESTREAR',
                name: 'Generar Remuestreo Comercial',
                mod: idModulo,
                sub: 'Muestreos Completados',
                tipo: 'crear'
            }
        ];

        for (const p of permissions) {
            // Verificar si existe
            const check = await pool.request()
                .input('code', sql.VarChar, p.code)
                .query('SELECT COUNT(*) as count FROM mae_permiso WHERE codigo = @code');

            if (check.recordset[0].count === 0) {
                await pool.request()
                    .input('code', sql.VarChar, p.code)
                    .input('name', sql.VarChar, p.name)
                    .input('mod', sql.VarChar, p.mod)
                    .input('sub', sql.VarChar, p.sub)
                    .input('tipo', sql.VarChar, p.tipo)
                    .query(`
                        INSERT INTO mae_permiso (codigo, nombre, modulo, submodulo, tipo)
                        VALUES (@code, @name, @mod, @sub, @tipo)
                    `);
                console.log(`✅ Creado: ${p.code}`);
            } else {
                console.log(`ℹ️ Ya existe: ${p.code}`);
            }
        }

        console.log('--- Proceso finalizado correctamente ---');
        process.exit(0);

    } catch (err) {
        console.error('❌ Error registrando permisos:', err);
        process.exit(1);
    }
}

registerPermissions();
