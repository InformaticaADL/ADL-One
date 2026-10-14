import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Servicio para consultas y reportes de la sección Biología Molecular
 */
class BiologiaMolecularService {

    /**
     * Consulta de muestras de Biología Molecular filtrada por rango de fecha de muestreo
     */
    async getConsultaMuestras({ fecha_desde = '2026-01-01', fecha_hasta = '2026-12-31', id_lugaranalisis = 1 }) {
        try {
            const pool = await getConnection();
            const request = pool.request();

            request.input('fecha_desde', sql.Date, fecha_desde);
            request.input('fecha_hasta', sql.Date, fecha_hasta);
            request.input('id_lugaranalisis', sql.Int, Number(id_lugaranalisis) || 1);

            const query = `
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
                FROM LaboratorioADL.dbo.muestras m
                LEFT JOIN LaboratorioADL.dbo.mae_centro mc ON m.id_centro = mc.id_centro
                LEFT JOIN LaboratorioADL.dbo.mae_tipomuestra mt ON m.id_tipomuestra = mt.id_tipomuestra
                LEFT JOIN LaboratorioADL.dbo.mae_programa mp ON m.id_programa = mp.id_programa 
                INNER JOIN LaboratorioADL.dbo.biologiamolecular bm ON m.id_caso = bm.id_caso
                INNER JOIN LaboratorioADL.dbo.mae_tecnica tec ON bm.id_tecnica = tec.id_tecnica
                INNER JOIN LaboratorioADL.dbo.muestras_detalle md 
                    ON m.id_caso = md.id_caso 
                   AND bm.id_tecnica = md.id_tecnica 
                   AND bm.id_organo = md.id_organo
                WHERE m.id_lugaranalisis = @id_lugaranalisis
                  AND ISNULL(m.estado_caso, '') <> 'NULO'
                  AND ISNULL(md.estado, '') <> 'ANULA'
                  AND bm.id_tecnica NOT IN (
                      193, 238, 239, 240, 258, 271, 277, 278, 288,
                      612, 613, 863, 864, 865, 963, 1117, 1118
                  )
                  AND (
                      COALESCE(
                          TRY_CONVERT(date, m.fecha_muestreo, 103),
                          TRY_CONVERT(date, m.fecha_muestreo, 120),
                          TRY_CONVERT(date, m.fecha_muestreo, 105),
                          TRY_CONVERT(date, m.fecha_muestreo)
                      ) BETWEEN @fecha_desde AND @fecha_hasta
                  )
                ORDER BY m.caso_adlab, tec.nombre_tecnica, bm.pool;
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
