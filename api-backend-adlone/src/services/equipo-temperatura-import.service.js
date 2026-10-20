import ExcelJS from 'exceljs';
import logger from '../utils/logger.js';
import equipoService from './equipo.service.js';
import { adminService } from './admin.service.js';
import { normalize, toYYYYMMDD, parseCellValue, esSiNo, resolveNombreMuestreador } from './equipo-excel-import.service.js';

// Columnas del "Resumen Verificaciones Intermedias T°". Los puntos de Error
// (0,0°C / 15,0°C / 30,0°C) vienen ANTES que su espejo "Factor de Corrección"
// (mismo prefijo numérico, sin el "C"), así que al escanear encabezados de
// izquierda a derecha el primer match para error0/15/30 siempre es la columna
// de Error real — la de Factor de Corrección queda sin mapear a propósito,
// porque es solo el valor de Error con el signo invertido, no se guarda aparte.
const HEADER_KEYWORDS = {
    codigo: ['CODIGO'],
    ubicacion: ['SEDE'],
    responsable_nombre: ['RESPONSABLE'],
    fecha: ['FECHA'],
    error0: ['0,0'],
    error15: ['15,0'],
    error30: ['30,0'],
    estado_equipo: ['ESTADO'],
    observacion: ['OBSERVACION'],
    equipo_asociado: ['ASOCIADO'],
};

// 'ubicacion' usa el mismo nombre de campo y la misma columna "Sede" que el
// analizador de Inventario (mae_equipo.sede) — mismo criterio de comparación:
// solo aparece como diferencia si no coincide con lo que ya tiene el equipo.
const CAMPOS_COMPARABLES = [
    'ubicacion', 'error0', 'error15', 'error30', 'tiene_fc', 'ultima_verificacion',
    'estado_equipo', 'observacion', 'equipo_asociado', 'id_muestreador',
];

const ETIQUETAS_CAMPO = {
    ubicacion: 'Sede / Ubicación',
    error0: 'Error 0', error15: 'Error 15', error30: 'Error 30',
    tiene_fc: 'Tiene Factor de Corrección', ultima_verificacion: 'Última Verificación',
    estado_equipo: 'Estado Operativo', observacion: 'Observación',
    equipo_asociado: 'Equipo Asociado', id_muestreador: 'Responsable',
};

const CAMPOS_NUMERICOS = ['error0', 'error15', 'error30', 'id_muestreador'];
const CAMPOS_FECHA = ['ultima_verificacion'];
const CAMPOS_SI_NO = ['tiene_fc'];

const filaVacia = (valores) => Object.values(valores).every((v) => v === null || v === '' || v === undefined);

class EquipoTemperaturaImportService {
    /**
     * Lee el "Resumen Verificaciones Intermedias T°" y devuelve las filas
     * mapeadas. No toca la base de datos. No crea equipos: este archivo no
     * trae nombre/tipo/sede, no hay con qué dar de alta uno nuevo válido.
     */
    async parseTemperaturaExcel(fileBuffer) {
        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.load(fileBuffer);
        } catch (err) {
            throw new Error('El archivo no es un Excel (.xlsx) válido.');
        }

        const worksheet = workbook.getWorksheet('Verif. T°') || workbook.worksheets[0];
        if (!worksheet) {
            throw new Error('El archivo Excel no tiene ninguna hoja con datos.');
        }

        let headerRowIndex = null;
        let columnaPorCampo = {};
        const maxScan = Math.min(15, worksheet.rowCount);
        for (let r = 1; r <= maxScan; r++) {
            const candidato = {};
            worksheet.getRow(r).eachCell({ includeEmpty: false }, (cell, colNumber) => {
                const header = normalize(parseCellValue(cell.value));
                if (!header) return;
                for (const [campo, keywords] of Object.entries(HEADER_KEYWORDS)) {
                    if (candidato[campo]) continue;
                    if (keywords.some((kw) => header.includes(kw))) {
                        candidato[campo] = colNumber;
                    }
                }
            });
            if (candidato.codigo && candidato.error0) {
                headerRowIndex = r;
                columnaPorCampo = candidato;
                break;
            }
        }

        if (!headerRowIndex) {
            throw new Error('No se encontraron las columnas esperadas (Codigo Interno, Error 0,0°C, etc.) en el archivo. ¿Es el "Resumen Verificaciones Intermedias T°"?');
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

        for (let rowNumber = headerRowIndex + 1; rowNumber <= lastRow; rowNumber++) {
            const row = worksheet.getRow(rowNumber);

            const valoresCrudos = {};
            for (const campo of Object.keys(HEADER_KEYWORDS)) {
                valoresCrudos[campo] = getValor(row, campo);
            }
            if (filaVacia(valoresCrudos)) continue;

            const codigo = valoresCrudos.codigo ? String(valoresCrudos.codigo).trim() : null;
            if (!codigo) {
                rowErrors.push({ rowNumber, message: 'La fila no trae Código Interno, se omite.' });
                continue;
            }

            try {
                const error0 = valoresCrudos.error0 !== null ? Number(valoresCrudos.error0) : null;
                const error15 = valoresCrudos.error15 !== null ? Number(valoresCrudos.error15) : null;
                const error30 = valoresCrudos.error30 !== null ? Number(valoresCrudos.error30) : null;
                rows.push({
                    rowNumber,
                    codigo,
                    ubicacion: valoresCrudos.ubicacion,
                    responsable_nombre: valoresCrudos.responsable_nombre,
                    ultima_verificacion: toYYYYMMDD(valoresCrudos.fecha),
                    error0,
                    error15,
                    error30,
                    // Si vino al menos un punto de error, se asume que el equipo sí
                    // tiene factor de corrección registrado para esta verificación.
                    tiene_fc: (error0 !== null || error15 !== null || error30 !== null) ? 'SI' : null,
                    estado_equipo: valoresCrudos.estado_equipo,
                    observacion: valoresCrudos.observacion,
                    equipo_asociado: valoresCrudos.equipo_asociado,
                });
            } catch (err) {
                rowErrors.push({ rowNumber, message: `No se pudo leer la fila: ${err.message}` });
            }
        }

        return { rows, rowErrors };
    }

    /**
     * Compara las filas ya parseadas contra los equipos reales de la BD
     * (match por código). Solo compara los campos de temperatura/estado que
     * trae este archivo — nunca nombre/tipo/ubicación, que no vienen acá.
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
            logger.error('[EquipoTemperaturaImport] No se pudo cargar muestreadores:', err);
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
                const match = muestreadorPorNombre.get(resolveNombreMuestreador(row.responsable_nombre));
                if (match) {
                    idMuestreadorResuelto = match.id_muestreador;
                } else {
                    warnings.push(`Responsable "${row.responsable_nombre}" no fue encontrado en el sistema; selecciónelo manualmente al editar.`);
                }
            }

            const excelData = {
                ubicacion: row.ubicacion,
                error0: row.error0,
                error15: row.error15,
                error30: row.error30,
                tiene_fc: row.tiene_fc,
                ultima_verificacion: row.ultima_verificacion,
                estado_equipo: row.estado_equipo,
                observacion: row.observacion,
                equipo_asociado: row.equipo_asociado,
                id_muestreador: idMuestreadorResuelto,
            };

            const equipoDB = equiposPorCodigo.get(normalize(row.codigo));

            if (!equipoDB) {
                return {
                    rowNumber: row.rowNumber,
                    codigo: row.codigo,
                    nombre: null,
                    status: 'no_encontrado',
                    id_equipo: null,
                    excelData,
                    diffs: [],
                    warnings: [...warnings, 'No existe ningún equipo con este código en el sistema.'],
                };
            }

            const diffs = [];
            for (const campo of CAMPOS_COMPARABLES) {
                const valorExcel = excelData[campo];
                const valorBD = equipoDB[campo];

                if (campo === 'equipo_asociado') {
                    // Solo se ofrece agregar el equipo asociado cuando en la BD ese
                    // campo está vacío para este equipo (nunca se sobreescribe uno ya
                    // cargado) y cuando el código que trae el Excel corresponde a un
                    // equipo real del sistema (nunca se deja un vínculo a un código
                    // que no existe).
                    if (!valorExcel) continue;
                    const bdVacio = !valorBD || valorBD === '0' || normalize(String(valorBD)) === 'NO APLICA';
                    const referenciaExiste = equiposPorCodigo.has(normalize(String(valorExcel)));
                    if (bdVacio && referenciaExiste) {
                        diffs.push({ campo, etiqueta: ETIQUETAS_CAMPO[campo], valorExcel, valorBD });
                    }
                    continue;
                }

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
                nombre: equipoDB.nombre,
                status: diffs.length > 0 ? 'difiere' : 'coincide',
                id_equipo: equipoDB.id_equipo,
                excelData,
                diffs,
                warnings,
            };
        });

        const resumen = {
            total: items.length,
            coinciden: items.filter((i) => i.status === 'coincide').length,
            difieren: items.filter((i) => i.status === 'difiere').length,
            noEncontrados: items.filter((i) => i.status === 'no_encontrado').length,
        };

        return { resumen, items };
    }
}

function sonEquivalentes(campo, valorExcel, valorBD) {
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

export default new EquipoTemperaturaImportService();
