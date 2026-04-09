
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function diagnose() {
    try {
        const pool = await getConnection();
        const res = await pool.request()
            .input('id', sql.Int, 182)
            .query("SELECT id_solicitud, id_tipo, datos_json FROM mae_solicitud WHERE id_solicitud = @id");
        
        if (res.recordset.length === 0) {
            console.log("Solicitud 182 no encontrada");
            process.exit(0);
        }

        const req = res.recordset[0];
        console.log("--- DATOS SOLICITUD 182 ---");
        console.log("ID TIPO:", req.id_tipo);
        console.log("ID MUESTREADOR:", req.id_muestreador);
        
        let dj = {};
        try {
            dj = typeof req.datos_json === 'string' ? JSON.parse(req.datos_json) : req.datos_json;
            console.log("DATOS_JSON:", JSON.stringify(dj, null, 2));
        } catch(e) {
            console.log("Error parseando JSON:", e.message);
        }

        const mapping = { 'EQUIPO': 14, 'SERVICIO': 15, 'FICHA': 15, 'OTRO': 13 };
        const relTipo = (dj.relacion_tipo || '').toUpperCase();
        console.log("RELACION_TIPO detectada:", relTipo);
        console.log("Mapeo result:", mapping[relTipo]);

        // Check if sampler exists
        if (req.id_muestreador) {
            const samplerRes = await pool.request()
                .input('sid', sql.Int, req.id_muestreador)
                .query("SELECT nombre_muestreador FROM mae_muestreador WHERE id_muestreador = @sid");
            console.log("SAMPLER RESOLUTION:", samplerRes.recordset[0]?.nombre_muestreador || "NOT FOUND");
        }

        process.exit(0);
    } catch (err) {
        console.error("ERROR DIAGNOSTICO:", err);
        process.exit(1);
    }
}

diagnose();
