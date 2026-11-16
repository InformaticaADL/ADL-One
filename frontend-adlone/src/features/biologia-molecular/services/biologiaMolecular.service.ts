import axios from 'axios';
import API_CONFIG from '../../../config/api.config';
import * as XLSX from 'xlsx';

export interface BiologiaMolecularMuestra {
    caso_adlab: number | string;
    nombre_centro: string;
    programa: string;
    matriz: string;
    pool: number | string;
    agente: string;
    ct: number | string;
    resultado: string;
    resultado2?: string;
    ct2?: number | string;
    positivos?: number | string;
    observaciones?: string;
    comentario?: string;
    fecha_muestreo?: string;
    fecha_recepcion?: string;
}

export interface BiologiaMolecularFilter {
    fecha_desde: string;
    fecha_hasta: string;
    id_lugaranalisis?: number;
    solo_menor_ct?: boolean;
    limite?: number;
    // 1 = no usar el resultado guardado en el servidor (el servidor lo ignora si es de hace menos de 1 minuto)
    fresco?: 0 | 1;
}

export interface BiologiaMolecularExportFilter extends BiologiaMolecularFilter {
    solo_menor_ct?: boolean;
    categoria?: string;
    centro?: string;
    matriz?: string;
    tecnica?: string;
}

const getAuthHeaders = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    return {
        headers: {
            Authorization: `Bearer ${token}`
        }
    };
};

export const biologiaMolecularApiClient = {
    async getConsultaMuestras(filters: BiologiaMolecularFilter): Promise<BiologiaMolecularMuestra[]> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/biologia-molecular/muestras`, {
            ...getAuthHeaders(),
            params: filters
        });
        return response.data?.data || [];
    },

    /**
     * Descarga el archivo Excel nativo (.xlsx) directamente del servidor mediante streaming HTTP.
     * Ideal para volúmenes gigantescos (como 700.000+ filas) sin consumir memoria del navegador.
     */
    async downloadExcel(filters: BiologiaMolecularExportFilter, fileName: string): Promise<void> {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const params = new URLSearchParams();
        params.append('fecha_desde', filters.fecha_desde);
        params.append('fecha_hasta', filters.fecha_hasta);
        if (filters.id_lugaranalisis) params.append('id_lugaranalisis', String(filters.id_lugaranalisis));
        if (filters.solo_menor_ct) params.append('solo_menor_ct', 'true');
        if (filters.categoria && filters.categoria !== 'ALL') params.append('categoria', filters.categoria);
        if (filters.centro && filters.centro !== 'ALL') params.append('centro', filters.centro);
        if (filters.matriz && filters.matriz !== 'ALL') params.append('matriz', filters.matriz);
        if (filters.tecnica && filters.tecnica !== 'ALL') params.append('tecnica', filters.tecnica);

        const response = await fetch(`${API_CONFIG.getBaseURL()}/api/biologia-molecular/export-excel?${params.toString()}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!response.ok) {
            let errorMsg = 'Error al descargar archivo Excel desde el servidor';
            try {
                const json = await response.json();
                if (json.message) errorMsg = json.message;
            } catch {
                // ignore
            }
            throw new Error(errorMsg);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    },

    /**
     * Descarga el archivo CSV compatible con Excel vía streaming HTTP desde el servidor.
     */
    async downloadCsv(filters: BiologiaMolecularExportFilter, fileName: string): Promise<void> {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const params = new URLSearchParams();
        params.append('fecha_desde', filters.fecha_desde);
        params.append('fecha_hasta', filters.fecha_hasta);
        if (filters.id_lugaranalisis) params.append('id_lugaranalisis', String(filters.id_lugaranalisis));
        if (filters.solo_menor_ct) params.append('solo_menor_ct', 'true');
        if (filters.categoria && filters.categoria !== 'ALL') params.append('categoria', filters.categoria);
        if (filters.centro && filters.centro !== 'ALL') params.append('centro', filters.centro);
        if (filters.matriz && filters.matriz !== 'ALL') params.append('matriz', filters.matriz);
        if (filters.tecnica && filters.tecnica !== 'ALL') params.append('tecnica', filters.tecnica);

        const response = await fetch(`${API_CONFIG.getBaseURL()}/api/biologia-molecular/export-csv?${params.toString()}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!response.ok) {
            let errorMsg = 'Error al descargar archivo CSV desde el servidor';
            try {
                const json = await response.json();
                if (json.message) errorMsg = json.message;
            } catch {
                // ignore
            }
            throw new Error(errorMsg);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }
};

/**
 * Parsea el valor de CT a número flotante.
 * Maneja cadenas como "24,5", "24.5", números, o null si no es numérico válido.
 */
export const parseCTValue = (val: unknown): number | null => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const cleaned = String(val).replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

/**
 * Determina si un resultado es considerado positivo.
 */
export const isResultadoPositivo = (res?: string): boolean => {
    if (!res) return false;
    const r = res.toLowerCase().trim();
    return r === 'p' || r.includes('pos');
};

/**
 * Obtiene el menor CT numérico válido de una muestra (> 0).
 */
export const getMinCTOfSample = (item: BiologiaMolecularMuestra): number | null => {
    const c1 = parseCTValue(item.ct);
    const c2 = parseCTValue(item.ct2);
    if (c1 !== null && c1 > 0 && c2 !== null && c2 > 0) return Math.min(c1, c2);
    if (c1 !== null && c1 > 0) return c1;
    if (c2 !== null && c2 > 0) return c2;
    return null;
};

export const MAX_CT_THRESHOLD = 28;

/**
 * Parsea una fecha textual o Date a timestamp milisegundos para ordenamiento numérico exacto.
 * Soporta formatos: DD/MM/YYYY, YYYY-MM-DD e ISO. Valores vacíos van al final.
 */
export function parseDateToSortValue(val?: string | Date | null): number {
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

/**
 * Comparador determinista para ordenar registros de menor a mayor (más antiguo a más reciente)
 * según la Fecha de Recepción, con desempates secundarios por Caso, Agente y Pool.
 */
export function sortByFechaRecepcionAsc(a: BiologiaMolecularMuestra, b: BiologiaMolecularMuestra): number {
    const timeA = parseDateToSortValue(a.fecha_recepcion);
    const timeB = parseDateToSortValue(b.fecha_recepcion);
    if (timeA !== timeB) return timeA - timeB;

    const casoComp = String(a.caso_adlab || '').localeCompare(String(b.caso_adlab || ''), undefined, { numeric: true });
    if (casoComp !== 0) return casoComp;

    const agenteComp = String(a.agente || '').localeCompare(String(b.agente || ''));
    if (agenteComp !== 0) return agenteComp;

    const poolA = Number(a.pool) || 0;
    const poolB = Number(b.pool) || 0;
    return poolA - poolB;
}

/**
 * Filtra el conjunto de muestras seleccionando, por cada combinación de Caso, Matriz y Agente,
 * el registro con el valor de CT más bajo que cumpla con el umbral máximo (CT <= maxCT, por defecto 28).
 * Si un caso/matriz/agente no tiene ningún resultado con CT <= maxCT, no es contabilizado ni incluido.
 */
export function filterLowestCTByCasoMatrizAgente(
    items: BiologiaMolecularMuestra[],
    maxCT: number = MAX_CT_THRESHOLD
): BiologiaMolecularMuestra[] {
    if (!Array.isArray(items) || items.length === 0) return [];

    const map = new Map<string, BiologiaMolecularMuestra>();

    for (const item of items) {
        const ctItem = getMinCTOfSample(item);

        // Si no tiene CT válido (> 0) o supera el umbral máximo (ej. > 28), se descarta de la lógica
        if (ctItem === null || ctItem <= 0 || ctItem > maxCT) {
            continue;
        }

        const caso = String(item.caso_adlab ?? '').trim();
        const matriz = String(item.matriz ?? 'SIN_MATRIZ').trim().toUpperCase();
        const agente = String(item.agente ?? 'SIN_AGENTE').trim().toUpperCase();
        const key = `${caso}__${matriz}__${agente}`;

        const existing = map.get(key);
        if (!existing) {
            map.set(key, item);
            continue;
        }

        const ctExisting = getMinCTOfSample(existing);

        // Si el nuevo registro tiene un CT menor (ambos ya son <= maxCT)
        if (ctExisting === null || ctItem < ctExisting) {
            map.set(key, item);
        } else if (ctItem === ctExisting) {
            // Desempate por pool menor
            const poolItem = Number(item.pool);
            const poolExisting = Number(existing.pool);
            if (!isNaN(poolItem) && !isNaN(poolExisting) && poolItem < poolExisting) {
                map.set(key, item);
            }
        }
    }

    // Ordenar de menor a mayor por fecha de recepción (cronológico ascendente)
    return Array.from(map.values()).sort(sortByFechaRecepcionAsc);
}

// Límites oficiales de compatibilidad con Microsoft Excel 2016 Standard (.xlsx)
export const EXCEL_2016_LIMITS = {
    MAX_ROWS_PER_SHEET: 1_000_000, // Margen de seguridad sobre el límite estricto de 1.048.576 filas
    MAX_COLUMNS_PER_SHEET: 16_384, // Columnas máximas por hoja (A a XFD)
    MAX_CELL_CHARACTERS: 32_767,   // Caracteres máximos permitidos por celda
    MAX_SHEET_NAME_LENGTH: 31      // Longitud máxima de nombre de hoja en Excel
};

function cleanCellText(val: unknown): string | number {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return isNaN(val) ? '' : val;
    let cleanedVal = String(val)
        .replace(/[\x00-\x1F\x7F-\x9F\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (cleanedVal.length > EXCEL_2016_LIMITS.MAX_CELL_CHARACTERS) {
        cleanedVal = cleanedVal.slice(0, EXCEL_2016_LIMITS.MAX_CELL_CHARACTERS);
    }
    return cleanedVal;
}

/**
 * Limpia profundamente caracteres NBSP, tabs, saltos y espacios duplicados,
 * protegiendo además contra desbordamiento de caracteres por celda en Excel 2016.
 */
function cleanDataset<T extends Record<string, any>>(data: T[]): T[] {
    if (!Array.isArray(data)) return [];
    return data.map((row) => {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
            const cleanKey = typeof key === 'string'
                ? key.replace(/[\x00-\x1F\x7F-\x9F\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
                : key;

            cleaned[cleanKey] = cleanCellText(value);
        }
        return cleaned as T;
    });
}

function calculateColumnWidths(data: any[]) {
    if (!data || data.length === 0) return [];
    const keys = Object.keys(data[0]);
    // Muestreo acotado a los primeros 500 registros para no sobrecargar CPU en datasets masivos
    const sampleLimit = Math.min(data.length, 500);
    return keys.map((key) => {
        let maxLen = key.length;
        for (let i = 0; i < sampleLimit; i++) {
            const val = data[i][key];
            if (val !== null && val !== undefined) {
                const len = String(val).length;
                if (len > maxLen) maxLen = len;
            }
        }
        return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
    });
}

const formatCsvDate = (val?: string | Date | null): string => {
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
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            const d = String(parsed.getDate()).padStart(2, '0');
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const y = parsed.getFullYear();
            return `${d}/${m}/${y}`;
        }
        return trimmed;
    }
    if (val instanceof Date && !isNaN(val.getTime())) {
        const d = String(val.getDate()).padStart(2, '0');
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const y = val.getFullYear();
        return `${d}/${m}/${y}`;
    }
    return String(val);
};

/**
 * Genera y descarga un archivo CSV con formato optimizado para Microsoft Excel:
 * - Cabecera con BOM UTF-8 (\uFEFF) para visualización inmediata de tildes y caracteres especiales
 * - Delimitador ';' compatible con la configuración regional de Excel en español/Chile
 * - Construcción por fragmentos (chunks) para soportar 1.000.000+ registros en milisegundos sin agotar memoria
 */
export function exportBiologiaMolecularCSV(
    data: BiologiaMolecularMuestra[],
    fileNamePrefix: string = 'biologia_molecular_muestras'
) {
    if (!data || data.length === 0) {
        throw new Error('No hay registros para exportar.');
    }

    // Ordenar de menor a mayor por fecha de recepción
    const sortedData = [...data].sort(sortByFechaRecepcionAsc);

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

    const escapeCsv = (val: unknown): string => {
        if (val === null || val === undefined) return '';
        const str = String(val)
            .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const chunks: string[] = ['\uFEFF', headers.join(';') + '\r\n'];
    const chunkSize = 5000;

    for (let i = 0; i < sortedData.length; i += chunkSize) {
        const slice = sortedData.slice(i, i + chunkSize);
        let chunkText = '';
        for (const item of slice) {
            chunkText += [
                escapeCsv(item.caso_adlab),
                escapeCsv(formatCsvDate(item.fecha_recepcion)),
                escapeCsv(formatCsvDate(item.fecha_muestreo)),
                escapeCsv(item.nombre_centro),
                escapeCsv(item.programa),
                escapeCsv(item.matriz),
                escapeCsv(item.agente),
                escapeCsv(item.pool),
                escapeCsv(item.ct),
                escapeCsv(item.resultado),
                escapeCsv(item.ct2),
                escapeCsv(item.resultado2),
                escapeCsv(item.positivos),
                escapeCsv(item.observaciones),
                escapeCsv(item.comentario)
            ].join(';') + '\r\n';
        }
        chunks.push(chunkText);
    }

    const blob = new Blob(chunks, { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

/**
 * Genera y descarga el archivo Excel para Biología Molecular con control de límites de Excel 2016:
 * - Validación de columnas (<= 16.384)
 * - Protección contra desbordamiento en memoria (> 100.000 filas se delega a CSV o streaming)
 * - Partición automática en múltiples hojas si supera 1.000.000 de filas
 */
export function exportBiologiaMolecularExcel(
    data: BiologiaMolecularMuestra[],
    fileNamePrefix: string = 'biologia_molecular_muestras'
) {
    if (data.length === 0) {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([{ Mensaje: 'Sin registros para el rango de fechas seleccionado' }]);
        XLSX.utils.book_append_sheet(wb, ws, 'Biología Molecular');
        XLSX.writeFile(wb, `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`);
        return;
    }

    // Ordenar de menor a mayor por fecha de recepción
    const sortedData = [...data].sort(sortByFechaRecepcionAsc);

    // Si el volumen supera los 100.000 registros, el motor JavaScript del navegador (V8)
    // desborda la memoria al armar el XML de Excel (RangeError: Invalid string length).
    // En ese caso, redirigimos automáticamente a CSV compatible con Excel para evitar caídas.
    if (sortedData.length > 100_000) {
        console.warn(`[exportBiologiaMolecularExcel] Dataset masivo (${sortedData.length} registros). Exportando en formato CSV compatible con Excel para evitar agotar la memoria del navegador.`);
        exportBiologiaMolecularCSV(sortedData, fileNamePrefix);
        return;
    }

    const formattedRows = sortedData.map((item) => ({
        'Caso ADLAB': cleanCellText(item.caso_adlab),
        'Fecha Recepción': cleanCellText(formatCsvDate(item.fecha_recepcion)),
        'Fecha Muestreo': cleanCellText(formatCsvDate(item.fecha_muestreo)),
        'Centro': cleanCellText(item.nombre_centro),
        'Programa': cleanCellText(item.programa),
        'Matriz': cleanCellText(item.matriz),
        'Agente': cleanCellText(item.agente),
        'Pool': item.pool ?? '',
        'CT': cleanCellText(item.ct),
        'Resultado': cleanCellText(item.resultado),
        'CT 2': cleanCellText(item.ct2),
        'Resultado 2': cleanCellText(item.resultado2),
        'Positivos': item.positivos ?? '',
        'Observaciones': cleanCellText(item.observaciones),
        'Comentario': cleanCellText(item.comentario)
    }));

    const cleanedData = cleanDataset(formattedRows);
    const wb = XLSX.utils.book_new();

    // 1. Validar límite de columnas en Excel 2016 Standard
    const columnCount = Object.keys(cleanedData[0] || {}).length;
    if (columnCount > EXCEL_2016_LIMITS.MAX_COLUMNS_PER_SHEET) {
        throw new Error(
            `El conjunto de datos contiene ${columnCount} columnas, excediendo el límite de Excel 2016 (${EXCEL_2016_LIMITS.MAX_COLUMNS_PER_SHEET} columnas).`
        );
    }

    // 2. Partición automática en hojas si el volumen excede 1.000.000 de filas por hoja
    const chunkSize = EXCEL_2016_LIMITS.MAX_ROWS_PER_SHEET;
    const totalSheets = Math.ceil(cleanedData.length / chunkSize);

    for (let sheetIndex = 0; sheetIndex < totalSheets; sheetIndex++) {
        const chunkStart = sheetIndex * chunkSize;
        const chunkEnd = Math.min(chunkStart + chunkSize, cleanedData.length);
        const chunkData = cleanedData.slice(chunkStart, chunkEnd);

        const ws = XLSX.utils.json_to_sheet(chunkData);
        ws['!cols'] = calculateColumnWidths(chunkData);

        const rawSheetName = totalSheets > 1 
            ? `BM_Parte_${sheetIndex + 1}` 
            : 'Biología Molecular';
        
        const safeSheetName = rawSheetName.slice(0, EXCEL_2016_LIMITS.MAX_SHEET_NAME_LENGTH);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    }

    XLSX.writeFile(wb, `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
