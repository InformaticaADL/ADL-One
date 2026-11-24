// Registro de correos enviados (tabla App_Correo_Envio, compartida con ADL SAMPLING). Guarda quién, cuándo, de qué tipo y cómo terminó; NUNCA el cuerpo.
// Si falla el registro, el correo no se ve afectado.
import sql from 'mssql';
import { getConnection } from './database.js';
import logger from '../utils/logger.js';

const comoTexto = (v) => {
    if (!v) return '';
    const lista = Array.isArray(v) ? v : String(v).split(',');
    return lista.map((x) => (typeof x === 'object' && x.address ? x.address : String(x)).trim()).filter(Boolean).join(', ');
};
const recortar = (t, n) => (t ? String(t).slice(0, n) : null);

/** Tipo del correo: la cabecera X-ADL-Tipo que ponen los envíos, o null. */
export const tipoDeCorreo = (opciones) => {
    const h = opciones && opciones.headers;
    return (h && (h['X-ADL-Tipo'] || h['x-adl-tipo'])) || null;
};

/** Anota un envío. estado: 'enviado' | 'fallido' | 'bloqueado'. Nunca lanza error. */
export async function registrarCorreo({ origen = 'ADL ONE', tipo = null, asunto = null, reales = '', final = '', redirigido = false, estado, error = null }) {
    try {
        const pool = await getConnection();
        await pool.request()
            .input('origen', sql.VarChar(20), origen)
            .input('tipo', sql.VarChar(80), recortar(tipo, 80))
            .input('asunto', sql.NVarChar(300), recortar(asunto, 300))
            .input('reales', sql.NVarChar(1000), recortar(comoTexto(reales), 1000))
            .input('final', sql.NVarChar(1000), recortar(comoTexto(final), 1000))
            .input('redirigido', sql.Bit, redirigido ? 1 : 0)
            .input('estado', sql.VarChar(20), estado)
            .input('error', sql.NVarChar(500), recortar(error, 500))
            .query(`INSERT INTO dbo.App_Correo_Envio (origen, tipo, asunto, destinatarios_reales, destino_final, redirigido, estado, error)
                    VALUES (@origen, @tipo, @asunto, @reales, @final, @redirigido, @estado, @error)`);
    } catch (e) {
        logger.warn(`[correo] no se pudo anotar el envío en App_Correo_Envio: ${e.message}`);
    }
}
