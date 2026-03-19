import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function seed() {
    try {
        const pool = await getConnection();
        console.log("Seeding 'Deshabilitar muestreador' request type...");

        const formulario_config = JSON.stringify([
            {
                name: 'muestreador_origen',
                label: 'Seleccione Muestreador a Deshabilitar',
                type: 'remote-select',
                remoteSource: '/api/muestreadores?habilitado=S',
                labelField: 'nombre_muestreador',
                valueField: 'id_muestreador',
                required: true
            },
            {
                name: 'tipo_traspaso',
                label: 'Gestión de Equipos',
                type: 'option-group',
                options: [
                    { value: 'BASE', label: 'Pasar todos los equipos a una base' },
                    { value: 'MUESTREADOR', label: 'Pasar todos los equipos a un solo muestreador' },
                    { value: 'MANUAL', label: 'Asignar manualmente' }
                ],
                required: true
            }
        ]);

        const workflow_config = JSON.stringify({
            on_approve: {
                action: 'REASSIGN_EQUIPMENT',
                label: 'Ejecutar Traspaso de Equipos',
                redirect: '/admin/equipos'
            }
        });

        // Mapping to actual columns: nombre, area_destino, estado, formulario_config, workflow_config
        await pool.request()
            .input('nombre', sql.VarChar, 'Deshabilitar muestreador')
            .input('area_destino', sql.VarChar, 'INFORMATICA') // Default area
            .input('formulario_config', sql.NVarChar, formulario_config)
            .input('workflow_config', sql.NVarChar, workflow_config)
            .query(`
                IF EXISTS (SELECT 1 FROM mae_solicitud_tipo WHERE nombre = @nombre)
                BEGIN
                    UPDATE mae_solicitud_tipo 
                    SET formulario_config = @formulario_config,
                        workflow_config = @workflow_config,
                        area_destino = @area_destino,
                        estado = 1
                    WHERE nombre = @nombre
                END
                ELSE
                BEGIN
                    INSERT INTO mae_solicitud_tipo (nombre, area_destino, estado, formulario_config, workflow_config)
                    VALUES (@nombre, @area_destino, 1, @formulario_config, @workflow_config)
                END
            `);

        console.log("Success! Request type seeded.");
        process.exit(0);
    } catch (err) {
        console.error("Seeding failed:", err);
        process.exit(1);
    }
}

seed();
