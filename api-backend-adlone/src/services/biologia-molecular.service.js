import sql from 'mssql';
import ExcelJS from 'exceljs';
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
    async getConsultaMuestras({
        fecha_desde = '2026-01-01',
        fecha_hasta = '2026-12-31',
        id_lugaranalisis = 1,
        solo_menor_ct = false,
        limite = 50000,
        fresco = false
    }) {
        const isSoloMenorCT = Boolean(solo_menor_ct);
        const effLimite = Number(limite) || 50000;
        const clave = `${fecha_desde}|${fecha_hasta}|${Number(id_lugaranalisis) || 1}|${isSoloMenorCT ? '1' : '0'}|${effLimite}`;
        const e = cache.get(clave);
        if (e?.promesa) return e.promesa;
        const edad = e?.data ? Date.now() - e.t : Infinity;
        if (edad < CACHE_TTL_MS && !(fresco && edad > CACHE_FRESCO_MIN_EDAD_MS)) return e.data;

        const entrada = { t: e?.t || 0, data: e?.data || null, promesa: null };
        entrada.promesa = this._consultarMuestras({
            fecha_desde,
            fecha_hasta,
            id_lugaranalisis,
            solo_menor_ct: isSoloMenorCT,
            limite: effLimite
        })
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
    async _consultarMuestras({
        fecha_desde = '2026-01-01',
        fecha_hasta = '2026-12-31',
        id_lugaranalisis = 1,
        solo_menor_ct = false,
        limite = 50000
    }) {
        try {
            const pool = await getConnection();
            const request = pool.request();
            const isSoloMenorCT = Boolean(solo_menor_ct);

            const effectiveFechaDesde = String(fecha_desde) < '2017-01-01' ? '2017-01-01' : fecha_desde;
            const topClause = !isSoloMenorCT && limite && Number(limite) > 0 ? `TOP (${Number(limite)})` : '';

            request.input('fecha_desde', sql.Date, effectiveFechaDesde);
            request.input('fecha_hasta', sql.Date, fecha_hasta);
            request.input('id_lugaranalisis', sql.Int, Number(id_lugaranalisis) || 1);

            const ctFilterClause = isSoloMenorCT
                ? `AND (
                    (TRY_CONVERT(float, REPLACE(CAST(bm.ct AS VARCHAR(50)), ',', '.')) > 0 AND TRY_CONVERT(float, REPLACE(CAST(bm.ct AS VARCHAR(50)), ',', '.')) <= 28)
                    OR
                    (TRY_CONVERT(float, REPLACE(CAST(bm.ct2 AS VARCHAR(50)), ',', '.')) > 0 AND TRY_CONVERT(float, REPLACE(CAST(bm.ct2 AS VARCHAR(50)), ',', '.')) <= 28)
                )`
                : '';

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

                SELECT ${topClause}
                    LTRIM(RTRIM(m.caso_adlab)) AS caso_adlab,
                    LTRIM(RTRIM(mc.nombre_centro)) AS nombre_centro,
                    LTRIM(RTRIM(mp.nombre_programa)) AS programa,
                    LTRIM(RTRIM(mt.nombre_tipomuestra)) AS matriz,
                    bm.pool, 
                    LTRIM(RTRIM(tec.nombre_tecnica)) AS agente,
                    LTRIM(RTRIM(bm.ct)) AS ct,
                    LTRIM(RTRIM(bm.resultado)) AS resultado,
                    LTRIM(RTRIM(bm.resultado2)) AS resultado2,
                    LTRIM(RTRIM(bm.ct2)) AS ct2,
                    bm.positivos,
                    LTRIM(RTRIM(m.observaciones)) AS observaciones,
                    LTRIM(RTRIM(m.comentario)) AS comentario,
                    LTRIM(RTRIM(m.fecha_muestreo)) AS fecha_muestreo,
                    LTRIM(RTRIM(m.fecha_recepcion)) AS fecha_recepcion
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
                  ${ctFilterClause}
                ORDER BY 
                    CASE WHEN COALESCE(
                        TRY_CONVERT(date, m.fecha_recepcion, 103),
                        TRY_CONVERT(date, m.fecha_recepcion, 120),
                        TRY_CONVERT(date, m.fecha_recepcion, 105),
                        TRY_CONVERT(date, m.fecha_recepcion)
                    ) IS NULL THEN 1 ELSE 0 END,
                    COALESCE(
                        TRY_CONVERT(date, m.fecha_recepcion, 103),
                        TRY_CONVERT(date, m.fecha_recepcion, 120),
                        TRY_CONVERT(date, m.fecha_recepcion, 105),
                        TRY_CONVERT(date, m.fecha_recepcion)
                    ) ASC,
                    m.caso_adlab ASC,
                    tec.nombre_tecnica ASC,
                    bm.pool ASC;

                DROP TABLE #casos;
            `;

            const result = await request.query(query);
            const cleaned = sanitizeRecordset(result.recordset);

            if (isSoloMenorCT) {
                const menorCTMap = new Map();
                for (const row of cleaned) {
                    const ctItem = getMinCT(row.ct, row.ct2);
                    if (ctItem !== null && ctItem > 0 && ctItem <= 28) {
                        const caso = String(row.caso_adlab ?? '').trim();
                        const matriz = String(row.matriz ?? 'SIN_MATRIZ').trim().toUpperCase();
                        const agente = String(row.agente ?? 'SIN_AGENTE').trim().toUpperCase();
                        const key = `${caso}__${matriz}__${agente}`;

                        const existing = menorCTMap.get(key);
                        if (!existing) {
                            menorCTMap.set(key, row);
                        } else {
                            const ctExisting = getMinCT(existing.ct, existing.ct2);
                            if (ctExisting === null || ctItem < ctExisting) {
                                menorCTMap.set(key, row);
                            } else if (ctItem === ctExisting) {
                                const p1 = Number(row.pool);
                                const p2 = Number(existing.pool);
                                if (!isNaN(p1) && !isNaN(p2) && p1 < p2) {
                                    menorCTMap.set(key, row);
                                }
                            }
                        }
                    }
                }
                const deduped = Array.from(menorCTMap.values()).sort(sortByFechaRecepcionAsc);
                return limite && Number(limite) > 0 ? deduped.slice(0, Number(limite)) : deduped;
            }

            return cleaned;
        } catch (error) {
            logger.error('Error en BiologiaMolecularService.getConsultaMuestras:', error);
            throw error;
        }
    }

    /**
     * Exporta muestras a un archivo Excel (.xlsx) nativo utilizando streaming (ExcelJS WorkbookWriter).
     * Diseñado para soportar 1.000.000+ filas sin sobrecargar la memoria del servidor ni agotar V8.
     */
    async streamExportExcel(res, {
        fecha_desde = '2026-01-01',
        fecha_hasta = '2026-12-31',
        id_lugaranalisis = 1,
        solo_menor_ct = false,
        categoria = 'ALL',
        centro = 'ALL',
        matriz = 'ALL',
        tecnica = 'ALL'
    }) {
        try {
            const pool = await getConnection();
            const request = pool.request();

            const effectiveFechaDesde = String(fecha_desde) < '2017-01-01' ? '2017-01-01' : fecha_desde;

            request.input('fecha_desde', sql.Date, effectiveFechaDesde);
            request.input('fecha_hasta', sql.Date, fecha_hasta);
            request.input('id_lugaranalisis', sql.Int, Number(id_lugaranalisis) || 1);

            let whereExtra = '';
            if (centro && centro !== 'ALL') {
                whereExtra += ' AND LTRIM(RTRIM(mc.nombre_centro)) = @centro';
                request.input('centro', sql.NVarChar, String(centro).trim());
            }
            if (matriz && matriz !== 'ALL') {
                whereExtra += ' AND LTRIM(RTRIM(mt.nombre_tipomuestra)) = @matriz';
                request.input('matriz', sql.NVarChar, String(matriz).trim());
            }
            if (tecnica && tecnica !== 'ALL') {
                whereExtra += ' AND LTRIM(RTRIM(tec.nombre_tecnica)) = @tecnica';
                request.input('tecnica', sql.NVarChar, String(tecnica).trim());
            }

            if (categoria === 'POSITIVO') {
                whereExtra += " AND (LOWER(LTRIM(RTRIM(bm.resultado))) = 'p' OR LOWER(bm.resultado) LIKE '%pos%')";
            } else if (categoria === 'NEGATIVO') {
                whereExtra += " AND (LOWER(LTRIM(RTRIM(bm.resultado))) = 'n' OR LOWER(bm.resultado) LIKE '%neg%')";
            } else if (categoria === 'OTROS') {
                whereExtra += " AND (LOWER(LTRIM(RTRIM(bm.resultado))) <> 'p' AND LOWER(bm.resultado) NOT LIKE '%pos%' AND LOWER(LTRIM(RTRIM(bm.resultado))) <> 'n' AND LOWER(bm.resultado) NOT LIKE '%neg%')";
            }

            const query = `
                SELECT 
                    LTRIM(RTRIM(m.caso_adlab)) AS caso_adlab,
                    LTRIM(RTRIM(mc.nombre_centro)) AS nombre_centro,
                    LTRIM(RTRIM(mp.nombre_programa)) AS programa,
                    LTRIM(RTRIM(mt.nombre_tipomuestra)) AS matriz,
                    bm.pool, 
                    LTRIM(RTRIM(tec.nombre_tecnica)) AS agente,
                    LTRIM(RTRIM(bm.ct)) AS ct,
                    LTRIM(RTRIM(bm.resultado)) AS resultado,
                    LTRIM(RTRIM(bm.resultado2)) AS resultado2,
                    LTRIM(RTRIM(bm.ct2)) AS ct2,
                    bm.positivos,
                    LTRIM(RTRIM(m.observaciones)) AS observaciones,
                    LTRIM(RTRIM(m.comentario)) AS comentario,
                    LTRIM(RTRIM(m.fecha_muestreo)) AS fecha_muestreo,
                    LTRIM(RTRIM(m.fecha_recepcion)) AS fecha_recepcion
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
                  ${whereExtra}
                ORDER BY 
                    CASE WHEN COALESCE(
                        TRY_CONVERT(date, m.fecha_recepcion, 103),
                        TRY_CONVERT(date, m.fecha_recepcion, 120),
                        TRY_CONVERT(date, m.fecha_recepcion, 105),
                        TRY_CONVERT(date, m.fecha_recepcion)
                    ) IS NULL THEN 1 ELSE 0 END,
                    COALESCE(
                        TRY_CONVERT(date, m.fecha_recepcion, 103),
                        TRY_CONVERT(date, m.fecha_recepcion, 120),
                        TRY_CONVERT(date, m.fecha_recepcion, 105),
                        TRY_CONVERT(date, m.fecha_recepcion)
                    ) ASC,
                    m.caso_adlab ASC,
                    tec.nombre_tecnica ASC,
                    bm.pool ASC;
            `;

            return new Promise((resolve, reject) => {
                const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
                    stream: res,
                    useStyles: true,
                    useSharedStrings: false
                });

                const sheet = workbook.addWorksheet('Biología Molecular');

                sheet.columns = [
                    { header: 'Caso ADLAB', key: 'caso_adlab', width: 14 },
                    { header: 'Fecha Recepción', key: 'fecha_recepcion', width: 16 },
                    { header: 'Fecha Muestreo', key: 'fecha_muestreo', width: 16 },
                    { header: 'Centro', key: 'nombre_centro', width: 30 },
                    { header: 'Programa', key: 'programa', width: 24 },
                    { header: 'Matriz', key: 'matriz', width: 20 },
                    { header: 'Agente', key: 'agente', width: 32 },
                    { header: 'Pool', key: 'pool', width: 10 },
                    { header: 'CT', key: 'ct', width: 12 },
                    { header: 'Resultado', key: 'resultado', width: 14 },
                    { header: 'CT 2', key: 'ct2', width: 12 },
                    { header: 'Resultado 2', key: 'resultado2', width: 14 },
                    { header: 'Positivos', key: 'positivos', width: 12 },
                    { header: 'Observaciones', key: 'observaciones', width: 32 },
                    { header: 'Comentario', key: 'comentario', width: 32 }
                ];

                const headerRow = sheet.getRow(1);
                headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                headerRow.commit();

                let rowCount = 0;
                const menorCTMap = solo_menor_ct ? new Map() : null;

                request.stream = true;

                request.on('row', (rawRow) => {
                    const row = sanitizeSingleRow(rawRow);

                    if (solo_menor_ct) {
                        const ctItem = getMinCT(row.ct, row.ct2);
                        if (ctItem !== null && ctItem > 0 && ctItem <= 28) {
                            const caso = String(row.caso_adlab ?? '').trim();
                            const matriz = String(row.matriz ?? 'SIN_MATRIZ').trim().toUpperCase();
                            const agente = String(row.agente ?? 'SIN_AGENTE').trim().toUpperCase();
                            const key = `${caso}__${matriz}__${agente}`;

                            const existing = menorCTMap.get(key);
                            if (!existing) {
                                menorCTMap.set(key, row);
                            } else {
                                const ctExisting = getMinCT(existing.ct, existing.ct2);
                                if (ctExisting === null || ctItem < ctExisting) {
                                    menorCTMap.set(key, row);
                                } else if (ctItem === ctExisting) {
                                    const p1 = Number(row.pool);
                                    const p2 = Number(existing.pool);
                                    if (!isNaN(p1) && !isNaN(p2) && p1 < p2) {
                                        menorCTMap.set(key, row);
                                    }
                                }
                            }
                        }
                    } else {
                        sheet.addRow({
                            caso_adlab: cleanCellText(row.caso_adlab),
                            fecha_recepcion: cleanCellText(formatFecha(row.fecha_recepcion)),
                            fecha_muestreo: cleanCellText(formatFecha(row.fecha_muestreo)),
                            nombre_centro: cleanCellText(row.nombre_centro),
                            programa: cleanCellText(row.programa),
                            matriz: cleanCellText(row.matriz),
                            agente: cleanCellText(row.agente),
                            pool: row.pool ?? '',
                            ct: cleanCellText(row.ct),
                            resultado: cleanCellText(row.resultado),
                            ct2: cleanCellText(row.ct2),
                            resultado2: cleanCellText(row.resultado2),
                            positivos: row.positivos ?? '',
                            observaciones: cleanCellText(row.observaciones),
                            comentario: cleanCellText(row.comentario)
                        }).commit();
                        rowCount++;
                    }
                });

                request.on('error', (err) => {
                    logger.error('Error durante streaming de SQL en BiologiaMolecularService:', err);
                    reject(err);
                });

                request.on('done', async () => {
                    try {
                        if (solo_menor_ct && menorCTMap) {
                            const sorted = Array.from(menorCTMap.values()).sort(sortByFechaRecepcionAsc);

                            for (const row of sorted) {
                                sheet.addRow({
                                    caso_adlab: cleanCellText(row.caso_adlab),
                                    fecha_recepcion: cleanCellText(formatFecha(row.fecha_recepcion)),
                                    fecha_muestreo: cleanCellText(formatFecha(row.fecha_muestreo)),
                                    nombre_centro: cleanCellText(row.nombre_centro),
                                    programa: cleanCellText(row.programa),
                                    matriz: cleanCellText(row.matriz),
                                    agente: cleanCellText(row.agente),
                                    pool: row.pool ?? '',
                                    ct: cleanCellText(row.ct),
                                    resultado: cleanCellText(row.resultado),
                                    ct2: cleanCellText(row.ct2),
                                    resultado2: cleanCellText(row.resultado2),
                                    positivos: row.positivos ?? '',
                                    observaciones: cleanCellText(row.observaciones),
                                    comentario: cleanCellText(row.comentario)
                                }).commit();
                                rowCount++;
                            }
                        }

                        sheet.commit();
                        await workbook.commit();
                        logger.info(`BiologiaMolecularService.streamExportExcel completado con ${rowCount} registros.`);
                        resolve();
                    } catch (err) {
                        logger.error('Error al finalizar workbook en streamExportExcel:', err);
                        reject(err);
                    }
                });

                request.query(query);
            });
        } catch (error) {
            logger.error('Error en BiologiaMolecularService.streamExportExcel:', error);
            throw error;
        }
    }

    /**
     * Exporta muestras a un archivo CSV compatible con Excel mediante streaming HTTP.
     */
    async streamExportCsv(res, {
        fecha_desde = '2026-01-01',
        fecha_hasta = '2026-12-31',
        id_lugaranalisis = 1,
        solo_menor_ct = false,
        categoria = 'ALL',
        centro = 'ALL',
        matriz = 'ALL',
        tecnica = 'ALL'
    }) {
        try {
            const pool = await getConnection();
            const request = pool.request();

            const effectiveFechaDesde = String(fecha_desde) < '2017-01-01' ? '2017-01-01' : fecha_desde;

            request.input('fecha_desde', sql.Date, effectiveFechaDesde);
            request.input('fecha_hasta', sql.Date, fecha_hasta);
            request.input('id_lugaranalisis', sql.Int, Number(id_lugaranalisis) || 1);

            let whereExtra = '';
            if (centro && centro !== 'ALL') {
                whereExtra += ' AND LTRIM(RTRIM(mc.nombre_centro)) = @centro';
                request.input('centro', sql.NVarChar, String(centro).trim());
            }
            if (matriz && matriz !== 'ALL') {
                whereExtra += ' AND LTRIM(RTRIM(mt.nombre_tipomuestra)) = @matriz';
                request.input('matriz', sql.NVarChar, String(matriz).trim());
            }
            if (tecnica && tecnica !== 'ALL') {
                whereExtra += ' AND LTRIM(RTRIM(tec.nombre_tecnica)) = @tecnica';
                request.input('tecnica', sql.NVarChar, String(tecnica).trim());
            }

            if (categoria === 'POSITIVO') {
                whereExtra += " AND (LOWER(LTRIM(RTRIM(bm.resultado))) = 'p' OR LOWER(bm.resultado) LIKE '%pos%')";
            } else if (categoria === 'NEGATIVO') {
                whereExtra += " AND (LOWER(LTRIM(RTRIM(bm.resultado))) = 'n' OR LOWER(bm.resultado) LIKE '%neg%')";
            } else if (categoria === 'OTROS') {
                whereExtra += " AND (LOWER(LTRIM(RTRIM(bm.resultado))) <> 'p' AND LOWER(bm.resultado) NOT LIKE '%pos%' AND LOWER(LTRIM(RTRIM(bm.resultado))) <> 'n' AND LOWER(bm.resultado) NOT LIKE '%neg%')";
            }

            const query = `
                SELECT 
                    LTRIM(RTRIM(m.caso_adlab)) AS caso_adlab,
                    LTRIM(RTRIM(mc.nombre_centro)) AS nombre_centro,
                    LTRIM(RTRIM(mp.nombre_programa)) AS programa,
                    LTRIM(RTRIM(mt.nombre_tipomuestra)) AS matriz,
                    bm.pool, 
                    LTRIM(RTRIM(tec.nombre_tecnica)) AS agente,
                    LTRIM(RTRIM(bm.ct)) AS ct,
                    LTRIM(RTRIM(bm.resultado)) AS resultado,
                    LTRIM(RTRIM(bm.resultado2)) AS resultado2,
                    LTRIM(RTRIM(bm.ct2)) AS ct2,
                    bm.positivos,
                    LTRIM(RTRIM(m.observaciones)) AS observaciones,
                    LTRIM(RTRIM(m.comentario)) AS comentario,
                    LTRIM(RTRIM(m.fecha_muestreo)) AS fecha_muestreo,
                    LTRIM(RTRIM(m.fecha_recepcion)) AS fecha_recepcion
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
                  ${whereExtra}
                ORDER BY 
                    CASE WHEN COALESCE(
                        TRY_CONVERT(date, m.fecha_recepcion, 103),
                        TRY_CONVERT(date, m.fecha_recepcion, 120),
                        TRY_CONVERT(date, m.fecha_recepcion, 105),
                        TRY_CONVERT(date, m.fecha_recepcion)
                    ) IS NULL THEN 1 ELSE 0 END,
                    COALESCE(
                        TRY_CONVERT(date, m.fecha_recepcion, 103),
                        TRY_CONVERT(date, m.fecha_recepcion, 120),
                        TRY_CONVERT(date, m.fecha_recepcion, 105),
                        TRY_CONVERT(date, m.fecha_recepcion)
                    ) ASC,
                    m.caso_adlab ASC,
                    tec.nombre_tecnica ASC,
                    bm.pool ASC;
            `;

            return new Promise((resolve, reject) => {
                const headers = [
                    'Caso ADLAB',
                    'Fecha Recepción',
                    'Fecha Muestreo',
                    'Centro',
                    'Programa',
                    'Matriz',
                    'Agente',
                    'Pool',
                    'CT',
                    'Resultado',
                    'CT 2',
                    'Resultado 2',
                    'Positivos',
                    'Observaciones',
                    'Comentario'
                ];

                // Escribir BOM UTF-8 y cabecera
                res.write('\uFEFF' + headers.join(';') + '\r\n');

                const menorCTMap = solo_menor_ct ? new Map() : null;

                request.stream = true;

                request.on('row', (rawRow) => {
                    const row = sanitizeSingleRow(rawRow);

                    if (solo_menor_ct) {
                        const ctItem = getMinCT(row.ct, row.ct2);
                        if (ctItem !== null && ctItem > 0 && ctItem <= 28) {
                            const caso = String(row.caso_adlab ?? '').trim();
                            const matriz = String(row.matriz ?? 'SIN_MATRIZ').trim().toUpperCase();
                            const agente = String(row.agente ?? 'SIN_AGENTE').trim().toUpperCase();
                            const key = `${caso}__${matriz}__${agente}`;

                            const existing = menorCTMap.get(key);
                            if (!existing) {
                                menorCTMap.set(key, row);
                            } else {
                                const ctExisting = getMinCT(existing.ct, existing.ct2);
                                if (ctExisting === null || ctItem < ctExisting) {
                                    menorCTMap.set(key, row);
                                } else if (ctItem === ctExisting) {
                                    const p1 = Number(row.pool);
                                    const p2 = Number(existing.pool);
                                    if (!isNaN(p1) && !isNaN(p2) && p1 < p2) {
                                        menorCTMap.set(key, row);
                                    }
                                }
                            }
                        }
                    } else {
                        const line = [
                            escapeCsvCell(row.caso_adlab),
                            escapeCsvCell(formatFecha(row.fecha_recepcion)),
                            escapeCsvCell(formatFecha(row.fecha_muestreo)),
                            escapeCsvCell(row.nombre_centro),
                            escapeCsvCell(row.programa),
                            escapeCsvCell(row.matriz),
                            escapeCsvCell(row.agente),
                            escapeCsvCell(row.pool),
                            escapeCsvCell(row.ct),
                            escapeCsvCell(row.resultado),
                            escapeCsvCell(row.ct2),
                            escapeCsvCell(row.resultado2),
                            escapeCsvCell(row.positivos),
                            escapeCsvCell(row.observaciones),
                            escapeCsvCell(row.comentario)
                        ].join(';') + '\r\n';
                        res.write(line);
                    }
                });

                request.on('error', (err) => {
                    logger.error('Error durante streaming CSV en BiologiaMolecularService:', err);
                    reject(err);
                });

                request.on('done', () => {
                    if (solo_menor_ct && menorCTMap) {
                        const sorted = Array.from(menorCTMap.values()).sort(sortByFechaRecepcionAsc);

                        for (const row of sorted) {
                            const line = [
                                escapeCsvCell(row.caso_adlab),
                                escapeCsvCell(formatFecha(row.fecha_recepcion)),
                                escapeCsvCell(formatFecha(row.fecha_muestreo)),
                                escapeCsvCell(row.nombre_centro),
                                escapeCsvCell(row.programa),
                                escapeCsvCell(row.matriz),
                                escapeCsvCell(row.agente),
                                escapeCsvCell(row.pool),
                                escapeCsvCell(row.ct),
                                escapeCsvCell(row.resultado),
                                escapeCsvCell(row.ct2),
                                escapeCsvCell(row.resultado2),
                                escapeCsvCell(row.positivos),
                                escapeCsvCell(row.observaciones),
                                escapeCsvCell(row.comentario)
                            ].join(';') + '\r\n';
                            res.write(line);
                        }
                    }

                    res.end();
                    resolve();
                });

                request.query(query);
            });
        } catch (error) {
            logger.error('Error en BiologiaMolecularService.streamExportCsv:', error);
            throw error;
        }
    }
}

/**
 * Helper para escapar celdas en CSV de forma segura para Excel
 */
function escapeCsvCell(val) {
    if (val === null || val === undefined) return '';
    const str = String(val)
        .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Formatea fechas a DD/MM/YYYY
 */
function formatFecha(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            const [y, m, d] = trimmed.slice(0, 10).split('-');
            return `${d}/${m}/${y}`;
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
            return trimmed.slice(0, 10);
        }
    }
    if (val instanceof Date && !isNaN(val.getTime())) {
        const d = String(val.getDate()).padStart(2, '0');
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const y = val.getFullYear();
        return `${d}/${m}/${y}`;
    }
    return String(val);
}

function parseCT(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const cleaned = String(val).replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

function getMinCT(ct1, ct2) {
    const c1 = parseCT(ct1);
    const c2 = parseCT(ct2);
    if (c1 !== null && c1 > 0 && c2 !== null && c2 > 0) return Math.min(c1, c2);
    if (c1 !== null && c1 > 0) return c1;
    if (c2 !== null && c2 > 0) return c2;
    return null;
}

function cleanCellText(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return isNaN(val) ? '' : val;
    return String(val)
        .replace(/[\x00-\x1F\x7F-\x9F\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function sanitizeSingleRow(row) {
    const cleaned = {};
    for (const [key, val] of Object.entries(row)) {
        const cleanKey = typeof key === 'string'
            ? key.replace(/[\x00-\x1F\x7F-\x9F\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
            : key;

        if (typeof val === 'string') {
            cleaned[cleanKey] = cleanCellText(val);
        } else {
            cleaned[cleanKey] = val;
        }
    }
    return cleaned;
}

function sanitizeRecordset(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(sanitizeSingleRow);
}

function parseDateToSortValue(val) {
    if (!val) return Number.MAX_SAFE_INTEGER;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
            const [d, m, y] = trimmed.slice(0, 10).split('/');
            const time = new Date(Number(y), Number(m) - 1, Number(d)).getTime();
            return isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
        }
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            const [y, m, d] = trimmed.slice(0, 10).split('-');
            const time = new Date(Number(y), Number(m) - 1, Number(d)).getTime();
            return isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
        }
        const time = new Date(trimmed).getTime();
        return isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
    }
    if (val instanceof Date) {
        const time = val.getTime();
        return isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
    }
    return Number.MAX_SAFE_INTEGER;
}

function sortByFechaRecepcionAsc(a, b) {
    const timeA = parseDateToSortValue(a.fecha_recepcion);
    const timeB = parseDateToSortValue(b.fecha_recepcion);
    if (timeA !== timeB) return timeA - timeB;

    const cComp = String(a.caso_adlab || '').localeCompare(String(b.caso_adlab || ''), undefined, { numeric: true });
    if (cComp !== 0) return cComp;

    const agComp = String(a.agente || '').localeCompare(String(b.agente || ''));
    if (agComp !== 0) return agComp;

    return (Number(a.pool) || 0) - (Number(b.pool) || 0);
}

export const biologiaMolecularService = new BiologiaMolecularService();
export default biologiaMolecularService;
