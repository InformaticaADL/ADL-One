import ExcelJS from 'exceljs';
import logger from '../utils/logger.js';
import equipoService from './equipo.service.js';
import { adminService } from './admin.service.js';

// Quita tildes, pasa a mayúsculas y colapsa espacios — usado tanto para
// encabezados de columna como para comparar valores de texto.
const normalize = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
};

// Cada campo que nos interesa, con los fragmentos (ya normalizados) que
// identifican su columna en la plantilla. Se usa "includes" en vez de
// igualdad estricta para tolerar pequeños cambios de redacción del header.
const HEADER_KEYWORDS = {
    nombre: ['NOMBRE DEL EQUIPO'],
    tipo: ['TIPO'],
    que_mide: ['QUE MIDE'],
    unidad_medida_textual: ['UNIDAD DE MEDIDA (TEXTO)', 'UNIDAD DE MEDIDA TEXTO'],
    unidad_medida_sigla: ['UNIDAD DE MEDIDA (SIGLA)', 'UNIDAD DE MEDIDA SIGLA'],
    ubicacion: ['SEDE'],
    sigla: ['SIGLA'],
    correlativo: ['CORRELATIVO'],
    codigo: ['CODIGO'],
    estado: ['ESTADO (ACTIVO', 'ESTADO ACTIVO'],
    estado_equipo: ['ESTADO OPERATIVO'],
    responsable_nombre: ['RESPONSABLE'],
    equipo_asociado: ['EQUIPO ASOCIADO'],
    tiene_fc: ['FACTOR DE CORRECCION'],
    error0: ['ERROR 0'],
    error15: ['ERROR 15'],
    error30: ['ERROR 30'],
    visible_muestreador: ['VISIBLE PARA MUESTREADOR'],
    informe: ['INCLUIR EN INFORME'],
    ultima_verificacion: ['ULTIMA VERIFICACION'],
    siguiente_verificacion: ['SIGUIENTE VERIFICACION'],
    plazo_vigencia: ['PLAZO DE VIGENCIA'],
    observacion: ['OBSERVACION'],
    marca: ['MARCA'],
    modelo: ['MODELO'],
    serie: ['N DE SERIE', 'NUMERO DE SERIE', 'SERIE'],
};

// Campos que se comparan contra la BD para decidir "coincide" vs "difiere".
// (marca/modelo/serie quedan fuera: son solo referencia, mae_equipo no las tiene)
const CAMPOS_COMPARABLES = [
    'nombre', 'tipo', 'ubicacion', 'estado', 'sigla', 'correlativo',
    'tiene_fc', 'error0', 'error15', 'error30', 'equipo_asociado',
    'visible_muestreador', 'que_mide', 'unidad_medida_textual', 'unidad_medida_sigla',
    'informe', 'ultima_verificacion', 'siguiente_verificacion', 'plazo_vigencia',
    'estado_equipo', 'observacion', 'id_muestreador',
];

const ETIQUETAS_CAMPO = {
    nombre: 'Nombre', tipo: 'Tipo', ubicacion: 'Sede / Ubicación', estado: 'Estado',
    sigla: 'Sigla', correlativo: 'Correlativo', tiene_fc: 'Tiene Factor de Corrección',
    error0: 'Error 0', error15: 'Error 15', error30: 'Error 30',
    equipo_asociado: 'Equipo Asociado', visible_muestreador: 'Visible para Muestreador',
    que_mide: 'Qué Mide', unidad_medida_textual: 'Unidad de Medida (texto)',
    unidad_medida_sigla: 'Unidad de Medida (sigla)', informe: 'Incluir en Informe',
    ultima_verificacion: 'Última Verificación', siguiente_verificacion: 'Siguiente Verificación',
    plazo_vigencia: 'Plazo de Vigencia', estado_equipo: 'Estado Operativo',
    observacion: 'Observación', id_muestreador: 'Responsable',
};

const CAMPOS_SI_NO = ['tiene_fc', 'visible_muestreador', 'informe'];
const CAMPOS_NUMERICOS = ['correlativo', 'error0', 'error15', 'error30', 'id_muestreador'];
const CAMPOS_FECHA = ['ultima_verificacion', 'siguiente_verificacion'];

const toYYYYMMDD = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return value.toISOString().slice(0, 10);
    }
    const str = String(value).trim();
    if (!str) return null;
    // Formatos esperados: DD/MM/AAAA (plantilla) o AAAA-MM-DD (ya normalizado por la BD)
    const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
        const [, d, m, y] = ddmmyyyy;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
        const [, y, m, d] = iso;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return str;
};

const parseCellValue = (raw) => {
    if (raw === null || raw === undefined) return null;
    if (raw instanceof Date) return raw;
    if (typeof raw === 'object') {
        if (raw.result !== undefined) return raw.result;
        if (Array.isArray(raw.richText)) return raw.richText.map((rt) => rt.text).join('');
        if (raw.text !== undefined) return raw.text;
        return null;
    }
    return raw;
};

const esSiNo = (value) => {
    const n = normalize(value);
    return n === 'SI' || n === 'S' || n === 'TRUE' || n === '1';
};

// Devuelve true si la fila no trae ningún dato útil (para cortar al llegar
// a filas vacías al final de la hoja).
const filaVacia = (valores) => Object.values(valores).every((v) => v === null || v === '' || v === undefined);

class EquipoExcelImportService {
    /**
     * Lee el archivo subido y devuelve las filas mapeadas a los nombres de
     * campo que usan createEquipo/updateEquipo. No toca la base de datos.
     */
    async parseEquiposExcel(fileBuffer) {
        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.load(fileBuffer);
        } catch (err) {
            throw new Error('El archivo no es un Excel (.xlsx) válido.');
        }

        const worksheet = workbook.getWorksheet('Plantilla Equipos')
            || workbook.worksheets[1]
            || workbook.worksheets[0];

        if (!worksheet) {
            throw new Error('El archivo Excel no tiene ninguna hoja con datos.');
        }

        // 1. Mapear encabezados (fila 1) -> campo interno
        const headerRow = worksheet.getRow(1);
        const columnaPorCampo = {};
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const header = normalize(parseCellValue(cell.value));
            if (!header) return;
            for (const [campo, keywords] of Object.entries(HEADER_KEYWORDS)) {
                if (columnaPorCampo[campo]) continue; // ya encontrado, no sobrescribir
                if (keywords.some((kw) => header.includes(kw))) {
                    columnaPorCampo[campo] = colNumber;
                }
            }
        });

        if (!columnaPorCampo.codigo && !columnaPorCampo.nombre) {
            throw new Error('No se encontraron las columnas esperadas (Código, Nombre, etc.) en la primera fila del Excel.');
        }

        const getValor = (row, campo) => {
            const col = columnaPorCampo[campo];
            if (!col) return null;
            const parsed = parseCellValue(row.getCell(col).value);
            if (parsed === null || parsed === undefined) return null;
            if (typeof parsed === 'string') {
                const trimmed = parsed.trim();
                return trimmed === '' ? null : trimmed;
            }
            return parsed;
        };

        const rows = [];
        const rowErrors = [];
        const lastRow = worksheet.actualRowCount || worksheet.rowCount;

        // Fila 1 = encabezado, fila 2 = ejemplo de la plantilla: los datos reales
        // empiezan en la fila 3.
        for (let rowNumber = 3; rowNumber <= lastRow; rowNumber++) {
            const row = worksheet.getRow(rowNumber);

            const valoresCrudos = {};
            for (const campo of Object.keys(HEADER_KEYWORDS)) {
                valoresCrudos[campo] = getValor(row, campo);
            }
            if (filaVacia(valoresCrudos)) continue;

            const codigo = valoresCrudos.codigo ? String(valoresCrudos.codigo).trim() : null;

            try {
                const parsedRow = {
                    rowNumber,
                    codigo,
                    nombre: valoresCrudos.nombre,
                    tipo: valoresCrudos.tipo,
                    que_mide: valoresCrudos.que_mide,
                    unidad_medida_textual: valoresCrudos.unidad_medida_textual,
                    unidad_medida_sigla: valoresCrudos.unidad_medida_sigla,
                    ubicacion: valoresCrudos.ubicacion,
                    sigla: valoresCrudos.sigla,
                    correlativo: valoresCrudos.correlativo !== null ? Number(valoresCrudos.correlativo) : null,
                    estado: valoresCrudos.estado,
                    estado_equipo: valoresCrudos.estado_equipo,
                    responsable_nombre: valoresCrudos.responsable_nombre,
                    equipo_asociado: valoresCrudos.equipo_asociado,
                    // Se deja null cuando la celda viene vacía (en vez de defaultear a 0/NO) para
                    // que la comparación contra la BD sepa distinguir "no lo llenaron" de "lo
                    // pusieron en 0/NO" y no marque una diferencia falsa. El default de negocio
                    // (0/NO) se aplica solo al prellenar el formulario de creación, en el frontend.
                    tiene_fc: valoresCrudos.tiene_fc !== null ? (esSiNo(valoresCrudos.tiene_fc) ? 'SI' : 'NO') : null,
                    error0: valoresCrudos.error0 !== null ? Number(valoresCrudos.error0) : null,
                    error15: valoresCrudos.error15 !== null ? Number(valoresCrudos.error15) : null,
                    error30: valoresCrudos.error30 !== null ? Number(valoresCrudos.error30) : null,
                    visible_muestreador: valoresCrudos.visible_muestreador !== null ? (esSiNo(valoresCrudos.visible_muestreador) ? 'SI' : 'NO') : null,
                    informe: valoresCrudos.informe !== null ? (esSiNo(valoresCrudos.informe) ? 'SI' : 'NO') : null,
                    ultima_verificacion: toYYYYMMDD(valoresCrudos.ultima_verificacion),
                    siguiente_verificacion: toYYYYMMDD(valoresCrudos.siguiente_verificacion),
                    plazo_vigencia: valoresCrudos.plazo_vigencia,
                    observacion: valoresCrudos.observacion,
                    referencia: {
                        marca: valoresCrudos.marca,
                        modelo: valoresCrudos.modelo,
                        serie: valoresCrudos.serie,
                    },
                };
                rows.push(parsedRow);
            } catch (err) {
                rowErrors.push({ rowNumber, message: `No se pudo leer la fila: ${err.message}` });
            }
        }

        return { rows, rowErrors };
    }

    /**
     * Compara las filas ya parseadas contra los equipos reales de la BD
     * (match por código) y devuelve el resumen + detalle de diferencias.
     */
    async compararConBD(parsedRows) {
        const { data: equiposDB } = await equipoService.getEquipos({ page: 1, limit: 100000 });
        const equiposPorCodigo = new Map(
            (equiposDB || [])
                .filter((e) => e.codigo)
                .map((e) => [normalize(e.codigo), e])
        );

        let muestreadores = [];
        try {
            muestreadores = await adminService.getMuestreadores('', '');
        } catch (err) {
            logger.error('[EquipoExcelImport] No se pudo cargar muestreadores:', err);
        }
        const muestreadorPorNombre = new Map(
            (muestreadores || [])
                .filter((m) => m.nombre_muestreador)
                .map((m) => [normalize(m.nombre_muestreador), m])
        );

        const items = parsedRows.map((row) => {
            const warnings = [];

            let idMuestreadorResuelto = null;
            if (row.responsable_nombre) {
                const match = muestreadorPorNombre.get(normalize(row.responsable_nombre));
                if (match) {
                    idMuestreadorResuelto = match.id_muestreador;
                } else {
                    warnings.push(`Responsable "${row.responsable_nombre}" no fue encontrado en el sistema; selecciónelo manualmente al editar.`);
                }
            }

            const excelData = {
                codigo: row.codigo,
                nombre: row.nombre,
                tipo: row.tipo,
                que_mide: row.que_mide,
                unidad_medida_textual: row.unidad_medida_textual,
                unidad_medida_sigla: row.unidad_medida_sigla,
                ubicacion: row.ubicacion,
                sigla: row.sigla,
                correlativo: row.correlativo,
                estado: row.estado,
                estado_equipo: row.estado_equipo,
                equipo_asociado: row.equipo_asociado,
                tiene_fc: row.tiene_fc,
                error0: row.error0,
                error15: row.error15,
                error30: row.error30,
                visible_muestreador: row.visible_muestreador,
                informe: row.informe,
                ultima_verificacion: row.ultima_verificacion,
                siguiente_verificacion: row.siguiente_verificacion,
                plazo_vigencia: row.plazo_vigencia,
                observacion: row.observacion,
                id_muestreador: idMuestreadorResuelto,
            };

            if (!row.codigo) {
                return {
                    rowNumber: row.rowNumber,
                    codigo: null,
                    nombre: row.nombre,
                    status: 'no_existe',
                    id_equipo: null,
                    excelData,
                    diffs: [],
                    warnings: [...warnings, 'La fila no trae Código: no se puede verificar si ya existe, se tratará como equipo nuevo.'],
                    referencia: row.referencia,
                };
            }

            const equipoDB = equiposPorCodigo.get(normalize(row.codigo));

            if (!equipoDB) {
                return {
                    rowNumber: row.rowNumber,
                    codigo: row.codigo,
                    nombre: row.nombre,
                    status: 'no_existe',
                    id_equipo: null,
                    excelData,
                    diffs: [],
                    warnings,
                    referencia: row.referencia,
                };
            }

            const diffs = [];
            for (const campo of CAMPOS_COMPARABLES) {
                const valorExcel = excelData[campo];
                const valorBD = equipoDB[campo];
                if (!sonEquivalentes(campo, valorExcel, valorBD)) {
                    diffs.push({
                        campo,
                        etiqueta: ETIQUETAS_CAMPO[campo] || campo,
                        valorExcel,
                        valorBD,
                    });
                }
            }

            return {
                rowNumber: row.rowNumber,
                codigo: row.codigo,
                nombre: row.nombre,
                status: diffs.length > 0 ? 'difiere' : 'coincide',
                id_equipo: equipoDB.id_equipo,
                excelData,
                diffs,
                warnings,
                referencia: row.referencia,
            };
        });

        const resumen = {
            total: items.length,
            coinciden: items.filter((i) => i.status === 'coincide').length,
            difieren: items.filter((i) => i.status === 'difiere').length,
            noExisten: items.filter((i) => i.status === 'no_existe').length,
        };

        return { resumen, items };
    }
}

function sonEquivalentes(campo, valorExcel, valorBD) {
    // Si el Excel no trae el campo (celda vacía), no se considera una
    // diferencia — solo se compara lo que el usuario efectivamente llenó.
    // Debe ir antes que las ramas por tipo: de lo contrario un Error0/Tiene FC
    // vacío se comparaba como 0/NO literal y generaba diferencias falsas.
    if (valorExcel === null || valorExcel === undefined || valorExcel === '') return true;

    if (CAMPOS_SI_NO.includes(campo)) {
        return esSiNo(valorExcel) === esSiNo(valorBD);
    }
    if (CAMPOS_FECHA.includes(campo)) {
        return (toYYYYMMDD(valorExcel) || null) === (toYYYYMMDD(valorBD) || null);
    }
    if (CAMPOS_NUMERICOS.includes(campo)) {
        const a = Number(valorExcel);
        const b = valorBD === null || valorBD === undefined || valorBD === '' ? 0 : Number(valorBD);
        if (Number.isNaN(a) || Number.isNaN(b)) return normalize(valorExcel) === normalize(valorBD);
        return a === b;
    }
    return normalize(valorExcel) === normalize(valorBD);
}

export default new EquipoExcelImportService();
