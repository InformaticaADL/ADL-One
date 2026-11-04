import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Servicio para consultas y reportes de la sección Biología Molecular
 */
// Caché en memoria de las consultas (rango + laboratorio). Cada consulta recorre completas las tablas de resultados del LIMS
// (casi 2 millones de filas, sin índice por caso) y cuesta ~3-6 s de CPU del SQL Server compartido con ADLSOFT; la pantalla además
// consulta sola al abrirse. Se guarda el resultado 10 minutos y las consultas iguales que llegan mientras una se calcula comparten
// el mismo cálculo. "fresco" salta la caché, pero solo si lo guardado tiene más de 1 minuto (así el botón Consultar no sirve para
// sobrecargar el servidor). Se guardan pocas entradas porque un año completo pesa ~30 MB.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_FRESCO_MIN_EDAD_MS = 60 * 1000;
const CACHE_MAX_ENTRADAS = 6;
const cache = new Map(); // clave -> { t, data, promesa }

function podarCache() {
    while (cache.size > CACHE_MAX_ENTRADAS) {
        const masVieja = [...cache].filter(([, e]) => !e.promesa).sort((a, b) => a[1].t - b[1].t)[0];
        if (!masVieja) return;
        cache.delete(masVieja[0]);
    }
}

class BiologiaMolecularService {

    /**
     * Consulta de muestras de Biología Molecular filtrada por rango de fecha de muestreo (con caché, ver arriba)
     */
    async getConsultaMuestras({ fecha_desde = '2026-01-01', fecha_hasta = '2026-12-31', id_lugaranalisis = 1, fresco = false }) {
        const clave = `${fecha_desde}|${fecha_hasta}|${Number(id_lugaranalisis) || 1}`;
        const e = cache.get(clave);
        if (e?.promesa) return e.promesa;
        const edad = e?.data ? Date.now() - e.t : Infinity;
        if (edad < CACHE_TTL_MS && !(fresco && edad > CACHE_FRESCO_MIN_EDAD_MS)) return e.data;

        const entrada = { t: e?.t || 0, data: e?.data || null, promesa: null };
        entrada.promesa = this._consultarMuestras({ fecha_desde, fecha_hasta, id_lugaranalisis })
            .then((data) => { entrada.data = data; entrada.t = Date.now(); return data; })
            .catch((err) => { if (!entrada.data) cache.delete(clave); throw err; })
            .finally(() => { entrada.promesa = null; podarCache(); });
        cache.set(clave, entrada);
        return entrada.promesa;
    }

    /**
     * La consulta al LIMS, sin caché.
     * Primero se eligen los casos del rango (la fecha es texto y se convierte fila a fila, solo se puede hacer sobre `muestras`) y
     * recién después se unen con los resultados: antes la conversión y las uniones se hacían juntas y la consulta gastaba ~40 % más CPU.
     */
    async _consultarMuestras({ fecha_desde, fecha_hasta, id_lugaranalisis }) {
        try {
            const pool = await getConnection();
            const request = pool.request();

            request.input('fecha_desde', sql.Date, fecha_desde);
            request.input('fecha_hasta', sql.Date, fecha_hasta);
            request.input('id_lugaranalisis', sql.Int, Number(id_lugaranalisis) || 1);

            const query = `
                SELECT m.id_caso
                INTO #casos
                FROM LaboratorioADL.dbo.muestras m
                WHERE m.id_lugaranalisis = @id_lugaranalisis
                  AND ISNULL(m.estado_caso, '') <> 'NULO'
                  AND (
                      COALESCE(
                          TRY_CONVERT(date, m.fecha_muestreo, 103),
                          TRY_CONVERT(date, m.fecha_muestreo, 120),
                          TRY_CONVERT(date, m.fecha_muestreo, 105),
                          TRY_CONVERT(date, m.fecha_muestreo)
                      ) BETWEEN @fecha_desde AND @fecha_hasta
                  );

                CREATE CLUSTERED INDEX ix_casos ON #casos (id_caso);

                SELECT
                    m.caso_adlab,
                    mc.nombre_centro,
                    mp.nombre_programa AS programa,
                    mt.nombre_tipomuestra AS matriz,
                    bm.pool, 
                    tec.nombre_tecnica AS agente,
                    bm.ct,
                    bm.resultado,
                    bm.resultado2,
                    bm.ct2,
                    bm.positivos,
                    m.fecha_muestreo,
                    m.fecha_recepcion
                FROM #casos c
                INNER JOIN LaboratorioADL.dbo.muestras m ON m.id_caso = c.id_caso
                LEFT JOIN LaboratorioADL.dbo.mae_centro mc ON m.id_centro = mc.id_centro
                LEFT JOIN LaboratorioADL.dbo.mae_tipomuestra mt ON m.id_tipomuestra = mt.id_tipomuestra
                LEFT JOIN LaboratorioADL.dbo.mae_programa mp ON m.id_programa = mp.id_programa 
                INNER JOIN LaboratorioADL.dbo.biologiamolecular bm ON m.id_caso = bm.id_caso
                INNER JOIN LaboratorioADL.dbo.mae_tecnica tec ON bm.id_tecnica = tec.id_tecnica
                INNER JOIN LaboratorioADL.dbo.muestras_detalle md 
                    ON m.id_caso = md.id_caso 
                   AND bm.id_tecnica = md.id_tecnica 
                   AND bm.id_organo = md.id_organo
                WHERE ISNULL(md.estado, '') <> 'ANULA'
                  AND bm.id_tecnica NOT IN (
                      193, 238, 239, 240, 258, 271, 277, 278, 288,
                      612, 613, 863, 864, 865, 963, 1117, 1118
                  )
                ORDER BY m.caso_adlab, tec.nombre_tecnica, bm.pool;

                DROP TABLE #casos;
            `;

            const result = await request.query(query);
            return sanitizeRecordset(result.recordset);
        } catch (error) {
            logger.error('Error en BiologiaMolecularService.getConsultaMuestras:', error);
            throw error;
        }
    }
}

/**
 * Limpia caracteres de control, saltos de línea, tabs, NBSP y espacios sobrantes devueltos por SQL
 */
function sanitizeRecordset(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
        const cleaned = {};
        for (const [key, val] of Object.entries(row)) {
            const cleanKey = typeof key === 'string'
                ? key.replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
                : key;

            if (typeof val === 'string') {
                cleaned[cleanKey] = val
                    .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            } else {
                cleaned[cleanKey] = val;
            }
        }
        return cleaned;
    });
}

export const biologiaMolecularService = new BiologiaMolecularService();
export default biologiaMolecularService;
