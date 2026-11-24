// =============================================================================
// Configuración y cola de correos de Quejas y apelaciones (base de ADLWeb).
//
// ADL-One NO envía correos a clientes. Cuando una acción lo pide (acuse de
// recibo, paso a tratamiento, "no procede", cierre), deja una fila en
// dbo.qa_correos_pendientes y ADLWeb la envía en menos de un minuto, con su
// SMTP y sus textos (procesarColaCorreos en api-backend-adlclone/quality-complaints.js).
// ADLWeb también registra la notificación en el caso cuando el correo sale.
//
// La tabla y su índice único (caso_id, tipo, evento_id) los crea ADLWeb. El
// índice impide encolar dos veces el mismo correo (doble clic, reintento).
// =============================================================================
import sql from 'mssql';
import { getConnectionAdlWeb } from '../config/databaseAdlWeb.js';
import logger from '../utils/logger.js';

/** Configuración de ADLWeb (dbo.configuracion_sistema). No lee contraseñas: no las necesita. */
export async function getSystemConfig() {
    const pool = await getConnectionAdlWeb();
    const r = await pool.request().query("SELECT clave, valor FROM dbo.configuracion_sistema WHERE ISNULL(tipo, '') <> 'password'");
    return Object.fromEntries(r.recordset.map((row) => [row.clave, row.valor]));
}

/** Datos legales que usa el módulo (subconjunto de getLegalInfo de ADLWeb). */
export function getLegalInfo(config = {}) {
    const v = (k) => (config[k] || '').toString().trim();
    const n = parseInt(v('LEGAL_PLAZO_RESPUESTA_QUEJAS_DIAS'), 10);
    return {
        plazoRespuestaQuejasDias: Number.isFinite(n) && n >= 0 ? n : 15,
        version: v('LEGAL_DOCUMENTOS_VERSION') || '1.0',
    };
}

export const TIPOS_CORREO = ['acuse', 'tratamiento', 'no_procede', 'cierre'];

/**
 * Deja un correo en la cola de ADLWeb. Devuelve:
 *  - 'en_cola'    → quedó pendiente; ADLWeb lo enviará.
 *  - 'ya_en_cola' → ese mismo correo ya estaba encolado (no se duplica).
 *  - 'sin_cola'   → la tabla aún no existe (falta actualizar/reiniciar ADLWeb).
 * Nunca lanza: el cambio del caso ya se guardó y no debe fallar por el correo.
 */
export async function encolarCorreo(pool, { casoId, tipo, eventoId, usuario }) {
    if (!TIPOS_CORREO.includes(tipo)) throw new Error(`Tipo de correo no válido: ${tipo}`);
    try {
        const r = await pool.request()
            .input('caso', sql.Int, casoId)
            .input('tipo', sql.NVarChar(20), tipo)
            .input('evento', sql.NVarChar(60), String(eventoId).slice(0, 60))
            .input('por', sql.NVarChar(100), usuario || null)
            // Un acuse no se encola si ya hay otro esperando para el mismo caso.
            .query(`
                INSERT INTO dbo.qa_correos_pendientes (caso_id, tipo, evento_id, solicitado_por, origen)
                SELECT @caso, @tipo, @evento, @por, 'adlone'
                WHERE NOT (@tipo = 'acuse' AND EXISTS (
                    SELECT 1 FROM dbo.qa_correos_pendientes
                    WHERE caso_id = @caso AND tipo = 'acuse' AND estado IN ('pendiente', 'enviando')))`);
        return r.rowsAffected[0] ? 'en_cola' : 'ya_en_cola';
    } catch (e) {
        if (e.number === 2627 || e.number === 2601) return 'ya_en_cola'; // índice único: ya estaba
        if (e.number === 208) {
            logger.error('[Quejas y apelaciones] No existe dbo.qa_correos_pendientes: actualiza y reinicia ADLWeb para crear la cola de correos.');
            return 'sin_cola';
        }
        logger.error(`[Quejas y apelaciones] No se pudo encolar el correo ${tipo} del caso ${casoId}: ${e.message}`);
        return 'sin_cola';
    }
}
