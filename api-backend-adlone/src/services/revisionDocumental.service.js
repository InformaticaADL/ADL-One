import sql from 'mssql';
import { getConnection } from '../config/database.js';
import { pdfFichaTecnica, pdfHistorial, pdfEntrega, pdfRecepcion, pdfCaudal } from './fichasEquipo.pdf.js';
import { generarPdfVerificacion } from './verificacionTemperatura.pdf.js';
import { pdfListadoQa, pdfPrograma, pdfPlan, pdfReunion, pdfHallazgos, pdfInforme, pdfAccionCorrectiva } from './calidad.pdf.js';

// Fechas de revisión documental de los formularios de Gestión de Calidad (la que va en el encabezado de cada
// ficha, "Fecha Revisión"). Cada año tiene una fecha de inicio y rige hasta el día anterior a la del año siguiente.
// Ejemplo: la revisión 2025 inicia el 06.01.25 y termina el 11.01.26; desde el 12.01.26 rige la 2026.
//
// Se guardan en mae_revision_documental (migrations/add_revision_documental.sql). Mientras la tabla no exista se usan
// estas tres, que son las vigentes hoy, así las fichas salen bien igual.

const BASE = [
    { anio: 2024, fecha_inicio: '2023-12-26' },
    { anio: 2025, fecha_inicio: '2025-01-06' },
    { anio: 2026, fecha_inicio: '2026-01-12' },
];

// Encabezado de cada documento (Versión, Fecha Vigencia y su revisión propia). Tabla mae_documento_control
// (migrations/add_documentos_control.sql); sin ella se usan estos valores, que son los de los formularios vigentes.
export const DOCUMENTOS_BASE = [
    { codigo: 'OI-FoGe-22', nombre: 'Ficha Técnica de Equipos', version: 'Versión 01', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-23', nombre: 'Por confirmar (formulario de equipos)', version: 'Versión 01', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-24', nombre: 'Historial de equipo', version: 'Versión 01', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-30', nombre: 'Verificación Intermedia Sonda Caudal', version: 'Versión 01', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-36', nombre: 'Ficha Entrega de Equipo', version: 'Versión 01', fecha_vigencia: '2013-03-10', fecha_revision: null },
    { codigo: 'OI-FoGe-39', nombre: 'Verificación Intermedia de Temperatura', version: 'Versión 03', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-42', nombre: 'Recepción, Puesta en Marcha y Verificación de Equipo', version: 'Versión 01', fecha_vigencia: '2020-12-28', fecha_revision: null },
    // G. Calidad → Calidad (migrations/add_calidad_auditorias.sql)
    { codigo: 'OI-FoGe-02', nombre: 'Acción Correctiva', version: 'Versión 02', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-06', nombre: 'Listado de Quejas y Apelaciones', version: 'Versión 01', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-07', nombre: 'Programa Anual de Auditorías Internas', version: 'Versión 02', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-08', nombre: 'Plan de Auditoría Interna', version: 'Versión 01', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-09', nombre: 'Hallazgos de Auditoría', version: 'Versión 01', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-10', nombre: 'Reunión Inicial y Final Auditoría Interna', version: 'Versión 01', fecha_vigencia: '2016-06-20', fecha_revision: null },
    { codigo: 'OI-FoGe-11', nombre: 'Informe de Auditorías Internas', version: 'Versión 01', fecha_vigencia: '2016-06-20', fecha_revision: null },
];

const error = (mensaje, statusCode = 400) => Object.assign(new Error(mensaje), { statusCode });
const hoyYmd = () => new Date().toISOString().slice(0, 10);
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const dmy = (ymd) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '');

/** Cada revisión con su fin (el día antes de que empiece la siguiente) y si es la que rige hoy. Ordenadas por año. */
export const conRangos = (lista, hoy = hoyYmd()) => {
    const orden = [...lista].sort((a, b) => a.anio - b.anio);
    const filas = orden.map((r, i) => {
        const sig = orden[i + 1];
        let fin = null;
        if (sig) {
            const d = new Date(`${sig.fecha_inicio}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() - 1);
            fin = d.toISOString().slice(0, 10);
        }
        return { ...r, fecha_fin: fin };
    });
    const vigente = [...filas].reverse().find((r) => r.fecha_inicio <= hoy) || filas[0] || null;
    return filas.map((r) => ({ ...r, vigente: vigente ? r.anio === vigente.anio : false }));
};

/** La revisión del año indicado; si ese año no tiene, la más reciente anterior (o la primera). */
export const revisionDelAnio = (lista, anio) => {
    const orden = [...lista].sort((a, b) => a.anio - b.anio);
    return orden.find((r) => r.anio === anio) || [...orden].reverse().find((r) => r.anio < anio) || orden[0] || null;
};

/**
 * Año del historial al que pertenece una fecha (aaaammdd): el de la revisión documental que regía ese día. Así la
 * revisión 2025, que va del 06.01.25 al 11.01.26, incluye las observaciones de los primeros días de enero de 2026.
 * Antes de la primera revisión registrada, o cuando ya pasó el año de la última sin registrar la nueva, vale el año
 * del calendario.
 */
export const anioDeHistorial = (lista, fechaNum) => {
    const s = String(fechaNum);
    const ymd = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const calendario = Number(s.slice(0, 4));
    const orden = [...lista].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
    const r = [...orden].reverse().find((x) => x.fecha_inicio <= ymd);
    if (!r) return calendario;
    if (r === orden[orden.length - 1] && calendario > r.anio) return calendario;
    return r.anio;
};

/** La que rige en una fecha: la de inicio más reciente que no pase de esa fecha. */
export const revisionEnFecha = (lista, fecha) => {
    const orden = [...lista].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
    return [...orden].reverse().find((r) => r.fecha_inicio <= fecha) || orden[0] || null;
};

/**
 * Encabezado de un documento en una fecha (o para el historial de un año): Versión, Fecha Vigencia y Fecha Revisión.
 * La Fecha Revisión es la más reciente entre la revisión anual que rige y la revisión propia del documento, siempre
 * que esta no sea posterior al corte (una modificación a mitad de año). → textos "dd/mm/aaaa".
 */
export const encabezadoDe = (doc, lista, { fecha = null, anio = null } = {}) => {
    const rangos = conRangos(lista, fecha || hoyYmd());
    let anual = null;
    if (anio) {
        const r = revisionDelAnio(lista, Number(anio));
        anual = r ? rangos.find((x) => x.anio === r.anio) : null;
    } else {
        anual = rangos.find((r) => r.vigente) || null;
    }
    const corte = anio ? (anual?.fecha_fin || hoyYmd()) : (fecha || hoyYmd());
    let revision = anual?.fecha_inicio || null;
    const propia = doc?.fecha_revision || null;
    if (propia && propia <= corte && (!revision || propia > revision)) revision = propia;
    return {
        version: doc?.version || null,
        vigencia: doc?.fecha_vigencia ? dmy(doc.fecha_vigencia) : null,
        revision: revision ? dmy(revision) : null,
        nombre: doc?.nombre || null,
    };
};

// Formulario en blanco de cada documento, para ver cómo queda su encabezado (OI-FoGe-23 todavía no tiene formulario).
const FORMULARIO_EN_BLANCO = {
    'OI-FoGe-22': (encabezado) => pdfFichaTecnica({ encabezado }),
    'OI-FoGe-24': (encabezado) => pdfHistorial({ encabezado }),
    'OI-FoGe-30': (encabezado) => pdfCaudal({ encabezado }),
    'OI-FoGe-36': (encabezado) => pdfEntrega({ encabezado }),
    'OI-FoGe-39': (encabezado) => generarPdfVerificacion({ encabezado }),
    'OI-FoGe-42': (encabezado) => pdfRecepcion({ encabezado }),
    'OI-FoGe-06': (encabezado) => pdfListadoQa({ encabezado }),
    'OI-FoGe-07': (encabezado) => pdfPrograma({ encabezado, filas: [] }),
    'OI-FoGe-08': (encabezado) => pdfPlan({ encabezado, auditoria: {}, agenda: [] }),
    'OI-FoGe-09': (encabezado) => pdfHallazgos({ encabezado, hojas: [] }),
    'OI-FoGe-10': (encabezado) => pdfReunion({ encabezado, auditoria: {}, inicial: [], final: [] }),
    'OI-FoGe-11': (encabezado) => pdfInforme({ encabezado, auditoria: {}, noConformidades: [], observacionesAuditoria: [] }),
    'OI-FoGe-02': (encabezado) => pdfAccionCorrectiva({ encabezado, ac: {} }),
};
export const CODIGOS_CON_FORMULARIO = Object.keys(FORMULARIO_EN_BLANCO);

const tablaExiste = async (pool) =>!!(await pool.request().query("SELECT OBJECT_ID('mae_revision_documental', 'U') AS t")).recordset[0].t;

const leer = async () => {
    const pool = await getConnection();
    if (!(await tablaExiste(pool))) return { pool, tabla: false, lista: BASE };
    const r = await pool.request().query(`
        SELECT anio, CONVERT(VARCHAR(10), fecha_inicio, 23) AS fecha_inicio, motivo
        FROM mae_revision_documental ORDER BY anio`);
    return { pool, tabla: true, lista: r.recordset.length ? r.recordset : BASE };
};

const tablaDocsExiste = async (pool) => !!(await pool.request().query("SELECT OBJECT_ID('mae_documento_control', 'U') AS t")).recordset[0].t;

const leerDocs = async (pool) => {
    if (!(await tablaDocsExiste(pool))) return { tablaDocs: false, documentos: DOCUMENTOS_BASE };
    const r = await pool.request().query(`
        SELECT codigo, nombre, version, CONVERT(VARCHAR(10), fecha_vigencia, 23) AS fecha_vigencia,
               CONVERT(VARCHAR(10), fecha_revision, 23) AS fecha_revision, motivo
        FROM mae_documento_control ORDER BY codigo`);
    return { tablaDocs: true, documentos: r.recordset.length ? r.recordset : DOCUMENTOS_BASE };
};

const exigirTabla = (tabla) => {
    if (!tabla) throw error('Falta ejecutar la migración add_revision_documental.sql para poder editar las fechas de revisión.', 503);
};

const revisionDocumentalService = {
    async listar() {
        const { pool, tabla, lista } = await leer();
        const { tablaDocs, documentos } = await leerDocs(pool);
        return {
            editable: tabla,
            revisiones: conRangos(lista),
            documentos_editables: tablaDocs,
            documentos: documentos.map((d) => ({ ...d, encabezado: encabezadoDe(d, lista) })),
        };
    },

    /**
     * Encabezado de un documento para su PDF: `anio` para el historial de ese año; `fecha` (aaaa-mm-dd) para un
     * documento ya firmado o aprobado, así su Fecha Revisión es la que regía ese día; si no, el de hoy.
     * Si algo falla devuelve null y el PDF usa los valores propios del formulario.
     */
    async encabezado(codigo, { anio = null, fecha = null } = {}) {
        try {
            const { pool, lista } = await leer();
            const { documentos } = await leerDocs(pool);
            const doc = documentos.find((d) => d.codigo === codigo) || DOCUMENTOS_BASE.find((d) => d.codigo === codigo) || null;
            return encabezadoDe(doc, lista, { anio, fecha: esFecha(fecha) ? fecha : null });
        } catch { return null; }
    },

    /**
     * Vista previa del formulario (en blanco, con logo y encabezado) con lo que se está editando, sin guardar nada.
     * Aplica la misma regla que al guardar: una versión nueva sin revisión propia toma la fecha de vigencia.
     */
    async vistaPrevia(codigo, { nombre, version, fecha_vigencia, fecha_revision } = {}) {
        const generar = FORMULARIO_EN_BLANCO[codigo];
        if (!generar) throw error('Este documento todavía no tiene un formulario en la aplicación.', 404);
        const { pool, lista } = await leer();
        const { documentos } = await leerDocs(pool);
        const actual = documentos.find((d) => d.codigo === codigo) || DOCUMENTOS_BASE.find((d) => d.codigo === codigo);
        const v = String(version ?? actual.version ?? '').trim().slice(0, 20) || actual.version;
        let revision = esFecha(fecha_revision) ? fecha_revision : null;
        if (v !== actual.version && !revision && esFecha(fecha_vigencia)) revision = fecha_vigencia;
        const doc = {
            ...actual,
            nombre: String(nombre ?? actual.nombre ?? '').trim().slice(0, 200) || actual.nombre,
            version: v,
            fecha_vigencia: esFecha(fecha_vigencia) ? fecha_vigencia : actual.fecha_vigencia,
            fecha_revision: revision,
        };
        return generar(encabezadoDe(doc, lista));
    },

    /**
     * Gestión de Calidad: al cambiar de versión, la Fecha Vigencia pasa a ser la fecha de la nueva versión y la Fecha
     * Revisión obedece a esa modificación hasta la próxima revisión anual (ahí se alinea con los demás documentos).
     */
    async guardarDocumento(codigo, { nombre, version, fecha_vigencia, fecha_revision, motivo }, idUsuario) {
        const { pool } = await leer();
        const { tablaDocs, documentos } = await leerDocs(pool);
        if (!tablaDocs) throw error('Falta ejecutar la migración add_documentos_control.sql para poder editar los encabezados.', 503);
        const actual = documentos.find((d) => d.codigo === codigo);
        if (!actual) throw error('Documento no encontrado.', 404);
        const v = String(version || '').trim().slice(0, 20);
        const n = String(nombre ?? actual.nombre ?? '').trim().slice(0, 200);
        if (!n) throw error('Indique el nombre del documento.');
        // Nueva versión sin revisión propia: la revisión es la fecha de esa modificación.
        if (v !== actual.version && !fecha_revision && esFecha(fecha_vigencia)) fecha_revision = fecha_vigencia;
        if (!v) throw error('Indique la versión (ej. Versión 02).');
        if (!esFecha(fecha_vigencia)) throw error('Indique la fecha de vigencia.');
        if (fecha_revision && !esFecha(fecha_revision)) throw error('La fecha de revisión no es válida.');
        if (fecha_revision && fecha_revision < fecha_vigencia) throw error('La fecha de revisión no puede ser anterior a la de vigencia.');
        await pool.request()
            .input('cod', sql.VarChar(20), codigo)
            .input('nom', sql.NVarChar(200), n)
            .input('ver', sql.NVarChar(20), v)
            .input('vig', sql.Date, fecha_vigencia)
            .input('rev', sql.Date, fecha_revision || null)
            .input('mot', sql.NVarChar(300), String(motivo || '').trim().slice(0, 300) || null)
            .input('u', sql.Numeric(10, 0), idUsuario || null)
            .query(`UPDATE mae_documento_control SET nombre = @nom, version = @ver, fecha_vigencia = @vig, fecha_revision = @rev, motivo = @mot,
                        id_usuario = @u, fecha_modificacion = GETDATE() WHERE codigo = @cod`);
        return this.listar();
    },

    /** Revisiones tal como están guardadas (sin rangos), para asignar fechas a su periodo. */
    async lista() {
        try { return (await leer()).lista; } catch { return BASE; }
    },

    /** "dd/mm/aaaa" de la revisión que rige hoy (formularios sin año propio). */
    async textoVigente() {
        try {
            const { lista } = await leer();
            const r = revisionEnFecha(lista, hoyYmd());
            return r ? dmy(r.fecha_inicio) : null;
        } catch { return null; }
    },

    /** "dd/mm/aaaa" de la revisión del año (para el historial de ese año). */
    async textoDelAnio(anio) {
        try {
            const { lista } = await leer();
            const r = revisionDelAnio(lista, Number(anio));
            return r ? dmy(r.fecha_inicio) : null;
        } catch { return null; }
    },

    async guardar({ anio, fecha_inicio, motivo }, idUsuario) {
        const a = Number(anio);
        if (!Number.isInteger(a) || a < 2000 || a > 2100) throw error('Indique un año válido.');
        if (!esFecha(fecha_inicio)) throw error('Indique la fecha en que inicia la revisión.');
        const { pool, tabla, lista } = await leer();
        exigirTabla(tabla);
        const otras = lista.filter((r) => r.anio !== a);
        const antes = otras.filter((r) => r.anio < a).pop();
        const despues = otras.find((r) => r.anio > a);
        if (antes && fecha_inicio <= antes.fecha_inicio) throw error(`La revisión ${a} debe iniciar después del ${dmy(antes.fecha_inicio)} (revisión ${antes.anio}).`);
        if (despues && fecha_inicio >= despues.fecha_inicio) throw error(`La revisión ${a} debe iniciar antes del ${dmy(despues.fecha_inicio)} (revisión ${despues.anio}).`);
        await pool.request()
            .input('anio', sql.Int, a)
            .input('fecha', sql.Date, fecha_inicio)
            .input('motivo', sql.NVarChar(300), String(motivo || '').trim().slice(0, 300) || null)
            .input('u', sql.Numeric(10, 0), idUsuario || null)
            .query(`
                IF EXISTS (SELECT 1 FROM mae_revision_documental WHERE anio = @anio)
                    UPDATE mae_revision_documental SET fecha_inicio = @fecha, motivo = @motivo, id_usuario = @u, fecha_modificacion = GETDATE() WHERE anio = @anio
                ELSE
                    INSERT INTO mae_revision_documental (anio, fecha_inicio, motivo, id_usuario) VALUES (@anio, @fecha, @motivo, @u)`);
        return this.listar();
    },

    async eliminar(anio) {
        const a = Number(anio);
        const { pool, tabla, lista } = await leer();
        exigirTabla(tabla);
        if (lista.length <= 1) throw error('Debe quedar al menos una fecha de revisión.');
        await pool.request().input('anio', sql.Int, a).query('DELETE FROM mae_revision_documental WHERE anio = @anio');
        return this.listar();
    },
};

export default revisionDocumentalService;
