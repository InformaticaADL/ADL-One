import axios from 'axios';
import API_CONFIG from '../../../config/api.config';
import * as XLSX from 'xlsx';

export interface HistoricoMuestra {
    id_caso: number;
    formato_origen?: 'FORMATO_1' | 'FORMATO_2' | 'FORMATO_3' | string | null;
    n_caso: string;
    rut_empresa?: string | null;
    empresa?: string | null;
    rut_empresaservicio?: string | null;
    nombre_empresaservicio?: string | null;
    programa?: string | null;
    centro?: string | null;
    codigo_centro?: string | null;
    lugar_analisis?: string | null;
    especie?: string | null;
    estadio?: string | null;
    lote?: string | null;
    contenedor?: string | null;
    tipo_agua?: string | null;
    tipo_muestra?: string | null;
    tipo_muestreo?: string | null;
    tejido_matriz?: string | null;
    n_muestras?: number | null;
    pool?: string | number | null;
    pol_npooles?: number | null;
    pol_npeces?: number | null;
    fecha_muestreo?: string | null;
    fecha_recepcion?: string | null;
    tecnica?: string | null;
    agente?: string | null;
    resultado?: string | null;
    resultado2?: string | null;
    ct?: number | string | null;
    ct2?: number | string | null;
    genovariante?: string | null;
    positivos?: number | null;
    negativos?: number | null;
    intensidad?: string | null;
    expr1?: string | number | null;
    estado_caso?: string | null;
    fuente_origen?: string | null;
}

export interface HistoricoFilter {
    fecha_desde?: string;
    fecha_hasta?: string;
    ano?: string | number;
    sede?: string;
    fuente_origen?: string;
    resultado?: string;
    centro?: string;
    busqueda?: string;
    solo_menor_ct?: boolean;
    limite?: number;
    // 1 = no usar el resultado guardado en el servidor (el servidor lo ignora si es de hace menos de 1 minuto)
    fresco?: 0 | 1;
}

export interface HistoricoExportFilter extends HistoricoFilter {
    solo_menor_ct?: boolean;
}

export interface HistoricoFiltrosResponse {
    totals: {
        total_registros: number;
        min_fecha: string;
        max_fecha: string;
    };
    fuentes: Array<{
        fuente_origen: string;
        cantidad: number;
        min_fecha: string;
        max_fecha: string;
    }>;
    centros: string[];
    anos: Array<{ ano: string; label: string }>;
    sedes: Array<{ id: string; label: string }>;
}

const getAuthHeaders = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    return {
        headers: {
            Authorization: `Bearer ${token}`
        }
    };
};

export interface HistoricoConsultaResult {
    data: HistoricoMuestra[];
    totalCount: number;
    isTruncated: boolean;
}

export const historicoBiologiaMolecularApiClient = {
    async getConsultaHistorico(filters: HistoricoFilter): Promise<HistoricoMuestra[]> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/biologia-molecular/historico/muestras`, {
            ...getAuthHeaders(),
            params: filters
        });
        return response.data?.data || [];
    },

    async getConsultaHistoricoWithMeta(filters: HistoricoFilter): Promise<HistoricoConsultaResult> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/biologia-molecular/historico/muestras`, {
            ...getAuthHeaders(),
            params: filters
        });
        const rows: HistoricoMuestra[] = response.data?.data || [];
        const totalCount = Number(response.data?.totalCount || rows.length);
        const isTruncated = Boolean(response.data?.isTruncated);
        return { data: rows, totalCount, isTruncated };
    },

    async getFiltrosHistorico(): Promise<HistoricoFiltrosResponse> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/biologia-molecular/historico/filtros`, {
            ...getAuthHeaders()
        });
        return response.data?.data;
    },

    /**
     * Descarga el archivo Excel nativo (.xlsx) directamente del servidor mediante streaming HTTP.
     */
    async downloadExcel(filters: HistoricoExportFilter, fileName: string): Promise<void> {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const params = new URLSearchParams();
        if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
        if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
        if (filters.ano && filters.ano !== 'ALL') params.append('ano', String(filters.ano));
        if (filters.sede && filters.sede !== 'ALL') params.append('sede', filters.sede);
        if (filters.fuente_origen && filters.fuente_origen !== 'ALL') params.append('fuente_origen', filters.fuente_origen);
        if (filters.resultado && filters.resultado !== 'ALL') params.append('resultado', filters.resultado);
        if (filters.centro && filters.centro !== 'ALL') params.append('centro', filters.centro);
        if (filters.busqueda) params.append('busqueda', filters.busqueda);
        if (filters.solo_menor_ct) params.append('solo_menor_ct', 'true');

        const response = await fetch(`${API_CONFIG.getBaseURL()}/api/biologia-molecular/historico/export-excel?${params.toString()}`, {
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
    async downloadCsv(filters: HistoricoExportFilter, fileName: string): Promise<void> {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const params = new URLSearchParams();
        if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
        if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
        if (filters.ano && filters.ano !== 'ALL') params.append('ano', String(filters.ano));
        if (filters.sede && filters.sede !== 'ALL') params.append('sede', filters.sede);
        if (filters.fuente_origen && filters.fuente_origen !== 'ALL') params.append('fuente_origen', filters.fuente_origen);
        if (filters.resultado && filters.resultado !== 'ALL') params.append('resultado', filters.resultado);
        if (filters.centro && filters.centro !== 'ALL') params.append('centro', filters.centro);
        if (filters.busqueda) params.append('busqueda', filters.busqueda);
        if (filters.solo_menor_ct) params.append('solo_menor_ct', 'true');

        const response = await fetch(`${API_CONFIG.getBaseURL()}/api/biologia-molecular/historico/export-csv?${params.toString()}`, {
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

// Helper: Extrae valor numérico de CT
export function parseNumericCT(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(String(val).replace(',', '.').trim());
    return isNaN(num) ? null : num;
}

// Helper: Filtra por menor CT <= 28 agrupando por caso, matriz y agente/técnica
export function filterLowestCTHistorico(data: HistoricoMuestra[]): HistoricoMuestra[] {
    const map = new Map<string, { item: HistoricoMuestra; ctNum: number }>();

    for (const item of data) {
        const ctVal = parseNumericCT(item.ct);
        if (ctVal !== null && ctVal <= 28) {
            const key = `${String(item.n_caso || '').trim()}|||${String(item.tejido_matriz || '').trim()}|||${String(item.agente || item.tecnica || '').trim()}`;
            const existing = map.get(key);
            if (!existing || ctVal < existing.ctNum) {
                map.set(key, { item, ctNum: ctVal });
            }
        }
    }

    return Array.from(map.values()).map(v => v.item);
}

// Helper: Detecta el formato histórico de los datos (Formato 1: 2006-2008, Formato 2: 2009-2012, Formato 3: 2013-2016)
export function detectFormatFromData(
    data: HistoricoMuestra[],
    fileNamePrefix?: string
): 'FORMATO_1' | 'FORMATO_2' | 'FORMATO_3' | 'MIXTO' {
    const formatsFound = new Set<string>();
    for (const item of data) {
        if (item.formato_origen) {
            formatsFound.add(item.formato_origen);
        } else {
            const dStr = item.fecha_muestreo || item.fecha_recepcion || '';
            let y = parseInt(dStr.slice(0, 4), 10);
            if (isNaN(y) && item.fuente_origen) {
                const m = item.fuente_origen.match(/(20\d\d)/);
                if (m) y = parseInt(m[1], 10);
            }
            if (!isNaN(y)) {
                if (y <= 2008) formatsFound.add('FORMATO_1');
                else if (y <= 2012) formatsFound.add('FORMATO_2');
                else formatsFound.add('FORMATO_3');
            }
        }
        if (formatsFound.size > 1) return 'MIXTO';
    }

    if (formatsFound.size === 1) {
        const only = Array.from(formatsFound)[0];
        if (only === 'FORMATO_1' || only === 'FORMATO_2' || only === 'FORMATO_3') {
            return only;
        }
    }

    if (fileNamePrefix) {
        const singleMatch = fileNamePrefix.match(/_(20\d\d)(?:_|\.|$)/);
        if (singleMatch) {
            const y = parseInt(singleMatch[1], 10);
            if (y <= 2008) return 'FORMATO_1';
            if (y <= 2012) return 'FORMATO_2';
            return 'FORMATO_3';
        }
    }

    return 'MIXTO';
}

interface ExportCandidateColumn {
    key: string;
    header: string;
    formats: Array<'FORMATO_1' | 'FORMATO_2' | 'FORMATO_3' | 'MIXTO'>;
    getValue: (item: HistoricoMuestra) => string | number;
}

function getCandidateColumns(
    format: 'FORMATO_1' | 'FORMATO_2' | 'FORMATO_3' | 'MIXTO',
    formatDateFn: (val: unknown) => string
): ExportCandidateColumn[] {
    if (format === 'FORMATO_3') {
        return [
            { key: 'n_caso', header: 'caso_adlab', formats: ['FORMATO_3'], getValue: item => item.n_caso || '' },
            { key: 'rut_empresa', header: 'rut_empresa', formats: ['FORMATO_3'], getValue: item => item.rut_empresa || '' },
            { key: 'empresa', header: 'nombre_empresa', formats: ['FORMATO_3'], getValue: item => item.empresa || '' },
            { key: 'rut_empresaservicio', header: 'rut_empresaservicio', formats: ['FORMATO_3'], getValue: item => item.rut_empresaservicio || '' },
            { key: 'nombre_empresaservicio', header: 'nombre_empresaservicio', formats: ['FORMATO_3'], getValue: item => item.nombre_empresaservicio || '' },
            { key: 'fecha_recepcion', header: 'fecha_recepcion', formats: ['FORMATO_3'], getValue: item => formatDateFn(item.fecha_recepcion) },
            { key: 'lote', header: 'lote', formats: ['FORMATO_3'], getValue: item => item.lote || '' },
            { key: 'contenedor', header: 'contenedor', formats: ['FORMATO_3'], getValue: item => item.contenedor || '' },
            { key: 'centro', header: 'nombre_centro', formats: ['FORMATO_3'], getValue: item => item.centro || '' },
            { key: 'codigo_centro', header: 'codigo_centro', formats: ['FORMATO_3'], getValue: item => item.codigo_centro || '' },
            { key: 'tecnica', header: 'nombre_tecnica', formats: ['FORMATO_3'], getValue: item => item.tecnica || item.agente || '' },
            { key: 'tejido_matriz', header: 'nombre_organo', formats: ['FORMATO_3'], getValue: item => item.tejido_matriz || '' },
            { key: 'pool', header: 'pool', formats: ['FORMATO_3'], getValue: item => item.pool ?? '' },
            { key: 'resultado', header: 'resultado', formats: ['FORMATO_3'], getValue: item => item.resultado || '' },
            { key: 'pol_npooles', header: 'pol_npooles', formats: ['FORMATO_3'], getValue: item => item.pol_npooles ?? '' },
            { key: 'pol_npeces', header: 'pol_npeces', formats: ['FORMATO_3'], getValue: item => item.pol_npeces ?? '' },
            { key: 'ct', header: 'ct', formats: ['FORMATO_3'], getValue: item => (item.ct !== null && item.ct !== undefined && item.ct !== '') ? item.ct : (item.genovariante || '') },
            { key: 'estado_caso', header: 'estado_caso', formats: ['FORMATO_3'], getValue: item => item.estado_caso || '' }
        ];
    }

    if (format === 'FORMATO_2') {
        return [
            { key: 'n_caso', header: 'caso_adlab', formats: ['FORMATO_2'], getValue: item => item.n_caso || '' },
            { key: 'rut_empresa', header: 'rut_empresa', formats: ['FORMATO_2'], getValue: item => item.rut_empresa || '' },
            { key: 'empresa', header: 'nombre_empresa', formats: ['FORMATO_2'], getValue: item => item.empresa || '' },
            { key: 'rut_empresaservicio', header: 'rut_empresaservicio', formats: ['FORMATO_2'], getValue: item => item.rut_empresaservicio || '' },
            { key: 'nombre_empresaservicio', header: 'nombre_empresaservicio', formats: ['FORMATO_2'], getValue: item => item.nombre_empresaservicio || '' },
            { key: 'centro', header: 'nombre_centro', formats: ['FORMATO_2'], getValue: item => item.centro || '' },
            { key: 'programa', header: 'programa', formats: ['FORMATO_2'], getValue: item => item.programa || '' },
            { key: 'tejido_matriz', header: 'matriz', formats: ['FORMATO_2'], getValue: item => item.tejido_matriz || '' },
            { key: 'pool', header: 'pool', formats: ['FORMATO_2'], getValue: item => item.pool ?? '' },
            { key: 'agente', header: 'agente', formats: ['FORMATO_2'], getValue: item => item.agente || '' },
            { key: 'ct', header: 'ct', formats: ['FORMATO_2'], getValue: item => item.ct ?? '' },
            { key: 'resultado', header: 'resultado', formats: ['FORMATO_2'], getValue: item => item.resultado || '' },
            { key: 'resultado2', header: 'resultado2', formats: ['FORMATO_2'], getValue: item => item.resultado2 || '' },
            { key: 'ct2', header: 'ct2', formats: ['FORMATO_2'], getValue: item => item.ct2 ?? '' },
            { key: 'positivos', header: 'positivos', formats: ['FORMATO_2'], getValue: item => item.positivos ?? '' },
            { key: 'fecha_muestreo', header: 'fecha_muestreo', formats: ['FORMATO_2'], getValue: item => formatDateFn(item.fecha_muestreo) },
            { key: 'fecha_recepcion', header: 'fecha_recepcion', formats: ['FORMATO_2'], getValue: item => formatDateFn(item.fecha_recepcion) }
        ];
    }

    if (format === 'FORMATO_1') {
        return [
            { key: 'n_caso', header: 'N CASO', formats: ['FORMATO_1'], getValue: item => item.n_caso || '' },
            { key: 'empresa', header: 'EMPRESA', formats: ['FORMATO_1'], getValue: item => item.empresa || '' },
            { key: 'programa', header: 'PROGRAMA', formats: ['FORMATO_1'], getValue: item => item.programa || '' },
            { key: 'centro', header: 'CENTRO', formats: ['FORMATO_1'], getValue: item => item.centro || '' },
            { key: 'lugar_analisis', header: 'LUGAR ANALISIS', formats: ['FORMATO_1'], getValue: item => item.lugar_analisis || '' },
            { key: 'especie', header: 'ESPECIE', formats: ['FORMATO_1'], getValue: item => item.especie || '' },
            { key: 'estadio', header: 'ESTADIO', formats: ['FORMATO_1'], getValue: item => item.estadio || '' },
            { key: 'lote', header: 'LOTE', formats: ['FORMATO_1'], getValue: item => item.lote || '' },
            { key: 'tipo_agua', header: 'TIPO AGUA', formats: ['FORMATO_1'], getValue: item => item.tipo_agua || '' },
            { key: 'tipo_muestra', header: 'TIPO MUESTRA', formats: ['FORMATO_1'], getValue: item => item.tipo_muestra || '' },
            { key: 'tipo_muestreo', header: 'TIPO MUESTREO', formats: ['FORMATO_1'], getValue: item => item.tipo_muestreo || '' },
            {
                key: 'n_muestras',
                header: 'N MUESTRAS',
                formats: ['FORMATO_1'],
                getValue: item => item.pool ? `${item.n_muestras ?? ''} (${item.pool})`.trim() : (item.n_muestras ?? '')
            },
            { key: 'fecha_recepcion', header: 'FECHA RECEPCION', formats: ['FORMATO_1'], getValue: item => formatDateFn(item.fecha_recepcion) },
            { key: 'fecha_muestreo', header: 'FECHA MUESTREO', formats: ['FORMATO_1'], getValue: item => formatDateFn(item.fecha_muestreo) },
            { key: 'tecnica', header: 'TECNICA', formats: ['FORMATO_1'], getValue: item => item.tecnica || '' },
            { key: 'agente', header: 'AGENTE', formats: ['FORMATO_1'], getValue: item => item.agente || '' },
            { key: 'tejido_matriz', header: 'TEJIDO', formats: ['FORMATO_1'], getValue: item => item.tejido_matriz || '' },
            { key: 'expr1', header: 'EXPR1', formats: ['FORMATO_1'], getValue: item => item.expr1 ?? '' },
            { key: 'positivos', header: 'POSITIVOS', formats: ['FORMATO_1'], getValue: item => item.positivos ?? '' },
            { key: 'negativos', header: 'NEGATIVOS', formats: ['FORMATO_1'], getValue: item => item.negativos ?? '' },
            { key: 'intensidad', header: 'INTENSIDAD', formats: ['FORMATO_1'], getValue: item => item.intensidad || '' }
        ];
    }

    return [
        { key: 'n_caso', header: 'Caso ADLAB', formats: ['MIXTO'], getValue: item => item.n_caso || '' },
        { key: 'fecha_recepcion', header: 'Fecha Recepción', formats: ['MIXTO'], getValue: item => formatDateFn(item.fecha_recepcion) },
        { key: 'fecha_muestreo', header: 'Fecha Muestreo', formats: ['MIXTO'], getValue: item => formatDateFn(item.fecha_muestreo) },
        { key: 'rut_empresa', header: 'RUT Empresa', formats: ['MIXTO'], getValue: item => item.rut_empresa || '' },
        { key: 'empresa', header: 'Empresa', formats: ['MIXTO'], getValue: item => item.empresa || '' },
        { key: 'rut_empresaservicio', header: 'RUT Emp. Servicio', formats: ['MIXTO'], getValue: item => item.rut_empresaservicio || '' },
        { key: 'nombre_empresaservicio', header: 'Empresa Servicio', formats: ['MIXTO'], getValue: item => item.nombre_empresaservicio || '' },
        { key: 'centro', header: 'Centro', formats: ['MIXTO'], getValue: item => item.centro || '' },
        { key: 'codigo_centro', header: 'Cód. Centro', formats: ['MIXTO'], getValue: item => item.codigo_centro || '' },
        { key: 'programa', header: 'Programa', formats: ['MIXTO'], getValue: item => item.programa || '' },
        { key: 'lote', header: 'Lote', formats: ['MIXTO'], getValue: item => item.lote || '' },
        { key: 'contenedor', header: 'Contenedor', formats: ['MIXTO'], getValue: item => item.contenedor || '' },
        { key: 'tejido_matriz', header: 'Matriz / Órgano', formats: ['MIXTO'], getValue: item => item.tejido_matriz || '' },
        { key: 'agente', header: 'Técnica / Agente', formats: ['MIXTO'], getValue: item => item.agente || '' },
        { key: 'pool', header: 'Pool', formats: ['MIXTO'], getValue: item => item.pool ?? '' },
        { key: 'ct', header: 'CT', formats: ['MIXTO'], getValue: item => (item.ct !== null && item.ct !== undefined && item.ct !== '') ? item.ct : (item.genovariante || '') },
        { key: 'resultado', header: 'Resultado', formats: ['MIXTO'], getValue: item => item.resultado || '' },
        { key: 'positivos', header: 'Positivos', formats: ['MIXTO'], getValue: item => item.positivos ?? '' },
        { key: 'negativos', header: 'Negativos', formats: ['MIXTO'], getValue: item => item.negativos ?? '' },
        { key: 'fuente_origen', header: 'Fuente Origen', formats: ['MIXTO'], getValue: item => item.fuente_origen || '' }
    ];
}

// Helper: Genera Excel en frontend. Si vienen múltiples formatos, crea una pestaña por cada formato.
export function exportHistoricoExcel(
    data: HistoricoMuestra[],
    fileNamePrefix: string = 'historico_laboratorio'
) {
    const cleanExcelName = fileNamePrefix.endsWith('.xlsx') ? fileNamePrefix.slice(0, -5) : fileNamePrefix;
    const today = new Date().toISOString().split('T')[0];
    const finalExcelFileName = cleanExcelName.includes(today) ? `${cleanExcelName}.xlsx` : `${cleanExcelName}_${today}.xlsx`;

    if (data.length === 0) {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([{ Mensaje: 'Sin registros para los filtros seleccionados' }]);
        XLSX.utils.book_append_sheet(wb, ws, 'Histórico ADL');
        XLSX.writeFile(wb, finalExcelFileName);
        return;
    }

    const formatDate = (val: unknown): string => {
        if (!val) return '';
        const str = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            const [y, m, d] = str.slice(0, 10).split('-');
            return `${d}/${m}/${y}`;
        }
        return str;
    };

    const hasValue = (val: unknown): boolean => {
        if (val === null || val === undefined) return false;
        const str = String(val).trim();
        return str !== '' && str !== 'NULL' && str !== 'null' && str !== 'undefined';
    };

    const buildSheetForSingleFormat = (
        rows: HistoricoMuestra[],
        fmt: 'FORMATO_1' | 'FORMATO_2' | 'FORMATO_3'
    ) => {
        const cols = getCandidateColumns(fmt, formatDate).filter(col => {
            // En 2006 no existe LUGAR ANALISIS en el Excel original
            if (fmt === 'FORMATO_1' && col.key === 'lugar_analisis') {
                return rows.some(item => hasValue(col.getValue(item)));
            }
            // En 2009 no existen las columnas de empresa / empresa servicio
            if (fmt === 'FORMATO_2' && ['rut_empresa', 'empresa', 'rut_empresaservicio', 'nombre_empresaservicio'].includes(col.key)) {
                return rows.some(item => hasValue(col.getValue(item)));
            }
            return true;
        });

        const formattedData = rows.map(item => {
            const rowObj: Record<string, string | number> = {};
            for (const col of cols) {
                const rawVal = col.getValue(item);
                rowObj[col.header] = typeof rawVal === 'string'
                    ? rawVal.replace(/[\x00-\x1F\x7F-\x9F\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
                    : (rawVal ?? '');
            }
            return rowObj;
        });

        return XLSX.utils.json_to_sheet(formattedData);
    };

    const format = detectFormatFromData(data, fileNamePrefix);
    const wb = XLSX.utils.book_new();

    if (format === 'MIXTO') {
        const groups: Array<{ fmt: 'FORMATO_1' | 'FORMATO_2' | 'FORMATO_3'; title: string }> = [
            { fmt: 'FORMATO_1', title: 'Histórico 2006-2008' },
            { fmt: 'FORMATO_2', title: 'Histórico 2009-2012' },
            { fmt: 'FORMATO_3', title: 'Histórico 2013-2016' }
        ];

        let addedSheets = 0;
        for (const g of groups) {
            const groupRows = data.filter(d => d.formato_origen === g.fmt);
            if (groupRows.length > 0) {
                const ws = buildSheetForSingleFormat(groupRows, g.fmt);
                XLSX.utils.book_append_sheet(wb, ws, g.title);
                addedSheets++;
            }
        }

        if (addedSheets === 0) {
            const ws = buildSheetForSingleFormat(data, 'FORMATO_3');
            XLSX.utils.book_append_sheet(wb, ws, 'Histórico ADL');
        }
    } else {
        const ws = buildSheetForSingleFormat(data, format);
        const sheetName = format === 'FORMATO_1'
            ? 'Histórico 2006-2008'
            : (format === 'FORMATO_2'
                ? 'Histórico 2009-2012'
                : 'Histórico 2013-2016');
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, finalExcelFileName);
}

