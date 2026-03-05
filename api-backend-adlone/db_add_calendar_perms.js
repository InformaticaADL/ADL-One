import { getConnection, closeConnection } from './src/config/database.js';
import sql from 'mssql';

async function addCalendarPermissions() {
    try {
        const pool = await getConnection();

        const perms = [
            { codigo: 'MA_CALENDARIO_ACCESO', nombre: 'Ver Calendario En Proceso', modulo: 'Medio Ambiente', submodulo: 'Coordinación', tipo: 'VISTA' },
            { codigo: 'MA_CALENDARIO_CANCELAR', nombre: 'Cancelar Muestreo (Calendario)', modulo: 'Medio Ambiente', submodulo: 'Coordinación', tipo: 'ACCION' },
            { codigo: 'MA_CALENDARIO_REAGENDAR', nombre: 'Reagendar Muestreo (Calendario)', modulo: 'Medio Ambiente', submodulo: 'Coordinación', tipo: 'ACCION' },
            { codigo: 'MA_CALENDARIO_REASIGNAR', nombre: 'Reasignar Muestreo (Calendario)', modulo: 'Medio Ambiente', submodulo: 'Coordinación', tipo: 'ACCION' }
        ];

        for (const p of perms) {
            // Check if exists
            const check = await pool.request()
                .input('codigo', sql.VarChar, p.codigo)
                .query('SELECT 1 FROM mae_permiso WHERE codigo = @codigo');

            if (check.recordset.length === 0) {
                console.log(`Inserting permission: ${p.codigo}`);
                await pool.request()
                    .input('codigo', sql.VarChar, p.codigo)
                    .input('nombre', sql.VarChar, p.nombre)
                    .input('modulo', sql.VarChar, p.modulo)
                    .input('submodulo', sql.VarChar, p.submodulo)
                    .input('tipo', sql.VarChar, p.tipo)
                    .query('INSERT INTO mae_permiso (codigo, nombre, modulo, submodulo, tipo) VALUES (@codigo, @nombre, @modulo, @submodulo, @tipo)');
            } else {
                console.log(`Permission already exists: ${p.codigo}`);
            }
        }

        console.log('Finished adding permissions.');

    } catch (err) {
        console.error('Error adding permissions:', err);
    } finally {
        await closeConnection();
    }
}

addCalendarPermissions();
