import ExcelJS from 'exceljs';
import logger from '../utils/logger.js';
import equipoService from './equipo.service.js';
import { adminService } from './admin.service.js';

// Quita tildes, pasa a mayúsculas y colapsa espacios — usado tanto para
// encabezados de columna como para comparar valores de texto. Exportado
// porque equipo-temperatura-import.service.js reutiliza este mismo helper
// (y toYYYYMMDD/parseCellValue/esSiNo más abajo) en vez de duplicarlo.
export const normalize = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
};


// ── Observaciones ──────────────────────────────────────────────────────────────────────────────
// La observación del Excel suele ser un historial de varias líneas con fecha propia. Se compara
// línea por línea contra lo que ya tiene el equipo, y solo las líneas que no están se agregan.
// Dos líneas son la misma si coinciden en texto Y en fecha: "22.01.25 Dado de baja" y
// "22/01/2025 dado de baja" son la misma; con otra fecha ya son distintas. Se ignora el
// prefijo "- [dd/mm/aaaa]" que agrega el propio sistema al actualizar.
const RE_FECHA_EN_LINEA = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/g;
export const claveLineaObservacion = (linea) => {
    const sinPrefijo = String(linea ?? '').replace(/^\s*-?\s*\[\d{1,2}\/\d{1,2}\/\d{4}\]\s*/, '');
    const conFechas = sinPrefijo.replace(RE_FECHA_EN_LINEA, (_m, d, m, a) =>
        `${a.length === 2 ? '20' + a : a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    return normalize(conFechas).replace(/^-\s*/, '');
};
export const lineasNuevasObservacion = (excel, bd) => {
    const existentes = String(bd ?? '').split(/\r?\n/).map(claveLineaObservacion).filter(Boolean);
    // Una línea ya está si coincide con una existente o si está contenida en ella (la existente puede
    // traer más texto, ej. "Dado de baja 16.02.26 Informado por X" frente a "Dado de baja 16.02.26").
    const yaEsta = (k) => existentes.some((e) => e.includes(k));
    const vistas = new Set();
    return String(excel ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => {
        const k = claveLineaObservacion(l);
        if (!k || yaEsta(k) || vistas.has(k)) return false;
        vistas.add(k);
        return true;
    });
};

// Nombres que aparecen distintos en los Excel pero corresponden al mismo
// muestreador ya registrado en el sistema con otro nombre (ej. "Ernesto
// Lira" en los archivos es en realidad "Javier Lira"). Se resuelven antes de
// buscar por nombre_muestreador, tanto en el analizador de Inventario como
// en el de Temperaturas.
const ALIAS_MUESTREADOR = {
    'ERNESTO LIRA': 'JAVIER LIRA',
};

export const resolveNombreMuestreador = (nombreExcel) => {
    const n = normalize(nombreExcel);
    return ALIAS_MUESTREADOR[n] || n;
};

// Cada campo que nos interesa, con los fragmentos (ya normalizados) que
// identifican su columna en el inventario real (OI-FoGe-21). Se usa
// "includes" en vez de igualdad estricta para tolerar pequeños cambios de
// redacción del header entre versiones del archivo.
//
// Importante: "Última/Próxima Verificación Trimestral T°" NO tiene keyword
// acá a propósito — son las columnas de temperatura que este análisis omite
// por instrucción explícita. Esas se leen aparte, en
// equipo-temperatura-import.service.js, desde el otro archivo.
const HEADER_KEYWORDS = {
    codigo: ['CODIGO'],
    nombre: ['NOMBRE DE EQUIPO', 'NOMBRE DEL EQUIPO'],
    marca: ['MARCA'],
    modelo: ['MODELO'],
    serie: ['SERIE'],
    ubicacion: ['SEDE'],
    estado_equipo: ['ESTADO'],
    observacion: ['OBSERVACION'],
    responsable_nombre: ['RESPONSABLE'],
    // Dos ciclos de verificación distintos que sí trae el inventario (la
    // prioridad entre ambos se resuelve en parseEquiposExcel, no acá).
    contrastacion_ultima: ['ULTIMA CONTRASTACION'],
    contrastacion_proxima: ['PROXIMA CONTRASTACION'],
    mantencion_ultima: ['ULTIMA MANTENCION'],
    mantencion_proxima: ['PROXIMA MANTENCION'],
    // Datos de compra/baja (columnas O-S y AA del inventario real). "Fecha"
    // (col. 16, de compra) es un header genérico que también es substring de
    // "Fecha dado de baja" (col. 27) — como el escaneo de encabezados es
    // izquierda a derecha y cada campo solo toma la PRIMERA columna que
    // matchee, fecha_compra ya queda fijado en la col. 16 antes de llegar a
    // la 27, así que no hay colisión.
    proveedor: ['PROVEEDOR'],
    fecha_compra: ['FECHA'],
    documento_compra: ['DOCUMENTO'],
    n_documento_compra: ['DOCTO'],
    valor_unitario: ['VALOR UNITARIO'],
    fecha_baja: ['FECHA DADO DE BAJA'],
};

// Campos que se comparan contra la BD para decidir "coincide" vs "difiere".
// (marca/modelo/serie quedan fuera: son solo referencia, mae_equipo no las tiene)
const CAMPOS_COMPARABLES = [
    'nombre', 'tipo', 'ubicacion', 'estado', 'sigla', 'correlativo',
    'tiene_fc', 'error0', 'error15', 'error30', 'equipo_asociado',
    'visible_muestreador', 'que_mide', 'unidad_medida_textual', 'unidad_medida_sigla',
    'informe', 'ultima_verificacion', 'siguiente_verificacion', 'plazo_vigencia',
    'estado_equipo', 'observacion', 'id_muestreador',
    'proveedor', 'fecha_compra', 'documento_compra', 'n_documento_compra', 'valor_unitario', 'fecha_baja',
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
    proveedor: 'Proveedor', fecha_compra: 'Fecha de Compra', documento_compra: 'Documento',
    n_documento_compra: 'N° Documento', valor_unitario: 'Valor Unitario', fecha_baja: 'Fecha Dado de Baja',
};

const CAMPOS_SI_NO = ['tiene_fc', 'visible_muestreador', 'informe'];
const CAMPOS_NUMERICOS = ['correlativo', 'error0', 'error15', 'error30', 'id_muestreador', 'valor_unitario'];
const CAMPOS_FECHA = ['ultima_verificacion', 'siguiente_verificacion', 'fecha_compra', 'fecha_baja'];

export const toYYYYMMDD = (value) => {
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
    // Cualquier otra cosa no es una fecha real — "No Aplica", "N/I", "-", etc.
    // (habituales en el inventario real para campos sin dato). Devolverla tal
    // cual la haría compararse como si fuera una fecha válida y generaría
    // diferencias falsas contra la fecha real que ya tiene el equipo en la BD.
    return null;
};

export const parseCellValue = (raw) => {
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

export const esSiNo = (value) => {
    const n = normalize(value);
    return n === 'SI' || n === 'S' || n === 'TRUE' || n === '1';
};

// Devuelve true si la fila no trae ningún dato útil (para cortar al llegar
// a filas vacías al final de la hoja).
const filaVacia = (valores) => Object.values(valores).every((v) => v === null || v === '' || v === undefined);

class EquipoExcelImportService {
    /**
     * Lee el inventario real (OI-FoGe-21) subido y devuelve las filas
     * mapeadas a los nombres de campo que usan createEquipo/updateEquipo.
     * No toca la base de datos.
     */
    async parseEquiposExcel(fileBuffer) {
        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.load(fileBuffer);
        } catch (err) {
            throw new Error('El archivo no es un Excel (.xlsx) válido.');
        }

        const worksheet = workbook.getWorksheet('EQUIPOS MUESTREO') || workbook.worksheets[0];
        if (!worksheet) {
            throw new Error('El archivo Excel no tiene ninguna hoja con datos.');
        }

        // El inventario trae un bloque de membrete (logo, código del formulario,
        // fecha de vigencia) de alto variable antes de la tabla real — en vez de
        // asumir una fila fija, se busca la primera fila que tenga a la vez
        // "Código" y "Nombre de Equipo", que es la fila de encabezados real.
        let headerRowIndex = null;
        let columnaPorCampo = {};
        const maxScan = Math.min(20, worksheet.rowCount);
        for (let r = 1; r <= maxScan; r++) {
            const candidato = {};
            worksheet.getRow(r).eachCell({ includeEmpty: false }, (cell, colNumber) => {
                const header = normalize(parseCellValue(cell.value));
                if (!header) return;
                for (const [campo, keywords] of Object.entries(HEADER_KEYWORDS)) {
                    if (candidato[campo]) continue; // ya encontrado en esta fila, no sobrescribir
                    if (keywords.some((kw) => header.includes(kw))) {
                        candidato[campo] = colNumber;
                    }
                }
            });
            if (candidato.codigo && candidato.nombre) {
                headerRowIndex = r;
                columnaPorCampo = candidato;
                break;
            }
        }

        if (!headerRowIndex) {
            throw new Error('No se encontraron las columnas esperadas (Código, Nombre de Equipo) en el archivo. ¿Es el inventario OI-FoGe-21?');
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

            try {
                // Prioridad entre los dos ciclos de verificación que trae el inventario:
                // Contrastación Semestral primero (la calibración "oficial"), luego
                // Mantención Anual. Solo se usa un ciclo si tiene AMBAS fechas (última Y
                // próxima) — así nunca se mezcla la última de un ciclo con la próxima de
                // otro. Si ninguno trae el par completo, se deja null a propósito: el
                // fallback a hoy/+90 días es solo para crear equipos nuevos y se aplica
                // en el frontend, no acá — si lo pusiéramos acá, cada equipo sin fecha
                // real en el Excel se marcaría "difiere" contra la fecha real que ya
                // tiene guardada en la BD.
                const contrastacionUltima = toYYYYMMDD(valoresCrudos.contrastacion_ultima);
                const contrastacionProxima = toYYYYMMDD(valoresCrudos.contrastacion_proxima);
                const mantencionUltima = toYYYYMMDD(valoresCrudos.mantencion_ultima);
                const mantencionProxima = toYYYYMMDD(valoresCrudos.mantencion_proxima);
                let ultimaVerificacion = null;
                let siguienteVerificacion = null;
                if (contrastacionUltima && contrastacionProxima) {
                    ultimaVerificacion = contrastacionUltima;
                    siguienteVerificacion = contrastacionProxima;
                } else if (mantencionUltima && mantencionProxima) {
                    ultimaVerificacion = mantencionUltima;
                    siguienteVerificacion = mantencionProxima;
                }

                // Activo/Inactivo se deriva del texto de Estado — el inventario no trae
                // una columna separada para esto. "Fuera de Servicio" cuenta como
                // Inactivo igual que "Dado de Baja" (mismo criterio que ahora aplica
                // también equipo.service.js al crear/editar).
                const estadoTexto = normalize(valoresCrudos.estado_equipo);
                const estado = (estadoTexto.includes('BAJA') || estadoTexto.includes('FUERA DE SERVICIO')) ? 'Inactivo' : 'Activo';

                const parsedRow = {
                    rowNumber,
                    codigo,
                    nombre: valoresCrudos.nombre,
                    ubicacion: valoresCrudos.ubicacion,
                    estado,
                    estado_equipo: valoresCrudos.estado_equipo,
                    responsable_nombre: valoresCrudos.responsable_nombre,
                    observacion: valoresCrudos.observacion,
                    ultima_verificacion: ultimaVerificacion,
                    siguiente_verificacion: siguienteVerificacion,
                    proveedor: valoresCrudos.proveedor,
                    fecha_compra: toYYYYMMDD(valoresCrudos.fecha_compra),
                    documento_compra: valoresCrudos.documento_compra,
                    // El Excel mezcla número ("208691") y texto ("N/I") en esta columna.
                    n_documento_compra: valoresCrudos.n_documento_compra !== null ? String(valoresCrudos.n_documento_compra) : null,
                    valor_unitario: valoresCrudos.valor_unitario,
                    fecha_baja: toYYYYMMDD(valoresCrudos.fecha_baja),
                    referencia: {
                        marca: valoresCrudos.marca,
                        modelo: valoresCrudos.modelo,
                        serie: valoresCrudos.serie,
                    },
                };
                if (rows.some((r) => r.codigo === parsedRow.codigo)) {
                    rowErrors.push({ rowNumber, message: `El código ${parsedRow.codigo} está repetido en el Excel; se usará la última fila.` });
                }
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

        // El inventario no trae Tipo / Qué Mide / Unidad de Medida — se resuelven
        // desde el catálogo de equipos por coincidencia de Nombre (el mismo que ya
        // usa EquipoForm al autocompletar esos campos al elegir un nombre).
        let catalogo = [];
        try {
            catalogo = await equipoService.getEquipoCatalogo();
        } catch (err) {
            logger.error('[EquipoExcelImport] No se pudo cargar el catálogo de equipos:', err);
        }
        const catalogoPorNombre = new Map(
            (catalogo || [])
                .filter((c) => c.nombre)
                .map((c) => [normalize(c.nombre), c])
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

            const catalogoMatch = row.nombre ? catalogoPorNombre.get(normalize(row.nombre)) : null;
            if (row.nombre && !catalogoMatch) {
                warnings.push(`Nombre "${row.nombre}" no está en el catálogo de equipos; complete Tipo manualmente al editar.`);
            }

            const excelData = {
                codigo: row.codigo,
                nombre: row.nombre,
                tipo: catalogoMatch?.tipo_equipo || null,
                que_mide: catalogoMatch?.que_mide || null,
                unidad_medida_textual: catalogoMatch?.unidad_medida_textual || null,
                unidad_medida_sigla: catalogoMatch?.unidad_medida_sigla || null,
                ubicacion: row.ubicacion,
                estado: row.estado,
                estado_equipo: row.estado_equipo,
                ultima_verificacion: row.ultima_verificacion,
                siguiente_verificacion: row.siguiente_verificacion,
                observacion: row.observacion,
                id_muestreador: idMuestreadorResuelto,
                proveedor: row.proveedor,
                fecha_compra: row.fecha_compra,
                documento_compra: row.documento_compra,
                n_documento_compra: row.n_documento_compra,
                valor_unitario: row.valor_unitario,
                fecha_baja: row.fecha_baja,
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
        // Tolerancia: los errores se guardan con 1 decimal y el Excel trae ruido de
        // punto flotante (-0.0600000000000008 vs -0.1 ya redondeado).
        return Math.abs(a - b) < 0.005;
    }
    if (campo === 'observacion') {
        // La observación se AGREGA (nunca se sobreescribe — ver appendObservacion
        // en el frontend), así que después de actualizarla una vez el valor en
        // BD nunca vuelve a ser idéntico al del Excel. Si ya quedó incluida como
        // substring, no es una diferencia real — compararla por igualdad exacta
        // la marcaría como "distinta" para siempre y la agregaría de nuevo en
        // cada reanálisis.
        return lineasNuevasObservacion(valorExcel, valorBD).length === 0;
    }
    return normalize(valorExcel) === normalize(valorBD);
}

export default new EquipoExcelImportService();
