import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function seed() {
    try {
        const pool = await getConnection();
        console.log("Seeding 'Solicitud de Baja de Equipo'...");

        const formConfig = [
            { 
                name: "id_equipo", 
                label: "Seleccionar Equipo", 
                type: "remote-select", 
                remoteSource: "/api/admin/equipos", 
                labelField: "nombre", 
                valueField: "id_equipo",
                required: true,
                placeholder: "Busque el equipo en el listado..."
            },
            { name: "motivo", label: "Motivo de la Baja", type: "select", options: ["Obsolescencia", "Daño Irreparable", "Pérdida/Robo", "Fin de Vida Útil"], required: true },
            { name: "fecha_incidente", label: "Fecha del Suceso", type: "date", required: true },
            { name: "observaciones", label: "Observaciones Técnicas", type: "textarea", required: false, placeholder: "Describa el estado actual del equipo..." }
        ];

        // Insert or Update the type
        await pool.request()
            .input('nombre', sql.VarChar(100), 'Solicitud de Baja de Equipo')
            .input('area', sql.VarChar(50), 'GC') // GC = Gestión de Calidad
            .input('formulario', sql.NVarChar(sql.MAX), JSON.stringify(formConfig))
            .query(`
                IF EXISTS (SELECT 1 FROM mae_solicitud_tipo WHERE nombre = @nombre)
                BEGIN
                    UPDATE mae_solicitud_tipo 
                    SET area_destino = @area, formulario_config = @formulario 
                    WHERE nombre = @nombre
                END
                ELSE
                BEGIN
                    INSERT INTO mae_solicitud_tipo (nombre, area_destino, formulario_config, estado)
                    VALUES (@nombre, @area, @formulario, 1)
                END
            `);

        console.log("Success! Workflow for Equipment configured.");

        // --- SECOND WORKFLOW: Sampler Decommissioning ---
        console.log("Seeding 'Solicitud de Baja de Muestreador'...");
        const samplerForm = [
            { name: "nombre_muestreador", label: "Nombre Completo", type: "text", required: true },
            { name: "rut", label: "RUT", type: "text", required: true },
            { name: "motivo_baja", label: "Motivo del Cese", type: "select", options: ["Renuncia Voluntaria", "Término de Contrato", "Falta Grave", "Salud"], required: true },
            { name: "ultimo_dia", label: "Último Día Laboral", type: "date", required: true }
        ];

        await pool.request()
            .input('nombre', sql.VarChar(100), 'Solicitud de Baja de Muestreador')
            .input('area', sql.VarChar(50), 'GC') // Calidad
            .input('formulario', sql.NVarChar(sql.MAX), JSON.stringify(samplerForm))
            .query(`
                IF EXISTS (SELECT 1 FROM mae_solicitud_tipo WHERE nombre = @nombre)
                BEGIN
                    UPDATE mae_solicitud_tipo 
                    SET area_destino = @area, formulario_config = @formulario 
                    WHERE nombre = @nombre
                END
                ELSE
                BEGIN
                    INSERT INTO mae_solicitud_tipo (nombre, area_destino, formulario_config, estado)
                    VALUES (@nombre, @area, @formulario, 1)
                END
            `);

        console.log("Success! Workflow for Sampler configured.");
        process.exit(0);
    } catch (err) {
        console.error("Seed failed:", err);
        process.exit(1);
    }
}

seed();
