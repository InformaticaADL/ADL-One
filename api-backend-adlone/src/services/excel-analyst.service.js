import ExcelJS from 'exceljs';

const normalize = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const round = (value, digits = 1) => {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const safeDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getMonthKey = (value) => {
    const date = safeDate(value);
    if (!date) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (monthKey) => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('es-CL', {
        month: 'short',
        year: '2-digit',
    });
};

const topEntries = (grouped, limit = 10) =>
    Object.entries(grouped)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);

const countBy = (items, keyFn) =>
    items.reduce((acc, item) => {
        const key = keyFn(item);
        if (key !== null && key !== undefined && key !== '') {
            acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
    }, {});

const sumBy = (items, catFn, valFn) =>
    items.reduce((acc, item) => {
        const key = catFn(item);
        const val = valFn(item);
        if (key !== null && key !== undefined && key !== '' && Number.isFinite(val)) {
            acc[key] = (acc[key] || 0) + val;
        }
        return acc;
    }, {});

const toCard = (id, title, value, helper, tone = 'blue') => ({ id, title, value, helper, tone });
const withHelp = (widget, what, why) => ({ ...widget, help: { what, why } });

// --- Advanced Math Helpers ---
const calculateStdDev = (values, avg) => {
    if (values.length <= 1) return 0;
    const squareDiffs = values.map((value) => {
        const diff = value - avg;
        return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
    return Math.sqrt(avgSquareDiff);
};

const calculatePercentile = (values, p) => {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = lower + 1;
    const weight = index % 1;
    if (upper >= sorted.length) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const buildFrequencyDistribution = (values, binsCount = 10) => {
    if (values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return [{ range: `${min}`, count: values.length }];
    
    const binSize = (max - min) / binsCount;
    const bins = Array.from({ length: binsCount }, (_, i) => ({
        min: min + i * binSize,
        max: min + (i + 1) * binSize,
        count: 0
    }));

    values.forEach(v => {
        const binIndex = Math.min(Math.floor((v - min) / binSize), binsCount - 1);
        bins[binIndex].count++;
    });

    return bins.map(b => ({
        range: `${round(b.min, 1)} - ${round(b.max, 1)}`,
        count: b.count
    }));
};

// --- Hours Specific Helpers ---
const isHoursColumn = (columnName) => {
    const norm = normalize(columnName);
    return ['hora', 'hrs', 'tiempo', 'duracion', 'jornada', 'turno', 'entrada', 'salida', 'minuto', 'inicio', 'fin']
        .some(kw => norm.includes(kw));
};

const extractHoursValue = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    const str = String(value).trim();
    const timeMatch = str.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
        return parseInt(timeMatch[1], 10) + parseInt(timeMatch[2], 10) / 60;
    }
    const num = parseFloat(str.replace(',', '.'));
    return isNaN(num) ? null : num;
};

// --- Core Analyzers ---
const isIdColumnName = (columnName) => {
    const norm = normalize(columnName);
    return ['id', 'rut', 'dni', 'codigo', 'password', 'pass', 'identificador', 'fich', 'nro', 'numero', 'correlativo']
        .some(kw => norm === kw || norm.startsWith(kw + '_') || norm.endsWith('_' + kw) || norm.includes(' ' + kw) || (kw.length > 2 && norm.includes(kw)));
};

const isNumericValue = (value) => {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'number') return true;
    const str = String(value).trim();
    return /^-?\d+([\.,]\d+)?$/.test(str);
};

const looksLikeDate = (value) => {
    if (!value) return false;
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (typeof value === 'number') return false;
    
    const str = String(value).trim();
    if (/^-?\d+(\.\d+)?$/.test(str)) return false; // Prevent simple numbers or floats from being parsed as valid dates
    
    // Require some typical date separators (- or /) to be considered a string date
    if (!str.includes('-') && !str.includes('/')) return false;

    const parsed = new Date(str);
    return !Number.isNaN(parsed.getTime());
};

const inferColumnTypes = (rows, headers) => {
    return headers.map((key) => {
        let numeric = 0, dates = 0, hours = 0, filled = 0;
        const isHourCol = isHoursColumn(key);

        rows.forEach((row) => {
            const value = row[key];
            if (value === null || value === undefined || value === '') return;
            filled += 1;
            if (isNumericValue(value)) numeric += 1;
            if (looksLikeDate(value)) dates += 1;
            if (isHourCol && extractHoursValue(value) !== null) hours += 1;
        });

        const numericRatio = filled ? numeric / filled : 0;
        const dateRatio = filled ? dates / filled : 0;
        const hoursRatio = filled ? hours / filled : 0;

        let type = 'category';
        const uniqueValues = new Set(rows.map(r => r[key]).filter(v => v !== null && v !== undefined && v !== '')).size;
        
        const isIdName = isIdColumnName(key);
        const isUniqueId = filled > 10 && uniqueValues > (filled * 0.9);

        if (isIdName || isUniqueId) {
            type = 'id';
        } else if (hoursRatio >= 0.5) {
            type = 'hours';
        } else if (dateRatio >= 0.5) {
            type = 'date';
        } else if (numericRatio >= 0.5) {
            type = 'number';
        }

        return { key, type };
    });
};

const getWorksheetHeaders = (worksheet) => {
    const headers = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || `columna_${colNumber}`).trim();
    });
    return headers;
};

const getWorksheetRows = (worksheet, headers) => {
    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record = {};
        headers.forEach((header, index) => {
            const cell = row.getCell(index + 1);
            const value = cell.value && typeof cell.value === 'object' && 'text' in cell.value
                ? cell.value.text
                : cell.value;
            record[header] = value ?? null;
        });
        if (Object.values(record).some((v) => v !== null && v !== '')) {
            rows.push(record);
        }
    });
    return rows;
};

const analyzeWorksheet = (worksheet) => {
    const headers = getWorksheetHeaders(worksheet);
    const rows = getWorksheetRows(worksheet, headers);

    if (!rows.length) return null;

    const columns = inferColumnTypes(rows, headers);
    const numericColumns = columns.filter((c) => c.type === 'number');
    const dateColumns = columns.filter((c) => c.type === 'date');
    const hoursColumns = columns.filter((c) => c.type === 'hours');
    const categoryColumns = columns.filter((c) => c.type === 'category');

    const kpis = [];
    const widgets = [];
    const insights = [];

    // --- KPIs basados en datos ---
    numericColumns.slice(0, 3).forEach((col, idx) => {
        let sum = 0;
        let count = 0;
        let max = -Infinity;
        rows.forEach(r => {
            const v = r[col.key];
            if (v === null || v === undefined || v === '') return;
            let num = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
            if (Number.isFinite(num)) {
                sum += num;
                count++;
                if (num > max) max = num;
            }
        });
        if (count > 0) {
            const avg = sum / count;
            if (idx === 0) kpis.push(toCard(`s-sum-${col.key}`, `Total ${col.key}`, round(sum, 2), 'Suma total', 'blue'));
            if (idx === 1) kpis.push(toCard(`s-avg-${col.key}`, `Promedio ${col.key}`, round(avg, 2), 'Valor medio', 'teal'));
            if (idx === 2) kpis.push(toCard(`s-max-${col.key}`, `Max ${col.key}`, round(max, 2), 'Valor máximo', 'orange'));
        }
    });

    hoursColumns.slice(0, 1).forEach((col) => {
        const vals = rows.map(r => extractHoursValue(r[col.key])).filter(v => v !== null);
        if (vals.length > 0) {
            const sum = vals.reduce((a, b) => a + b, 0);
            kpis.push(toCard(`s-th-${col.key}`, `Total ${col.key}`, round(sum, 1), 'Horas contabilizadas', 'grape'));
        }
    });

    categoryColumns.slice(0, 2).forEach((col, idx) => {
        const grouped = countBy(rows, r => r[col.key]);
        const top = topEntries(grouped, 1);
        if (top.length > 0) {
            kpis.push(toCard(`s-top-${col.key}`, `Top ${col.key}`, top[0].name, `${top[0].value} registros`, idx === 0 ? 'pink' : 'violet'));
        }
    });

    // --- Cruces: Categoría x Número ---
    if (categoryColumns.length > 0 && numericColumns.length > 0) {
        const cat = categoryColumns[0];
        const num = numericColumns[0];
        
        const sumByCat = sumBy(rows, r => r[cat.key], r => {
            const v = r[num.key];
            return typeof v === 'number' ? v : parseFloat(String(v || '').replace(',', '.'));
        });
        
        const topSums = topEntries(sumByCat, 10);
        
        if (topSums.length > 0) {
            widgets.push(withHelp({
                id: `cross-${cat.key}-${num.key}`,
                type: 'bar',
                title: `${num.key} por ${cat.key}`,
                data: topSums,
                xKey: 'name',
                yKeys: ['value']
            }, `Muestra la suma de ${num.key} agrupada por ${cat.key}.`, `Permite identificar qué grupos de ${cat.key} concentran mayor volumen de ${num.key}.`));

            const topCat = topSums[0];
            const totalSum = topSums.reduce((a, b) => a + b.value, 0);
            const percentage = round((topCat.value / totalSum) * 100, 1);
            
            insights.push({
                level: percentage > 50 ? 'warning' : 'normal',
                title: `Concentración en ${cat.key}`,
                narrative: `El grupo '${topCat.name}' concentra el ${percentage}% del total de ${num.key} (Suma: ${round(topCat.value, 1)}).`,
                recommendation: percentage > 50 ? `Alta dependencia en '${topCat.name}'. Evaluar diversificación operativa.` : `La distribución de ${num.key} entre los grupos es equilibrada.`
            });
        }
    }

    // --- Cruces: Fecha x Número (Tendencias) ---
    if (dateColumns.length > 0 && numericColumns.length > 0) {
        const dateCol = dateColumns[0];
        const numCol = numericColumns[0];
        
        const trend = new Map();
        rows.forEach(row => {
            const m = getMonthKey(row[dateCol.key]);
            if (!m) return;
            const current = trend.get(m) || { sum: 0 };
            const v = row[numCol.key];
            if (isNumericValue(v)) {
                current.sum += typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
            }
            trend.set(m, current);
        });

        const trendData = [...trend.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([m, val]) => ({
            label: getMonthLabel(m),
            value: round(val.sum, 2)
        }));

        if (trendData.length > 1) {
            widgets.push(withHelp({
                id: `trend-${dateCol.key}-${numCol.key}`,
                type: 'area',
                title: `Evolución de ${numCol.key}`,
                data: trendData,
                xKey: 'label',
                yKeys: ['value']
            }, `Evolución mensual de ${numCol.key}.`, 'Ayuda a visualizar tendencias históricas, crecimiento o caídas operativas.'));

            const first = trendData[0].value;
            const last = trendData[trendData.length - 1].value;
            const growth = first === 0 ? 0 : round(((last - first) / first) * 100, 1);
            
            insights.push({
                level: growth < 0 ? 'warning' : 'normal',
                title: `Tendencia de ${numCol.key}`,
                narrative: `Comparando el inicio y fin del periodo analizado, ${numCol.key} ha tenido una variación del ${growth}%.`,
                recommendation: growth < 0 ? 'Se detecta una tendencia a la baja. Investigar causas de la contracción.' : 'Crecimiento positivo validado en el último periodo.'
            });
        }
    }

    // --- Distribuciones de Categóricas (Composición) ---
    categoryColumns.slice(0, 2).forEach((cat, idx) => {
        const dist = topEntries(countBy(rows, r => r[cat.key]), 8);
        if (dist.length > 0) {
            widgets.push(withHelp({
                id: `comp-${cat.key}`,
                type: idx === 0 ? 'donut' : 'bar',
                title: idx === 0 ? `Composición de ${cat.key}` : `Top registros por ${cat.key}`,
                data: dist,
                xKey: 'name',
                yKeys: ['value']
            }, `Distribución de registros por ${cat.key}.`, 'Permite ver el peso relativo de cada categoría en la operación.'));
        }
    });

    // --- Histograma y Estadísticas ---
    if (numericColumns.length > 0) {
        const numCol = numericColumns[0];
        const vals = rows.map(r => {
            const v = r[numCol.key];
            return typeof v === 'number' ? v : parseFloat(String(v || '').replace(',', '.'));
        }).filter(v => Number.isFinite(v));
        
        if (vals.length > 0) {
            const freq = buildFrequencyDistribution(vals, 10);
            widgets.push(withHelp({
                id: `hist-${numCol.key}`,
                type: 'bar',
                title: `Distribución de frecuencias (${numCol.key})`,
                data: freq,
                xKey: 'range',
                yKeys: ['count']
            }, `Histograma que muestra cómo se agrupan los valores de ${numCol.key}.`, 'Identifica el rango más común y la dispersión general.'));
            
            const statsData = numericColumns.map(col => {
                const colVals = rows.map(r => {
                    const v = r[col.key];
                    return typeof v === 'number' ? v : parseFloat(String(v || '').replace(',', '.'));
                }).filter(v => Number.isFinite(v));
                const total = colVals.reduce((a, b) => a + b, 0);
                const avg = colVals.length ? total / colVals.length : 0;
                const p50 = calculatePercentile(colVals, 50);
                const std = calculateStdDev(colVals, avg);
                return {
                    column: col.key,
                    total: round(total, 2),
                    average: round(avg, 2),
                    median: round(p50, 2),
                    stdDev: round(std, 2)
                };
            });

            widgets.push(withHelp({
                id: `stats-${worksheet.name}`,
                type: 'table',
                title: 'Desempeño General (Métricas)',
                columns: ['column', 'total', 'average', 'median', 'stdDev'],
                data: statsData
            }, 'Tabla de estadísticas descriptivas.', 'Para un análisis numérico detallado de los promedios y variabilidad.'));
        }
    }

    // --- Análisis de Horas (Si Aplica) ---
    if (hoursColumns.length > 0) {
        const hourCol = hoursColumns[0];
        if (categoryColumns.length > 0) {
            const catCol = categoryColumns[0];
            const sumHoursByCat = sumBy(rows, r => r[catCol.key], r => extractHoursValue(r[hourCol.key]));
            const topHours = topEntries(sumHoursByCat, 8);
            
            if (topHours.length > 0) {
                widgets.push(withHelp({
                    id: `hours-${catCol.key}`,
                    type: 'bar',
                    title: `Consumo de Tiempo por ${catCol.key}`,
                    data: topHours,
                    xKey: 'name',
                    yKeys: ['value']
                }, `Horas totales invertidas agrupadas por ${catCol.key}.`, 'Identifica dónde se está invirtiendo el mayor esfuerzo laboral.'));
            }
        }
    }

    // Si no pudimos generar nada (ej. excel puramente texto sin categorías repetidas), generar algo básico
    if (widgets.length === 0) {
        insights.push({
            level: 'warning',
            title: 'Pocos datos estructurados',
            narrative: 'La hoja no contiene columnas numéricas o categóricas repetidas claras para correlacionar.',
            recommendation: 'Asegúrate de que los datos tengan formato tabular con columnas identificables.'
        });
    }

    return {
        sheetName: worksheet.name,
        profile: {
            rows: rows.length,
            columns: headers.length,
            numericColumns: numericColumns.map(c => c.key),
            dateColumns: dateColumns.map(c => c.key),
            categoryColumns: categoryColumns.map(c => c.key),
            hoursColumns: hoursColumns.map(c => c.key)
        },
        kpis,
        widgets,
        insights
    };
};

export const analyzeExcelBufferAdvanced = async (buffer, fileName = 'dataset.xlsx') => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    let sheets = workbook.worksheets.map(analyzeWorksheet).filter(Boolean);

    if (!sheets.length) {
        throw new Error('El archivo Excel no pudo ser leído correctamente o está vacío.');
    }

    // Si por alguna razón filtré todas las hojas porque no tenían widgets, relajo el filtro
    const validSheets = sheets.filter(s => s.widgets.length > 0);
    if (validSheets.length > 0) {
        sheets = validSheets;
    }

    // Cross-Sheet Aggregations for Executive Summary
    let globalTotalMetrics = 0;
    let globalTotalHours = 0;
    
    sheets.forEach(s => {
        s.kpis.forEach(kpi => {
            if (kpi.title.startsWith('Total ') && typeof kpi.value === 'number') {
                globalTotalMetrics += kpi.value;
            }
            if (kpi.id.includes('-th-') && typeof kpi.value === 'number') {
                globalTotalHours += kpi.value;
            }
        });
    });

    const kpis = [];
    kpis.push(toCard('wb-metrics', 'Volumen Global', round(globalTotalMetrics, 1), 'Suma de métricas', 'blue'));
    
    if (globalTotalHours > 0) {
        kpis.push(toCard('wb-hours', 'Esfuerzo Total', round(globalTotalHours, 1), 'Horas consolidadas', 'grape'));
    }
    
    // Cross-Sheet Best Category
    const globalTopCats = sheets.flatMap(s => s.kpis.filter(k => k.title.startsWith('Top ')));
    if (globalTopCats.length > 0) {
        const topCat = globalTopCats[0];
        kpis.push(toCard('wb-top', topCat.title, topCat.value, 'Mencion recurrente en todo el libro', 'pink'));
    }

    const widgets = [];
    const dominantSheet = sheets.sort((a,b) => b.profile.rows - a.profile.rows)[0];

    const insights = [
        {
            level: 'normal',
            title: 'Resumen Ejecutivo',
            narrative: `Análisis de negocio generado. El mayor volumen de datos está en "${dominantSheet.sheetName}". Se consolidaron métricas globales equivalentes a un volumen de ${round(globalTotalMetrics, 1)}.`,
            recommendation: 'Revisa las pestañas individuales para descubrir cruces de datos y tendencias específicas.'
        }
    ];

    return {
        fileName,
        generatedAt: new Date().toISOString(),
        profile: {
            sheets: sheets.length,
            rows: sheets.reduce((sum, s) => sum + s.profile.rows, 0),
            columns: sheets.reduce((sum, s) => sum + s.profile.columns, 0),
            numericColumns: [...new Set(sheets.flatMap(s => s.profile.numericColumns))],
            dateColumns: [...new Set(sheets.flatMap(s => s.profile.dateColumns))],
            categoryColumns: [...new Set(sheets.flatMap(s => s.profile.categoryColumns))]
        },
        kpis,
        widgets,
        insights,
        sheets
    };
};
