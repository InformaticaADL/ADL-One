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
    fecha_muestreo?: string;
    fecha_recepcion?: string;
}

export interface BiologiaMolecularFilter {
    fecha_desde: string;
    fecha_hasta: string;
    id_lugaranalisis?: number;
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

    // Ordenar de forma determinista igual a la consulta original (Caso, Agente, Pool)
    return Array.from(map.values()).sort((a, b) => {
        const casoComp = String(a.caso_adlab).localeCompare(String(b.caso_adlab), undefined, { numeric: true });
        if (casoComp !== 0) return casoComp;
        const agenteComp = String(a.agente || '').localeCompare(String(b.agente || ''));
        if (agenteComp !== 0) return agenteComp;
        const poolA = Number(a.pool) || 0;
        const poolB = Number(b.pool) || 0;
        return poolA - poolB;
    });
}

// Límites oficiales de compatibilidad con Microsoft Excel 2016 Standard (.xlsx)
export const EXCEL_2016_LIMITS = {
    MAX_ROWS_PER_SHEET: 1_000_000, // Margen de seguridad sobre el límite estricto de 1.048.576 filas
    MAX_COLUMNS_PER_SHEET: 16_384, // Columnas máximas por hoja (A a XFD)
    MAX_CELL_CHARACTERS: 32_767,   // Caracteres máximos permitidos por celda
    MAX_SHEET_NAME_LENGTH: 31      // Longitud máxima de nombre de hoja en Excel
};

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
                ? key.replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
                : key;

            if (typeof value === 'string') {
                let cleanedVal = value
                    .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                // Proteger contra desbordamiento de caracteres por celda
                if (cleanedVal.length > EXCEL_2016_LIMITS.MAX_CELL_CHARACTERS) {
                    cleanedVal = cleanedVal.slice(0, EXCEL_2016_LIMITS.MAX_CELL_CHARACTERS);
                }
                cleaned[cleanKey] = cleanedVal;
            } else {
                cleaned[cleanKey] = value;
            }
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

/**
 * Genera y descarga el archivo Excel para Biología Molecular con control de límites de Excel 2016:
 * - Validación de columnas (<= 16.384)
 * - Partición automática en múltiples hojas si supera 1.000.000 de filas (ej: BM_P1, BM_P2)
 * - Control de celdas y nombres de hojas
 */
export function exportBiologiaMolecularExcel(
    data: BiologiaMolecularMuestra[],
    fileNamePrefix: string = 'biologia_molecular_muestras'
) {
    const cleanedData = cleanDataset(data);
    const wb = XLSX.utils.book_new();

    if (cleanedData.length === 0) {
        const ws = XLSX.utils.json_to_sheet([{ Mensaje: 'Sin registros para el rango de fechas seleccionado' }]);
        XLSX.utils.book_append_sheet(wb, ws, 'Biología Molecular');
        XLSX.writeFile(wb, `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`);
        return;
    }

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
