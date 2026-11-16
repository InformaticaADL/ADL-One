import sql from 'mssql';
import ExcelJS from 'exceljs';
import { getConnectionHistorico } from '../config/databaseHistorico.js';
import logger from '../utils/logger.js';

/**
 * Servicio para consultas y reportes de la data histórica (2006-2016)
 * de Biología Molecular y Ensayos de Laboratorio ADL dividida en sus 3 tablas por formato:
 *  - dbo.historico_bmo_2006_2008 (Formato 1: 2006-2008)
 *  - dbo.historico_bmo_2009_2012 (Formato 2: 2009-2012)
 *  - dbo.historico_bmo_2013_2016 (Formato 3: 2013-2016)
 *
 * Incluye el mismo esquema de caché en memoria de 10 minutos, deduplicación de promesas en vuelo
 * y enfriamiento mínimo de 1 minuto para `fresco` que Consulta de Muestras, evitando sobrecargar SQL Server.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_FRESCO_MIN_EDAD_MS = 60 * 1000;
const CACHE_MAX_ENTRADAS = 6;
const cache = new Map(); // clave -> { t, data, promesa }
let filtrosCache = { t: 0, data: null, promesa: null };

function podarCache() {
    while (cache.size > CACHE_MAX_ENTRADAS) {
        const masVieja = [...cache].filter(([, e]) => !e.promesa).sort((a, b) => a[1].t - b[1].t)[0];
        if (!masVieja) return;
        cache.delete(masVieja[0]);
    }
}

class HistoricoBiologiaMolecularService {

    /**
     * Consulta de datos históricos desde las 3 tablas normalizadas (con caché en memoria y deduplicación)
     */
    async getConsultaHistorico({
        fecha_desde = '2006-01-01',
        fecha_hasta = '2016-12-31',
        ano = null,
        sede = null,
        fuente_origen = null,
        resultado = 'ALL',
        centro = 'ALL',
        busqueda = '',
        solo_menor_ct = false,
        limite = 50000,
        fresco = false
    }) {
        const targetFormats = resolveTargetFormats({ fecha_desde, fecha_hasta, ano, fuente_origen });
        const isOnlyFormat1 = targetFormats.length === 1 && targetFormats[0] === 'FORMATO_1';
        const isSoloMenorCT = Boolean(solo_menor_ct) && !isOnlyFormat1;
        const numericLimit = Number(limite) || 50000;

        const clave = [
            fecha_desde || '',
            fecha_hasta || '',
            ano || 'ALL',
            sede || 'ALL',
            fuente_origen || 'ALL',
            resultado || 'ALL',
            centro || 'ALL',
            String(busqueda || '').trim(),
            isSoloMenorCT ? '1' : '0',
            numericLimit
        ].join('|');

        const e = cache.get(clave);
        if (e?.promesa) return e.promesa;
        const edad = e?.data ? Date.now() - e.t : Infinity;
        if (edad < CACHE_TTL_MS && !(fresco && edad > CACHE_FRESCO_MIN_EDAD_MS)) return e.data;

        const entrada = { t: e?.t || 0, data: e?.data || null, promesa: null };
        entrada.promesa = this._consultarHistorico({
            fecha_desde,
            fecha_hasta,
            ano,
            sede,
            fuente_origen,
            resultado,
            centro,
            busqueda,
            solo_menor_ct: isSoloMenorCT,
            limite: numericLimit
        })
            .then((data) => { entrada.data = data; entrada.t = Date.now(); return data; })
            .catch((err) => { if (!entrada.data) cache.delete(clave); throw err; })
            .finally(() => { entrada.promesa = null; podarCache(); });
        cache.set(clave, entrada);
        return entrada.promesa;
    }

    /**
     * Consulta directa a las tablas históricas en SQL Server (sin caché)
     */
    async _consultarHistorico({
        fecha_desde = '2006-01-01',
        fecha_hasta = '2016-12-31',
        ano = null,
        sede = null,
        fuente_origen = null,
        resultado = 'ALL',
        centro = 'ALL',
        busqueda = '',
        solo_menor_ct = false,
        limite = 50000
    }) {
        try {
            const pool = await getConnectionHistorico();
            const request = pool.request();
            const targetFormats = resolveTargetFormats({ fecha_desde, fecha_hasta, ano, fuente_origen });
            const isOnlyFormat1 = targetFormats.length === 1 && targetFormats[0] === 'FORMATO_1';
            const isSoloMenorCT = Boolean(solo_menor_ct) && !isOnlyFormat1;

            const filters = {
                fecha_desde,
                fecha_hasta,
                ano,
                sede,
                fuente_origen,
                resultado,
                centro,
                busqueda,
                solo_menor_ct: isSoloMenorCT
            };

            const sourceSubquery = buildUnifiedSourceSubquery(filters);
            const whereClause = buildHistoricoWhereClause(request, filters);
            const numericLimit = Number(limite) || 50000;
            const topClause = !isSoloMenorCT && numericLimit > 0 ? `TOP (${numericLimit})` : '';

            const query = `
                SELECT ${topClause}
                    h.id_caso,
                    h.formato_origen,
                    h.n_caso,
                    h.rut_empresa,
                    h.empresa,
                    h.rut_empresaservicio,
                    h.nombre_empresaservicio,
                    h.programa,
                    h.centro,
                    h.codigo_centro,
                    h.lugar_analisis,
                    h.especie,
                    h.estadio,
                    h.lote,
                    h.contenedor,
                    h.tipo_agua,
                    h.tipo_muestra,
                    h.tipo_muestreo,
                    h.tejido_matriz,
                    h.n_muestras,
                    h.pool,
                    h.pol_npooles,
                    h.pol_npeces,
                    h.fecha_muestreo,
                    h.fecha_recepcion,
                    h.tecnica,
                    h.agente,
                    h.resultado,
                    h.resultado2,
                    h.ct,
                    h.ct2,
                    h.genovariante,
                    h.positivos,
                    h.negativos,
                    h.intensidad,
                    h.expr1,
                    h.estado_caso,
                    h.fuente_origen
                FROM (${sourceSubquery}) AS h
                ${whereClause}
                ORDER BY 
                    h.formato_origen ASC,
                    h.id_caso ASC;
            `;

            const result = await request.query(query);
            const cleaned = sanitizeRecordset(result.recordset);

            if (isSoloMenorCT) {
                const menorCTMap = new Map();
                for (const row of cleaned) {
                    const ctVal = parseNumericCT(row.ct);
                    if (ctVal !== null && ctVal > 0 && ctVal <= 28) {
                        const dedupeKey = `${String(row.formato_origen || '')}|||${String(row.n_caso || '').trim()}|||${String(row.tejido_matriz || '').trim()}|||${String(row.agente || row.tecnica || '').trim()}`;
                        const existing = menorCTMap.get(dedupeKey);
                        if (!existing || ctVal < existing._numericCT) {
                            menorCTMap.set(dedupeKey, { ...row, _numericCT: ctVal });
                        }
                    }
                }
                const deduped = Array.from(menorCTMap.values()).map(({ _numericCT, ...rest }) => rest);
                return limite && Number(limite) > 0 ? deduped.slice(0, Number(limite)) : deduped;
            }

            return cleaned;
        } catch (error) {
            logger.error('Error en HistoricoBiologiaMolecularService.getConsultaHistorico:', error);
            throw error;
        }
    }

    /**
     * Obtiene el conteo total real de registros que coinciden con los filtros (sin límite TOP)
     */
    async countConsultaHistorico({
        fecha_desde = '2006-01-01',
        fecha_hasta = '2016-12-31',
        ano = null,
        sede = null,
        fuente_origen = null,
        resultado = 'ALL',
        centro = 'ALL',
        busqueda = ''
    }) {
        try {
            const pool = await getConnectionHistorico();
            const request = pool.request();

            const filters = {
                fecha_desde,
                fecha_hasta,
                ano,
                sede,
                fuente_origen,
                resultado,
                centro,
                busqueda
            };

            const sourceSubquery = buildUnifiedSourceSubquery(filters);
            const whereClause = buildHistoricoWhereClause(request, filters);

            const query = `
                SELECT COUNT(1) AS total
                FROM (${sourceSubquery}) AS h
                ${whereClause};
            `;

            const result = await request.query(query);
            return Number(result.recordset[0]?.total || 0);
        } catch (error) {
            logger.error('Error en HistoricoBiologiaMolecularService.countConsultaHistorico:', error);
            return 0;
        }
    }

    /**
     * Obtiene metadatos y listas para filtros rápidos desde las 3 tablas (con caché en memoria de 10 minutos)
     */
    async getFiltrosHistorico() {
        if (filtrosCache.promesa) return filtrosCache.promesa;
        if (filtrosCache.data && Date.now() - filtrosCache.t < CACHE_TTL_MS) {
            return filtrosCache.data;
        }

        filtrosCache.promesa = (async () => {
            try {
                const pool = await getConnectionHistorico();
                const allSources = buildUnifiedSourceSubquery({});

                const query = `
                    SELECT 
                        COUNT(*) as total_registros,
                        MIN(COALESCE(fecha_muestreo, fecha_recepcion)) as min_fecha,
                        MAX(COALESCE(fecha_recepcion, fecha_muestreo)) as max_fecha
                    FROM (${allSources}) AS h;

                    SELECT 
                        fuente_origen,
                        formato_origen,
                        COUNT(*) as cantidad,
                        MIN(COALESCE(fecha_muestreo, fecha_recepcion)) as min_fecha,
                        MAX(COALESCE(fecha_recepcion, fecha_muestreo)) as max_fecha
                    FROM (${allSources}) AS h
                    GROUP BY fuente_origen, formato_origen
                    ORDER BY fuente_origen;

                    SELECT DISTINCT TOP 800
                        centro
                    FROM (${allSources}) AS h
                    WHERE centro IS NOT NULL AND centro <> 'NA' AND centro <> ''
                    ORDER BY centro;
                `;

                const result = await pool.request().query(query);

                const totals = result.recordsets[0]?.[0] || {};
                const fuentes = result.recordsets[1] || [];
                const centros = (result.recordsets[2] || []).map(r => r.centro);

                const anos = [
                    { ano: '2006', label: '2006' },
                    { ano: '2007', label: '2007' },
                    { ano: '2008', label: '2008' },
                    { ano: '2009', label: '2009' },
                    { ano: '2010', label: '2010' },
                    { ano: '2011', label: '2011' },
                    { ano: '2012', label: '2012' },
                    { ano: '2013', label: '2013' },
                    { ano: '2014', label: '2014' },
                    { ano: '2015', label: '2015' },
                    { ano: '2016', label: '2016' }
                ];

                const sedes = [
                    { id: 'PM', label: 'Puerto Montt (PM)' },
                    { id: 'AY', label: 'Aysén (AY)' },
                    { id: 'CA', label: 'Castro (CA)' },
                    { id: 'VI', label: 'Villarrica (VI)' }
                ];

                const data = {
                    totals,
                    fuentes,
                    centros,
                    anos,
                    sedes
                };
                filtrosCache.data = data;
                filtrosCache.t = Date.now();
                return data;
            } catch (error) {
                logger.error('Error en HistoricoBiologiaMolecularService.getFiltrosHistorico:', error);
                throw error;
            } finally {
                filtrosCache.promesa = null;
            }
        })();

        return filtrosCache.promesa;
    }

    /**
     * Exportación de Excel (.xlsx nativo) mediante streaming (ExcelJS WorkbookWriter)
     */
    async streamExportExcel(res, filters = {}) {
        try {
            const pool = await getConnectionHistorico();
            const { activeColumns, exportFormat, sourceSubquery, whereClause } = await resolveExportColumns(pool, filters);

            const streamRequest = pool.request();
            buildHistoricoWhereClause(streamRequest, filters);

            const query = `
                SELECT 
                    h.formato_origen,
                    h.n_caso,
                    h.fecha_recepcion,
                    h.fecha_muestreo,
                    h.rut_empresa,
                    h.empresa,
                    h.rut_empresaservicio,
                    h.nombre_empresaservicio,
                    h.centro,
                    h.codigo_centro,
                    h.lugar_analisis,
                    h.programa,
                    h.especie,
                    h.estadio,
                    h.lote,
                    h.contenedor,
                    h.tipo_agua,
                    h.tipo_muestra,
                    h.tipo_muestreo,
                    h.tejido_matriz,
                    h.n_muestras,
                    h.pool,
                    h.pol_npooles,
                    h.pol_npeces,
                    h.tecnica,
                    h.agente,
                    h.ct,
                    h.genovariante,
                    h.resultado,
                    h.ct2,
                    h.resultado2,
                    h.positivos,
                    h.negativos,
                    h.intensidad,
                    h.expr1,
                    h.estado_caso,
                    h.fuente_origen
                FROM (${sourceSubquery}) AS h
                ${whereClause}
                ORDER BY 
                    h.formato_origen ASC,
                    h.id_caso ASC;
            `;

            return new Promise((resolve, reject) => {
                const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
                    stream: res,
                    useStyles: true,
                    useSharedStrings: false
                });

                let rowCount = 0;
                const solo_menor_ct = Boolean(filters.solo_menor_ct);
                const menorCTMap = solo_menor_ct ? new Map() : null;

                let currentFormat = null;
                let currentSheet = null;
                let currentCols = [];

                const initSheetForFormat = (fmt) => {
                    if (currentSheet) {
                        currentSheet.commit();
                    }
                    currentFormat = fmt;
                    currentCols = getColumnsForFormat(fmt, filters);

                    let sheetTitle = 'Histórico ADL';
                    if (exportFormat !== 'MIXTO' && filters.ano && String(filters.ano) !== 'ALL') {
                        sheetTitle = `Histórico ADL ${filters.ano}`;
                    } else if (fmt === 'FORMATO_1') {
                        sheetTitle = 'Histórico 2006-2008';
                    } else if (fmt === 'FORMATO_2') {
                        sheetTitle = 'Histórico 2009-2012';
                    } else if (fmt === 'FORMATO_3') {
                        sheetTitle = 'Histórico 2013-2016';
                    }

                    currentSheet = workbook.addWorksheet(sheetTitle);
                    currentSheet.columns = currentCols.map(col => ({
                        header: col.header,
                        key: col.key,
                        width: col.width
                    }));

                    const headerRow = currentSheet.getRow(1);
                    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                    headerRow.commit();
                };

                const buildRowData = (row, cols) => {
                    const rowData = {};
                    for (const col of cols) {
                        if (col.key === 'fecha_recepcion' || col.key === 'fecha_muestreo') {
                            rowData[col.key] = formatDisplayDate(row[col.key]);
                        } else if (col.key === 'ct') {
                            rowData[col.key] = (row.ct !== null && row.ct !== undefined && row.ct !== '') ? row.ct : (row.genovariante ?? '');
                        } else if (col.key === 'n_muestras' && row.formato_origen === 'FORMATO_1') {
                            rowData[col.key] = row.pool ? `${row.n_muestras ?? ''} (${row.pool})`.trim() : (row.n_muestras ?? '');
                        } else {
                            rowData[col.key] = row[col.key] ?? '';
                        }
                    }
                    return rowData;
                };

                streamRequest.stream = true;

                streamRequest.on('row', (rawRow) => {
                    const row = sanitizeSingleRow(rawRow);

                    if (solo_menor_ct) {
                        const ctVal = parseNumericCT(row.ct);
                        if (ctVal !== null && ctVal <= 28) {
                            const dedupeKey = `${String(row.formato_origen || '')}|||${String(row.n_caso || '').trim()}|||${String(row.tejido_matriz || '').trim()}|||${String(row.agente || row.tecnica || '').trim()}`;
                            const existing = menorCTMap.get(dedupeKey);
                            if (!existing || ctVal < existing._numericCT) {
                                menorCTMap.set(dedupeKey, { ...row, _numericCT: ctVal });
                            }
                        }
                        return;
                    }

                    const rowFmt = row.formato_origen || (exportFormat !== 'MIXTO' ? exportFormat : 'FORMATO_3');
                    if (currentFormat !== rowFmt || !currentSheet) {
                        initSheetForFormat(rowFmt);
                    }

                    const excelRow = currentSheet.addRow(buildRowData(row, currentCols));
                    excelRow.commit();
                    rowCount++;
                });

                streamRequest.on('error', (err) => {
                    logger.error('Error durante streaming de consulta histórica SQL:', err);
                    reject(err);
                });

                streamRequest.on('done', async () => {
                    try {
                        if (solo_menor_ct && menorCTMap) {
                            const sortedRows = Array.from(menorCTMap.values());
                            for (const row of sortedRows) {
                                const rowFmt = row.formato_origen || (exportFormat !== 'MIXTO' ? exportFormat : 'FORMATO_3');
                                if (currentFormat !== rowFmt || !currentSheet) {
                                    initSheetForFormat(rowFmt);
                                }
                                const excelRow = currentSheet.addRow(buildRowData(row, currentCols));
                                excelRow.commit();
                                rowCount++;
                            }
                        }

                        if (!currentSheet) {
                            initSheetForFormat(exportFormat !== 'MIXTO' ? exportFormat : 'FORMATO_3');
                        }
                        if (currentSheet) {
                            currentSheet.commit();
                        }

                        await workbook.commit();
                        logger.info(`streamExportExcel completado con éxito: ${rowCount} filas exportadas a Excel`);
                        resolve();
                    } catch (wbErr) {
                        logger.error('Error al finalizar workbook de Excel histórico:', wbErr);
                        reject(wbErr);
                    }
                });

                streamRequest.query(query);
            });
        } catch (error) {
            logger.error('Error en HistoricoBiologiaMolecularService.streamExportExcel:', error);
            throw error;
        }
    }

    /**
     * Exportación de CSV nativo vía streaming
     */
    async streamExportCsv(res, filters = {}) {
        try {
            const pool = await getConnectionHistorico();
            const { activeColumns, sourceSubquery, whereClause } = await resolveExportColumns(pool, filters);

            const streamRequest = pool.request();
            buildHistoricoWhereClause(streamRequest, filters);

            const query = `
                SELECT 
                    h.formato_origen,
                    h.n_caso,
                    h.fecha_recepcion,
                    h.fecha_muestreo,
                    h.rut_empresa,
                    h.empresa,
                    h.rut_empresaservicio,
                    h.nombre_empresaservicio,
                    h.centro,
                    h.codigo_centro,
                    h.lugar_analisis,
                    h.programa,
                    h.especie,
                    h.estadio,
                    h.lote,
                    h.contenedor,
                    h.tipo_agua,
                    h.tipo_muestra,
                    h.tipo_muestreo,
                    h.tejido_matriz,
                    h.n_muestras,
                    h.pool,
                    h.pol_npooles,
                    h.pol_npeces,
                    h.tecnica,
                    h.agente,
                    h.ct,
                    h.genovariante,
                    h.resultado,
                    h.ct2,
                    h.resultado2,
                    h.positivos,
                    h.negativos,
                    h.intensidad,
                    h.expr1,
                    h.estado_caso,
                    h.fuente_origen
                FROM (${sourceSubquery}) AS h
                ${whereClause}
                ORDER BY 
                    h.formato_origen ASC,
                    h.id_caso ASC;
            `;

            return new Promise((resolve, reject) => {
                res.write('\uFEFF');

                const headerRow = activeColumns.map(col => col.header).join(';') + '\r\n';
                res.write(headerRow);

                let rowCount = 0;
                const solo_menor_ct = Boolean(filters.solo_menor_ct);
                const menorCTMap = solo_menor_ct ? new Map() : null;

                const buildCsvLine = (row) => {
                    return activeColumns.map(col => {
                        if (col.key === 'fecha_recepcion' || col.key === 'fecha_muestreo') {
                            return escapeCsv(formatDisplayDate(row[col.key]));
                        }
                        if (col.key === 'ct') {
                            const val = (row.ct !== null && row.ct !== undefined && row.ct !== '') ? row.ct : (row.genovariante ?? '');
                            return escapeCsv(val);
                        }
                        return escapeCsv(row[col.key]);
                    }).join(';') + '\r\n';
                };

                streamRequest.stream = true;

                streamRequest.on('row', (rawRow) => {
                    const row = sanitizeSingleRow(rawRow);

                    if (solo_menor_ct) {
                        const ctVal = parseNumericCT(row.ct);
                        if (ctVal !== null && ctVal <= 28) {
                            const dedupeKey = `${String(row.n_caso || '').trim()}|||${String(row.tejido_matriz || '').trim()}|||${String(row.agente || row.tecnica || '').trim()}`;
                            const existing = menorCTMap.get(dedupeKey);
                            if (!existing || ctVal < existing._numericCT) {
                                menorCTMap.set(dedupeKey, { ...row, _numericCT: ctVal });
                            }
                        }
                        return;
                    }

                    res.write(buildCsvLine(row));
                    rowCount++;
                });

                streamRequest.on('error', (err) => {
                    logger.error('Error streaming CSV histórico SQL:', err);
                    reject(err);
                });

                streamRequest.on('done', () => {
                    if (solo_menor_ct && menorCTMap) {
                        for (const row of menorCTMap.values()) {
                            res.write(buildCsvLine(row));
                            rowCount++;
                        }
                    }

                    res.end();
                    logger.info(`streamExportCsv completado con éxito: ${rowCount} filas exportadas a CSV`);
                    resolve();
                });

                streamRequest.query(query);
            });
        } catch (error) {
            logger.error('Error en HistoricoBiologiaMolecularService.streamExportCsv:', error);
            throw error;
        }
    }
}

// ============================================================================
// SUBCONSULTA DINÁMICA SOBRE LAS 3 TABLAS HISTÓRICAS
// ============================================================================

const SELECT_2006_2008 = `
    SELECT
        id_registro AS id_caso,
        'FORMATO_1' AS formato_origen,
        n_caso,
        CAST(NULL AS VARCHAR(50)) AS rut_empresa,
        empresa,
        CAST(NULL AS VARCHAR(50)) AS rut_empresaservicio,
        CAST(NULL AS VARCHAR(255)) AS nombre_empresaservicio,
        programa,
        centro,
        CAST(NULL AS VARCHAR(100)) AS codigo_centro,
        lugar_analisis,
        especie,
        estadio,
        lote,
        CAST(NULL AS VARCHAR(255)) AS contenedor,
        tipo_agua,
        tipo_muestra,
        tipo_muestreo,
        tejido AS tejido_matriz,
        n_muestras,
        pool,
        CAST(NULL AS INT) AS pol_npooles,
        CAST(NULL AS INT) AS pol_npeces,
        fecha_muestreo,
        fecha_recepcion,
        tecnica,
        agente,
        resultado,
        CAST(NULL AS VARCHAR(50)) AS resultado2,
        CAST(NULL AS DECIMAL(8,4)) AS ct,
        CAST(NULL AS DECIMAL(8,4)) AS ct2,
        CAST(NULL AS VARCHAR(20)) AS genovariante,
        positivos,
        negativos,
        intensidad,
        expr1,
        CAST(NULL AS VARCHAR(50)) AS estado_caso,
        fuente_origen
    FROM dbo.historico_bmo_2006_2008 WITH (NOLOCK)
`;

const SELECT_2009_2012 = `
    SELECT
        id_registro AS id_caso,
        'FORMATO_2' AS formato_origen,
        caso_adlab AS n_caso,
        rut_empresa,
        nombre_empresa AS empresa,
        rut_empresaservicio,
        nombre_empresaservicio,
        programa,
        nombre_centro AS centro,
        CAST(NULL AS VARCHAR(100)) AS codigo_centro,
        CAST(NULL AS VARCHAR(100)) AS lugar_analisis,
        CAST(NULL AS VARCHAR(100)) AS especie,
        CAST(NULL AS VARCHAR(100)) AS estadio,
        CAST(NULL AS VARCHAR(150)) AS lote,
        CAST(NULL AS VARCHAR(255)) AS contenedor,
        CAST(NULL AS VARCHAR(100)) AS tipo_agua,
        CAST(NULL AS VARCHAR(150)) AS tipo_muestra,
        CAST(NULL AS VARCHAR(150)) AS tipo_muestreo,
        matriz AS tejido_matriz,
        CAST(NULL AS INT) AS n_muestras,
        pool,
        CAST(NULL AS INT) AS pol_npooles,
        CAST(NULL AS INT) AS pol_npeces,
        fecha_muestreo,
        fecha_recepcion,
        CAST(NULL AS VARCHAR(100)) AS tecnica,
        agente,
        resultado,
        resultado2,
        ct,
        ct2,
        CAST(NULL AS VARCHAR(20)) AS genovariante,
        positivos,
        CAST(NULL AS INT) AS negativos,
        CAST(NULL AS VARCHAR(100)) AS intensidad,
        CAST(NULL AS VARCHAR(255)) AS expr1,
        CAST(NULL AS VARCHAR(50)) AS estado_caso,
        fuente_origen
    FROM dbo.historico_bmo_2009_2012 WITH (NOLOCK)
`;

const SELECT_2013_2016 = `
    SELECT
        id_registro AS id_caso,
        'FORMATO_3' AS formato_origen,
        caso_adlab AS n_caso,
        rut_empresa,
        nombre_empresa AS empresa,
        rut_empresaservicio,
        nombre_empresaservicio,
        CAST(NULL AS VARCHAR(255)) AS programa,
        nombre_centro AS centro,
        codigo_centro,
        CAST(NULL AS VARCHAR(100)) AS lugar_analisis,
        CAST(NULL AS VARCHAR(100)) AS especie,
        CAST(NULL AS VARCHAR(100)) AS estadio,
        lote,
        contenedor,
        CAST(NULL AS VARCHAR(100)) AS tipo_agua,
        CAST(NULL AS VARCHAR(150)) AS tipo_muestra,
        CAST(NULL AS VARCHAR(150)) AS tipo_muestreo,
        nombre_organo AS tejido_matriz,
        pol_npeces AS n_muestras,
        CAST(pool AS VARCHAR(50)) AS pool,
        pol_npooles,
        pol_npeces,
        CAST(NULL AS DATE) AS fecha_muestreo,
        fecha_recepcion,
        nombre_tecnica AS tecnica,
        nombre_tecnica AS agente,
        resultado,
        genovariante AS resultado2,
        ct,
        CAST(NULL AS DECIMAL(8,4)) AS ct2,
        genovariante,
        CAST(NULL AS INT) AS positivos,
        CAST(NULL AS INT) AS negativos,
        CAST(NULL AS VARCHAR(100)) AS intensidad,
        CAST(NULL AS VARCHAR(255)) AS expr1,
        estado_caso,
        fuente_origen
    FROM dbo.historico_bmo_2013_2016 WITH (NOLOCK)
`;

function resolveTargetFormats(filters = {}) {
    const { ano, fecha_desde, fecha_hasta, fuente_origen } = filters;

    if (fuente_origen && fuente_origen !== 'ALL') {
        const m = String(fuente_origen).match(/(20\d\d)/);
        if (m) {
            const y = parseInt(m[1], 10);
            if (y <= 2008) return ['FORMATO_1'];
            if (y <= 2012) return ['FORMATO_2'];
            return ['FORMATO_3'];
        }
    }

    if (ano && String(ano) !== 'ALL') {
        const y = parseInt(String(ano), 10);
        if (!isNaN(y)) {
            if (y <= 2008) return ['FORMATO_1'];
            if (y <= 2012) return ['FORMATO_2'];
            return ['FORMATO_3'];
        }
    }

    if (fecha_desde || fecha_hasta) {
        const yDesde = fecha_desde ? parseInt(String(fecha_desde).slice(0, 4), 10) : 2006;
        const yHasta = fecha_hasta ? parseInt(String(fecha_hasta).slice(0, 4), 10) : 2016;
        if (!isNaN(yDesde) && !isNaN(yHasta)) {
            const targets = [];
            if (yDesde <= 2008 && yHasta >= 2004) targets.push('FORMATO_1');
            if (yDesde <= 2012 && yHasta >= 2008) targets.push('FORMATO_2');
            if (yDesde <= 2016 && yHasta >= 2013) targets.push('FORMATO_3');
            if (targets.length > 0) return targets;
        }
    }

    return ['FORMATO_1', 'FORMATO_2', 'FORMATO_3'];
}

function buildUnifiedSourceSubquery(filters = {}) {
    const targets = resolveTargetFormats(filters);
    const parts = [];
    if (targets.includes('FORMATO_1')) parts.push(SELECT_2006_2008);
    if (targets.includes('FORMATO_2')) parts.push(SELECT_2009_2012);
    if (targets.includes('FORMATO_3')) parts.push(SELECT_2013_2016);
    return parts.join('\nUNION ALL\n');
}

function buildHistoricoWhereClause(request, filters = {}) {
    const conditions = [];
    const {
        fecha_desde = '2006-01-01',
        fecha_hasta = '2016-12-31',
        ano = null,
        sede = null,
        fuente_origen = null,
        resultado = 'ALL',
        centro = 'ALL',
        busqueda = '',
        solo_menor_ct = false
    } = filters;

    if (solo_menor_ct) {
        conditions.push('(h.ct IS NOT NULL AND h.ct > 0 AND h.ct <= 28)');
    }

    const hasSpecificYear = Boolean(ano && String(ano) !== 'ALL');
    if (hasSpecificYear) {
        request.input('ano_str', sql.VarChar(15), `%${ano}%`);
        conditions.push('h.fuente_origen LIKE @ano_str');
    }

    const isCustomDesde = Boolean(fecha_desde && (!hasSpecificYear || fecha_desde !== `${ano}-01-01`));
    const isCustomHasta = Boolean(fecha_hasta && (!hasSpecificYear || fecha_hasta !== `${ano}-12-31`));

    if (isCustomDesde) {
        request.input('fecha_desde', sql.Date, fecha_desde);
        conditions.push('COALESCE(h.fecha_muestreo, h.fecha_recepcion) >= @fecha_desde');
    }
    if (isCustomHasta) {
        request.input('fecha_hasta', sql.Date, fecha_hasta);
        conditions.push('COALESCE(h.fecha_muestreo, h.fecha_recepcion) <= @fecha_hasta');
    }

    // Filtro por Sede (PM, AY, CA, VI): soporta nombre de archivo (2006-2012) y prefijo de caso_adlab (2009-2016)
    if (sede && sede !== 'ALL') {
        const cleanSede = String(sede).trim().toUpperCase();
        request.input('sede_file_pattern', sql.VarChar(50), `%_${cleanSede}-%`);
        request.input('sede_caso_pattern', sql.VarChar(50), `${cleanSede}-%`);
        conditions.push('(h.fuente_origen LIKE @sede_file_pattern OR h.n_caso LIKE @sede_caso_pattern)');
    }

    if (fuente_origen && fuente_origen !== 'ALL') {
        request.input('fuente_origen', sql.VarChar(150), fuente_origen.trim());
        conditions.push('h.fuente_origen = @fuente_origen');
    }

    if (centro && centro !== 'ALL') {
        request.input('centro', sql.VarChar(255), centro.trim());
        conditions.push('h.centro = @centro');
    }

    if (resultado === 'POSITIVO') {
        conditions.push("(LOWER(TRIM(h.resultado)) IN ('p', 'pos', 'positivo') OR LOWER(h.resultado) LIKE '%pos%')");
    } else if (resultado === 'NEGATIVO') {
        conditions.push("(LOWER(TRIM(h.resultado)) IN ('n', 'neg', 'negativo') OR LOWER(h.resultado) LIKE '%neg%')");
    } else if (resultado === 'OTROS') {
        conditions.push("(LOWER(TRIM(h.resultado)) NOT IN ('p', 'pos', 'positivo', 'n', 'neg', 'negativo') AND LOWER(h.resultado) NOT LIKE '%pos%' AND LOWER(h.resultado) NOT LIKE '%neg%')");
    }

    if (busqueda && busqueda.trim()) {
        request.input('search', sql.NVarChar(200), `%${busqueda.trim()}%`);
        conditions.push(`(
            h.n_caso LIKE @search
            OR h.centro LIKE @search
            OR h.codigo_centro LIKE @search
            OR h.empresa LIKE @search
            OR h.rut_empresa LIKE @search
            OR h.nombre_empresaservicio LIKE @search
            OR h.rut_empresaservicio LIKE @search
            OR h.agente LIKE @search
            OR h.tecnica LIKE @search
            OR h.programa LIKE @search
            OR h.tejido_matriz LIKE @search
            OR h.lote LIKE @search
            OR h.contenedor LIKE @search
            OR h.genovariante LIKE @search
        )`);
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

function getColumnsForFormat(fmt, filters = {}) {
    const is2006 = String(filters.ano || '') === '2006';
    const is2009 = String(filters.ano || '') === '2009';

    const FORMATO_1_COLS = [
        { key: 'n_caso', header: 'N CASO', width: 14 },
        { key: 'empresa', header: 'EMPRESA', width: 26 },
        { key: 'programa', header: 'PROGRAMA', width: 24 },
        { key: 'centro', header: 'CENTRO', width: 28 },
        ...(is2006 ? [] : [{ key: 'lugar_analisis', header: 'LUGAR ANALISIS', width: 18 }]),
        { key: 'especie', header: 'ESPECIE', width: 18 },
        { key: 'estadio', header: 'ESTADIO', width: 16 },
        { key: 'lote', header: 'LOTE', width: 18 },
        { key: 'tipo_agua', header: 'TIPO AGUA', width: 16 },
        { key: 'tipo_muestra', header: 'TIPO MUESTRA', width: 18 },
        { key: 'tipo_muestreo', header: 'TIPO MUESTREO', width: 18 },
        { key: 'n_muestras', header: 'N MUESTRAS', width: 14 },
        { key: 'fecha_recepcion', header: 'FECHA RECEPCION', width: 16 },
        { key: 'fecha_muestreo', header: 'FECHA MUESTREO', width: 16 },
        { key: 'tecnica', header: 'TECNICA', width: 22 },
        { key: 'agente', header: 'AGENTE', width: 28 },
        { key: 'tejido_matriz', header: 'TEJIDO', width: 20 },
        { key: 'expr1', header: 'EXPR1', width: 12 },
        { key: 'positivos', header: 'POSITIVOS', width: 12 },
        { key: 'negativos', header: 'NEGATIVOS', width: 12 },
        { key: 'intensidad', header: 'INTENSIDAD', width: 14 }
    ];

    const FORMATO_2_COLS = [
        { key: 'n_caso', header: 'caso_adlab', width: 14 },
        ...(is2009 ? [] : [
            { key: 'rut_empresa', header: 'rut_empresa', width: 16 },
            { key: 'empresa', header: 'nombre_empresa', width: 28 },
            { key: 'rut_empresaservicio', header: 'rut_empresaservicio', width: 18 },
            { key: 'nombre_empresaservicio', header: 'nombre_empresaservicio', width: 28 }
        ]),
        { key: 'centro', header: 'nombre_centro', width: 28 },
        { key: 'programa', header: 'programa', width: 24 },
        { key: 'tejido_matriz', header: 'matriz', width: 20 },
        { key: 'pool', header: 'pool', width: 10 },
        { key: 'agente', header: 'agente', width: 32 },
        { key: 'ct', header: 'ct', width: 12 },
        { key: 'resultado', header: 'resultado', width: 14 },
        { key: 'resultado2', header: 'resultado2', width: 14 },
        { key: 'ct2', header: 'ct2', width: 12 },
        { key: 'positivos', header: 'positivos', width: 12 },
        { key: 'fecha_muestreo', header: 'fecha_muestreo', width: 16 },
        { key: 'fecha_recepcion', header: 'fecha_recepcion', width: 16 }
    ];

    const FORMATO_3_COLS = [
        { key: 'n_caso', header: 'caso_adlab', width: 14 },
        { key: 'rut_empresa', header: 'rut_empresa', width: 16 },
        { key: 'empresa', header: 'nombre_empresa', width: 28 },
        { key: 'rut_empresaservicio', header: 'rut_empresaservicio', width: 18 },
        { key: 'nombre_empresaservicio', header: 'nombre_empresaservicio', width: 28 },
        { key: 'fecha_recepcion', header: 'fecha_recepcion', width: 16 },
        { key: 'lote', header: 'lote', width: 22 },
        { key: 'contenedor', header: 'contenedor', width: 24 },
        { key: 'centro', header: 'nombre_centro', width: 28 },
        { key: 'codigo_centro', header: 'codigo_centro', width: 16 },
        { key: 'tecnica', header: 'nombre_tecnica', width: 32 },
        { key: 'tejido_matriz', header: 'nombre_organo', width: 22 },
        { key: 'pool', header: 'pool', width: 10 },
        { key: 'resultado', header: 'resultado', width: 14 },
        { key: 'pol_npooles', header: 'pol_npooles', width: 12 },
        { key: 'pol_npeces', header: 'pol_npeces', width: 12 },
        { key: 'ct', header: 'ct', width: 12 },
        { key: 'estado_caso', header: 'estado_caso', width: 14 }
    ];

    const MIXTO_COLS = [
        { key: 'n_caso', header: 'N° Caso', width: 14 },
        { key: 'fecha_recepcion', header: 'Fecha Recepción', width: 16 },
        { key: 'fecha_muestreo', header: 'Fecha Muestreo', width: 16 },
        { key: 'rut_empresa', header: 'RUT Empresa', width: 16 },
        { key: 'empresa', header: 'Empresa', width: 26 },
        { key: 'rut_empresaservicio', header: 'RUT Emp. Servicio', width: 18 },
        { key: 'nombre_empresaservicio', header: 'Empresa Servicio', width: 26 },
        { key: 'centro', header: 'Centro', width: 28 },
        { key: 'codigo_centro', header: 'Cód. Centro', width: 16 },
        { key: 'programa', header: 'Programa', width: 22 },
        { key: 'lote', header: 'Lote', width: 18 },
        { key: 'contenedor', header: 'Contenedor', width: 20 },
        { key: 'tejido_matriz', header: 'Matriz / Órgano', width: 20 },
        { key: 'agente', header: 'Técnica / Agente', width: 30 },
        { key: 'pool', header: 'Pool', width: 10 },
        { key: 'ct', header: 'CT', width: 12 },
        { key: 'resultado', header: 'Resultado', width: 14 },
        { key: 'positivos', header: 'Positivos', width: 12 },
        { key: 'negativos', header: 'Negativos', width: 12 },
        { key: 'fuente_origen', header: 'Fuente Origen', width: 26 }
    ];

    if (fmt === 'FORMATO_1') return FORMATO_1_COLS;
    if (fmt === 'FORMATO_2') return FORMATO_2_COLS;
    if (fmt === 'FORMATO_3') return FORMATO_3_COLS;
    return MIXTO_COLS;
}

async function resolveExportColumns(pool, filters = {}) {
    const targets = resolveTargetFormats(filters);
    const sourceSubquery = buildUnifiedSourceSubquery(filters);
    const whereClause = buildHistoricoWhereClause(pool.request(), filters);

    const exportFormat = targets.length === 1 ? targets[0] : 'MIXTO';
    const activeColumns = getColumnsForFormat(exportFormat, filters);

    return { activeColumns, exportFormat, sourceSubquery, whereClause };
}

function formatDisplayDate(val) {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val.getTime())) {
        const d = String(val.getUTCDate()).padStart(2, '0');
        const m = String(val.getUTCMonth() + 1).padStart(2, '0');
        const y = val.getUTCFullYear();
        return `${d}/${m}/${y}`;
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const [y, m, d] = str.slice(0, 10).split('-');
        return `${d}/${m}/${y}`;
    }
    return str;
}

function parseNumericCT(val) {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(String(val).replace(',', '.').trim());
    return isNaN(num) ? null : num;
}

function sanitizeSingleRow(row) {
    const cleaned = {};
    for (const [key, val] of Object.entries(row)) {
        if (val === null || val === undefined || val === '') continue;

        const cleanKey = typeof key === 'string'
            ? key.replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
            : key;

        if (typeof val === 'string') {
            const trimmed = val
                .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (trimmed !== '') {
                cleaned[cleanKey] = trimmed;
            }
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

function escapeCsv(val) {
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

export const historicoBiologiaMolecularService = new HistoricoBiologiaMolecularService();
export default historicoBiologiaMolecularService;
