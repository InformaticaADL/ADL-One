import { getConnection } from './src/config/database.js';
import sql from 'mssql';

const WORKFLOWS = [
    {
        nombre: 'Solicitud de Baja de Equipo',
        area_destino: 'GC',
        permiso_acceso: 'JEFE_TECNICO',
        permiso_resolucion: 'DIRECTOR_CALIDAD',
        config: [
            {
                name: 'id_equipo',
                label: 'Seleccionar Equipo',
                type: 'remote-select',
                remoteSource: '/api/admin/equipos',
                required: true
            },
            {
                name: 'motivo_baja',
                label: 'Motivo de la Baja',
                type: 'select',
                options: ['Perdida', 'Mal Estado', 'Vencimiento Calibración', 'Obsolescencia', 'Otro'],
                required: true
            },
            {
                name: 'fecha_ultimo_uso',
                label: 'Fecha de Último Uso',
                type: 'date',
                required: true
            },
            {
                name: 'observaciones',
                label: 'Observaciones Adicionales',
                type: 'textarea',
                required: false
            }
        ]
    },
    {
        nombre: 'Solicitud de Baja de Muestreador',
        area_destino: 'GC',
        permiso_acceso: 'JEFE_AREA',
        permiso_resolucion: 'DIRECTOR_CALIDAD',
        config: [
            {
                name: 'id_muestreador',
                label: 'Seleccionar Muestreador',
                type: 'remote-select',
                remoteSource: '/api/admin/muestreadores',
                required: true
            },
            {
                name: 'motivo_baja',
                label: 'Motivo de la Desvinculación',
                type: 'select',
                options: ['Renuncia Voluntaria', 'Término de Contrato', 'Despido', 'Otro'],
                required: true
            },
            {
                name: 'ultimo_dia',
                label: 'Último Día Laboral',
                type: 'date',
                required: true
            },
            {
                name: 'observaciones',
                label: 'Detalles Internos',
                type: 'textarea',
                required: false
            }
        ]
    }
];

async function seed() {
    try {
        const pool = await getConnection();
        console.log("Seeding Final Workflows...");

        for (const wf of WORKFLOWS) {
            console.log(`- Upserting: ${wf.nombre}`);
            
            const request = pool.request()
                .input('nombre', sql.VarChar(100), wf.nombre)
                .input('area', sql.VarChar(50), wf.area_destino)
                .input('permiso', sql.VarChar(50), wf.permiso_acceso)
                .input('resolucion', sql.VarChar(50), wf.permiso_resolucion)
                .input('config', sql.NVarChar(sql.MAX), JSON.stringify(wf.config));

            // Check if exists
            const check = await pool.request()
                .input('nombre', sql.VarChar(100), wf.nombre)
                .query("SELECT id_tipo FROM mae_solicitud_tipo WHERE nombre = @nombre");

            if (check.recordset.length > 0) {
                const id = check.recordset[0].id_tipo;
                await request.input('id', sql.Numeric(10,0), id).query(`
                    UPDATE mae_solicitud_tipo 
                    SET area_destino = @area, 
                        cod_permiso_crear = @permiso, 
                        cod_permiso_resolver = @resolucion,
                        formulario_config = @config,
                        estado = 1
                    WHERE id_tipo = @id
                `);
            } else {
                await request.query(`
                    INSERT INTO mae_solicitud_tipo (nombre, area_destino, cod_permiso_crear, cod_permiso_resolver, formulario_config, estado)
                    VALUES (@nombre, @area, @permiso, @resolucion, @config, 1)
                `);
            }
        }

        console.log("Success!");
        process.exit(0);
    } catch (err) {
        console.error("Seed failed:", err);
        process.exit(1);
    }
}

seed();
