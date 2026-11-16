import sql from 'mssql';
import { getConnection } from '../config/database.js';
import { lineasObservacionConFecha, fechaNumATexto } from '../utils/observacionEquipo.js';
import { pdfFichaTecnica, pdfHistorial, pdfEntrega, pdfRecepcion, ITEMS_RECEPCION } from './fichasEquipo.pdf.js';
import firmaDigitalService from './firmaDigital.service.js';
import equipoService from './equipo.service.js';

// Datos de los formularios de equipo (OI-FoGe-22 / 24 / 36) y su PDF.
// Todo es de solo lectura: generar una ficha no cambia el equipo.

const error = (message, status = 400) => Object.assign(new Error(message), { status });

const ymd = (v) => {
    if (!v) return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
    const s = String(v);
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const numAYmd = (n) => {
    const s = String(n);
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nombreArchivo = (s) => String(s || 'equipo').replace(/[\\/:*?"<>|]+/g, '-').trim();

const cargarEquipo = async (pool, id) => {
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum <= 0) throw error('Equipo inválido');
    const r = await pool.request().input('id', sql.Int, idNum).query(`
        SELECT e.*, m.nombre_muestreador
        FROM mae_equipo e
        LEFT JOIN mae_muestreador m ON m.id_muestreador = e.id_muestreador
        WHERE e.id_equipo = @id`);
    const eq = r.recordset[0];
    if (!eq) throw error('Equipo no encontrado', 404);
    return eq;
};

// ─── OI-FoGe-24 · Historial por año ────────────────────────────────────────

const historialAnios = async (id) => {
    const pool = await getConnection();
    const eq = await cargarEquipo(pool, id);
    // La OBSERVACIÓN va tal como está escrita (con sus fechas); la fecha de la
    // línea solo decide el año y la columna FECHA.
    const lineas = lineasObservacionConFecha(eq.observacion);
    const conteo = new Map();
    for (const l of lineas) conteo.set(l.anio, (conteo.get(l.anio) || 0) + 1);
    const totalLineas = String(eq.observacion || '').split(/\r?\n/).filter((l) => l.trim()).length;
    return {
        id_equipo: eq.id_equipo,
        codigo: eq.codigo,
        nombre: eq.nombre,
        anios: [...conteo.entries()].sort((a, b) => b[0] - a[0]).map(([anio, cantidad]) => ({ anio, cantidad })),
        lineas: lineas.map((l) => ({ anio: l.anio, fecha: fechaNumATexto(l.fecha), texto: l.original })),
        sin_fecha: totalLineas - lineas.length,
    };
};

const historialPdf = async (id, anio) => {
    const a = Number(anio);
    if (!Number.isInteger(a) || a < 1990 || a > 2100) throw error('Indique un año válido');
    const pool = await getConnection();
    const eq = await cargarEquipo(pool, id);
    const lineas = lineasObservacionConFecha(eq.observacion)
        .filter((l) => l.anio === a)
        .map((l) => ({ fecha: fechaNumATexto(l.fecha), texto: l.original }));
    const buffer = await pdfHistorial({ codigo: eq.codigo, nombre: eq.nombre, anio: a, lineas });
    return { buffer, nombre: `OI-FoGe-24 ${nombreArchivo(eq.codigo)} ${a}.pdf` };
};

/**
 * Agrega una observación al equipo desde el Historial por año. Queda como una
 * línea nueva en su observación: "dd.mm.aa texto" (esa fecha decide el año del
 * historial). Se guarda con la actualización normal del equipo, que deja la
 * versión anterior en su historial; no borra nada de lo que había.
 */
const agregarObservacionHistorial = async (id, body = {}, usuario = null) => {
    const pool = await getConnection();
    const eq = await cargarEquipo(pool, id);
    const fecha = ymd(body.fecha);
    if (!fecha) throw error('Indique la fecha de la observación');
    const anio = Number(fecha.slice(0, 4));
    if (anio < 1990 || anio > 2100) throw error('La fecha de la observación no es válida');
    const texto = String(body.texto || '').replace(/\s+/g, ' ').trim();
    if (texto.length < 2) throw error('Escriba la observación');
    if (texto.length > 500) throw error('La observación no puede tener más de 500 caracteres');

    // La línea lleva su propia fecha, como las que se escriben a mano
    // ("15.03.26 Puesta en marcha…"); no se le agrega la marca "- [fecha]".
    const [a, m, d] = fecha.split('-');
    const linea = `${d}.${m}.${a.slice(2)} ${texto}`;
    const actual = String(eq.observacion || '').trim();
    const observacion = actual && actual !== 'No Aplica' ? `${actual}\n${linea}` : linea;
    await equipoService.updateEquipo(eq.id_equipo, { observacion }, usuario?.id || null);
    return historialAnios(eq.id_equipo);
};

// ─── OI-FoGe-22 · Ficha técnica ────────────────────────────────────────────
//
// Los datos del equipo y las frecuencias salen solos; la tabla de
// calibraciones y mantenciones se llena a mano en la pantalla (no se arma con
// el historial ni con las observaciones del equipo). Lo que no se llene sale
// en blanco para completarlo en papel.
//
// Criterios por sigla, según la tabla de Gestión de Calidad (la sigla es lo
// que va antes del punto: "TPA.01/MA.PM" → TPA; "FL-01" → FL). Cada sigla:
//   calibracion: 'anual' | 'trimestral' (no aplica, corresponde verificación
//                trimestral) | 'caudal' (no aplica, verificación trimestral con
//                molinete o proveedor externo) | 'no'
//   mantencion:  'anual' | 'reparacion' (sin frecuencia; se anota cuando el
//                equipo vuelve de reparación) | 'no'
const CRITERIOS_POR_SIGLA = {
    PHP: { equipo: 'Medidor pH portátil', calibracion: 'trimestral', mantencion: 'no' },
    MAU: { equipo: 'Muestreador automático', calibracion: 'no', mantencion: 'anual' },
    MCA: { equipo: 'Sonda caudal', calibracion: 'caudal', mantencion: 'no' },
    PHS: { equipo: 'Sonda pH/temperatura', calibracion: 'trimestral', mantencion: 'no' },
    MCT: { equipo: 'Medidor de cloro total', calibracion: 'no', mantencion: 'no' },
    MCD: { equipo: 'Medidor de cloro total', calibracion: 'no', mantencion: 'no' },
    MCL: { equipo: 'Medidor de cloro / cloro residual', calibracion: 'no', mantencion: 'no' },
    CPA: { equipo: 'Medidor de cloro digital patrón', calibracion: 'no', mantencion: 'no' },
    GPS: { equipo: 'GPS', calibracion: 'no', mantencion: 'no' },
    MOL: { equipo: 'Molinete', calibracion: 'no', mantencion: 'anual' },
    BOC: { equipo: 'Botella oceanográfica', calibracion: 'no', mantencion: 'no' },
    // Multiparámetros y oxígeno: verificación trimestral; mantención solo
    // cuando se envían a reparar (el proveedor la llama mantención o reparación).
    MOD: { equipo: 'Medidor de oxígeno disuelto', calibracion: 'trimestral', mantencion: 'reparacion' },
    SOD: { equipo: 'Sonda oxígeno disuelto', calibracion: 'trimestral', mantencion: 'reparacion' },
    MPH: { equipo: 'Medidor de pH', calibracion: 'trimestral', mantencion: 'no' },
    TMC: { equipo: 'Termocupla', calibracion: 'trimestral', mantencion: 'no' },
    MPA: { equipo: 'Multiparámetro', calibracion: 'trimestral', mantencion: 'reparacion' },
    SON: { equipo: 'Sonda multiparámetro', calibracion: 'trimestral', mantencion: 'reparacion' },
    ULT: { equipo: 'Medidor de flujo ultrasónico', calibracion: 'no', mantencion: 'no' },
    CBA: { equipo: 'Cargador de baterías', calibracion: 'no', mantencion: 'no' },
    DRA: { equipo: 'Draga para sedimentos', calibracion: 'no', mantencion: 'no' },
    TPA: { equipo: 'Termómetro patrón', calibracion: 'anual', mantencion: 'no' },
    STP: { equipo: 'Sonda termómetro patrón', calibracion: 'anual', mantencion: 'no' },
    TML: { equipo: 'Tomador muestra de lodo', calibracion: 'no', mantencion: 'no' },
    MAG: { equipo: 'Medidor de gases', calibracion: 'no', mantencion: 'no' },
    TES: { equipo: 'Tester', calibracion: 'no', mantencion: 'no' },
    DIS: { equipo: 'Disco Secchi', calibracion: 'no', mantencion: 'no' },
    FIL: { equipo: 'Filtro', calibracion: 'no', mantencion: 'no' },
    FL: { equipo: 'Filtro', calibracion: 'no', mantencion: 'no' },
    PED: { equipo: 'Pedestal', calibracion: 'no', mantencion: 'no' },
    CDD: { equipo: 'Cable de descarga de datos', calibracion: 'no', mantencion: 'no' },
    MSU: { equipo: 'Malla Surber', calibracion: 'no', mantencion: 'no' },
    TAM: { equipo: 'Tamiz sedimento', calibracion: 'no', mantencion: 'no' },
    HUI: { equipo: 'Huinche mecánico', calibracion: 'no', mantencion: 'no' },
    REF: { equipo: 'Refrigerador', calibracion: 'no', mantencion: 'no' },
    POZ: { equipo: 'Pozómetro', calibracion: 'no', mantencion: 'no' },
    POW: { equipo: 'Power pack', calibracion: 'no', mantencion: 'no' },
    BAT: { equipo: 'Batería', calibracion: 'no', mantencion: 'no' },
};
// Sigla que no está en la tabla: no aplica en ambas.
const SIN_CRITERIO = { calibracion: 'no', mantencion: 'no' };

const siglaEquipo = (codigo) => String(codigo || '').trim().split(/[./\s-]/)[0].toUpperCase();
const criterioEquipo = (eq) => CRITERIOS_POR_SIGLA[siglaEquipo(eq.codigo)] || SIN_CRITERIO;

/** Servicio anual del equipo: 'calibracion' (TPA, STP), 'mantencion' (MAU, MOL) o null. */
const servicioAnual = (eq) => {
    const c = criterioEquipo(eq);
    if (c.calibracion === 'anual') return 'calibracion';
    if (c.mantencion === 'anual') return 'mantencion';
    return null;
};

const TEXTO_CALIBRACION = {
    anual: 'Anual',
    trimestral: 'No aplica (verificación trimestral)',
    caudal: 'No aplica (verificación trimestral con molinete o proveedor externo)',
    no: 'No aplica',
};
const frecuenciaCalibracionPorDefecto = (eq) => TEXTO_CALIBRACION[criterioEquipo(eq).calibracion] || 'No aplica';

const frecuenciaMantencionPorDefecto = (eq) => (criterioEquipo(eq).mantencion === 'anual' ? 'Anual' : 'No aplica');

/**
 * Tipo de las filas de la tabla: 'calibracion' (TPA, STP), 'mantencion' (MAU,
 * MOL y, al volver de reparación, MPA/SON/MOD/SOD) o null (el equipo no lleva
 * calibraciones ni mantenciones: la tabla sale en blanco).
 */
const tipoRegistro = (eq) => {
    const c = criterioEquipo(eq);
    if (c.calibracion === 'anual') return 'calibracion';
    if (c.mantencion === 'anual' || c.mantencion === 'reparacion') return 'mantencion';
    return null;
};

const datosTecnica = (eq) => ({
    id_equipo: eq.id_equipo,
    nombre: eq.nombre || '',
    marca: eq.marca || '',
    modelo: eq.modelo || '',
    serie: eq.n_serie || '',
    codigo: eq.codigo || '',
    frecuencia_calibracion: frecuenciaCalibracionPorDefecto(eq),
    frecuencia_mantencion: frecuenciaMantencionPorDefecto(eq),
    fecha_adquisicion: ymd(eq.fecha_compra),
    fecha_baja: ymd(eq.fecha_baja),
    observaciones: '',
    autorizacion_uso: eq.nombre_muestreador ? [eq.nombre_muestreador] : [],
    // N° Documento de la ficha del equipo: es el certificado / informe de cada fila (vacío si no tiene).
    // "N/I", "S/N", "-"… es que no lo tiene: queda en blanco.
    n_documento: /^(n\/?i|s\/?n|n\/?a|no informa|sin informaci[oó]n|-+)?$/i.test(String(eq.n_documento_compra || '').trim()) ? '' : String(eq.n_documento_compra).trim(),
    estado: eq.Estado || '',
    // Con servicio anual, la próxima fecha se propone a un año en la pantalla.
    servicio_anual: servicioAnual(eq),
    tipo_registro: tipoRegistro(eq),
});

// Validan la ficha el Jefe Técnico y el Jefe de Terreno de Medio Ambiente
// (Pablo Flores, Mario Jofré): se eligen y firman en el momento.
const CARGOS_VALIDADORES = ['Jefe Técnico Medio Ambiente', 'Jefe Terreno Medio Ambiente'];
const validadoresFicha = async (pool) => {
    const r = await pool.request()
        .input('c1', sql.NVarChar(100), CARGOS_VALIDADORES[0])
        .input('c2', sql.NVarChar(100), CARGOS_VALIDADORES[1])
        .query(`SELECT u.id_usuario, LTRIM(RTRIM(u.usuario)) AS nombre, LTRIM(RTRIM(k.nombre_cargo)) AS cargo
                FROM mae_usuario u JOIN mae_cargo k ON k.id_cargo = u.id_cargo
                WHERE u.habilitado = 'S' AND LTRIM(RTRIM(k.nombre_cargo)) IN (@c1, @c2)
                ORDER BY k.nombre_cargo, u.usuario`);
    return r.recordset.map((v) => ({ id_usuario: Number(v.id_usuario), nombre: v.nombre, cargo: v.cargo }));
};

// Firmas que se pueden poner en la ficha técnica: la de quien la llena (realiza)
// y las del Jefe Técnico y el Jefe de Terreno de Medio Ambiente (validan, ej.
// Pablo Flores y Mario Jofré). Se marcan las que van; cada una usa su firma
// guardada (mae_firma_digital) o se dibuja en el momento.
const firmantesTecnica = async (pool, usuario, { conImagen = false } = {}) => {
    const lista = [];
    const idUsuario = Number(usuario?.id) || null;
    const validadores = await validadoresFicha(pool);
    if (idUsuario && !validadores.some((v) => v.id_usuario === idUsuario)) {
        const d = await firmaDigitalService.datos('USUARIO', idUsuario).catch(() => ({}));
        lista.push({ id_usuario: idUsuario, nombre: usuario?.name || d.nombre || '', cargo: d.cargo || null, rol: 'REALIZA' });
    }
    for (const v of validadores) lista.push({ ...v, rol: v.id_usuario === idUsuario ? 'REALIZA' : 'VALIDA' });
    if (conImagen) {
        for (const p of lista) p.firma_guardada = await firmaDigitalService.obtener('USUARIO', p.id_usuario);
    }
    return lista;
};

// Firmas marcadas al llenar: [{ id_usuario, usar_guardada, imagen }] →
// [{ ...firmante, img, id_firma, modo }] en el orden de la lista. Solo se
// aceptan los firmantes de la lista.
const firmasElegidas = async (pool, body, usuario) => {
    const pedidas = Array.isArray(body.firmas_ficha) ? body.firmas_ficha.slice(0, 4) : [];
    if (!pedidas.length) return [];
    const lista = await firmantesTecnica(pool, usuario);
    const salida = [];
    for (const p of lista) {
        const f = pedidas.find((x) => Number(x?.id_usuario) === p.id_usuario);
        if (!f) continue;
        let img = null; let idFirma = null; let modo = 'EN_EL_MOMENTO';
        if (f.usar_guardada) {
            const g = await firmaDigitalService.vigente('USUARIO', p.id_usuario);
            if (g) { img = g.imagen; idFirma = g.id_firma; modo = 'GUARDADA'; }
        }
        if (!img) img = imagenFirma(f.imagen);
        if (img) salida.push({ ...p, img, id_firma: idFirma, modo });
    }
    if (pedidas.some((x) => !lista.some((p) => p.id_usuario === Number(x?.id_usuario)))) {
        throw error('Solo se pueden poner las firmas de quien llena la ficha, el Jefe Técnico o el Jefe de Terreno');
    }
    return salida;
};

const fichaTecnicaDatos = async (id, usuario = null) => {
    const pool = await getConnection();
    const eq = await cargarEquipo(pool, id);
    return { ...datosTecnica(eq), firmantes_ficha: await firmantesTecnica(pool, usuario, { conImagen: true }) };
};

const CAMPOS_TECNICA = ['nombre', 'marca', 'modelo', 'serie', 'codigo', 'frecuencia_calibracion', 'frecuencia_mantencion', 'fecha_adquisicion', 'fecha_baja', 'observaciones'];
const MAX_REGISTROS = 60;

// Filas escritas a mano: { tipo: 'calibracion'|'mantencion', fecha, institucion,
// certificado, proxima, observaciones, firmar }. Las vacías no se imprimen. Con
// `firmar`, la columna FIRMA lleva las dos firmas: arriba quien realiza (su firma
// guardada en el perfil, o la que dibujó al llenar) y abajo quien valida.
// El tipo no lo elige quien llena: sale del equipo (`tipo`). Equipos sin
// calibración ni mantención no llevan filas.
const imagenFirma = (f) => (/^data:image\/(png|jpeg);base64,/.test(String(f || '')) && String(f).length <= 900_000 ? String(f) : null);
// Cualquier equipo puede llevar filas (calibración y mantención juntas).
const registrosManuales = (lista, tipo, firmas = []) => (Array.isArray(lista) ? lista : [])
    .slice(0, MAX_REGISTROS)
    .map((r) => {
        const t = (v, max) => String(v ?? '').trim().slice(0, max);
        // La fila trae calibración y mantención juntas (como las columnas del
        // formato). Formato anterior { fecha, proxima }: va al tipo del equipo.
        const juntas = r && ('fecha_calibracion' in r || 'fecha_mantencion' in r);
        const cal = tipo === 'calibracion';
        return {
            fecha_calibracion: juntas ? ymd(r.fecha_calibracion) : (cal ? ymd(r?.fecha) : null),
            fecha_mantencion: juntas ? ymd(r.fecha_mantencion) : (cal ? null : ymd(r?.fecha)),
            institucion: t(r?.institucion, 150),
            certificado: t(r?.certificado, 100),
            proxima_calibracion: juntas ? ymd(r.proxima_calibracion) : (cal ? ymd(r?.proxima) : null),
            proxima_mantencion: juntas ? ymd(r.proxima_mantencion) : (cal ? null : ymd(r?.proxima)),
            observaciones: t(r?.observaciones, 500),
            // Celda FIRMA: las firmas elegidas, en orden (quien realiza y quienes validan).
            firmas_celda: r?.firmar ? firmas.map((f) => ({ img: f.img, nombre: f.nombre })) : [],
        };
    })
    .filter((r) => r.fecha_calibracion || r.fecha_mantencion || r.institucion || r.certificado || r.proxima_calibracion || r.proxima_mantencion || r.observaciones);

const fichaTecnicaPdf = async (id, body = {}, usuario = null) => {
    const pool = await getConnection();
    const eq = await cargarEquipo(pool, id);
    const d = datosTecnica(eq);
    for (const c of CAMPOS_TECNICA) {
        if (body[c] !== undefined && body[c] !== null) d[c] = String(body[c]).slice(0, 500);
    }
    if (Array.isArray(body.autorizacion_uso)) d.autorizacion_uso = body.autorizacion_uso.map((s) => String(s).slice(0, 200)).filter((s) => s.trim()).slice(0, 15);
    // Firmas marcadas (quien llena, Pablo Flores, Mario Jofré): guardadas o dibujadas.
    const quiereFirma = Array.isArray(body.registros) && body.registros.some((r) => r?.firmar);
    const firmas = quiereFirma ? await firmasElegidas(pool, body, usuario) : [];
    d.registros = registrosManuales(body.registros, d.tipo_registro, firmas);
    const buffer = await pdfFichaTecnica(d);
    return { buffer, nombre: `OI-FoGe-22 ${nombreArchivo(eq.codigo)}.pdf` };
};

// ─── OI-FoGe-36 · Ficha de entrega ─────────────────────────────────────────

const CAMPOS_ENTREGA = ['nombre', 'marca', 'modelo', 'serie', 'codigo', 'proveedor', 'n_factura', 'fecha_factura', 'valor',
    'frecuencia_mantencion', 'fecha_adquisicion', 'area', 'seccion', 'responsable_equipo', 'fecha_recepcion',
    'observaciones', 'responsable_entrega', 'responsable_area', 'fecha_entrega', 'fecha_area'];

// Sirve para un equipo guardado y para uno que se está creando: todo viene en el cuerpo.
// Firmas (imagen en data URL, opcionales): quien recibe (`firma_equipo`), quien
// entrega (`firma_entrega`, o su firma guardada del perfil con
// `usar_mi_firma_entrega`) y el responsable de área (`firma_area`).
const entregaPdf = async (body = {}, usuario = null) => {
    const d = {};
    for (const c of CAMPOS_ENTREGA) d[c] = body[c] === undefined || body[c] === null ? '' : String(body[c]).slice(0, c === 'observaciones' ? 2000 : 300);
    if (!d.codigo.trim() && !d.nombre.trim()) throw error('Indique al menos el nombre o el código del equipo');
    d.firma_equipo = imagenFirma(body.firma_equipo);
    d.firma_area = imagenFirma(body.firma_area);
    d.firma_entrega = body.usar_mi_firma_entrega && usuario?.id
        ? await firmaDigitalService.obtener('USUARIO', usuario.id)
        : imagenFirma(body.firma_entrega);
    const buffer = await pdfEntrega(d);
    return { buffer, nombre: `OI-FoGe-36 ${nombreArchivo(d.codigo || d.nombre)}.pdf` };
};

// ─── OI-FoGe-42 · Recepción, puesta en marcha y verificación ───────────────

const CAMPOS_RECEPCION = ['nombre', 'codigo', 'marca', 'modelo', 'serie', 'fecha', 'otros', 'estado_recepcion',
    'funcionamiento', 'patron_referencia', 'observaciones', 'firma_recepcion', 'firma_calidad'];
const LARGOS = { observaciones: 1500, estado_recepcion: 600, funcionamiento: 400, patron_referencia: 400, otros: 300 };

// Autocompletado: cada recepción / puesta en marcha que quedó anotada en la
// observación del equipo es un "evento" que se puede elegir. De su línea salen
// la fecha, qué se hizo, quién lo hizo (si nombra a un muestreador) y si hubo
// verificación; la verificación de T° firmada de esos días (OI-FoGe-39) aporta
// el resultado, el patrón y el firmante. Lo físico (caja, embalaje, contenido)
// no está en ningún registro y queda para marcar.
const RE_RECEPCION = /recepci|ingreso a inventario|se recibe|recibido/;
const RE_PUESTA = /puesta en marc|puesta realizada/;
const RE_VERIFICACION = /verif|contrast|calibra/;
const RE_FALLA = /no enciende|falla|no funciona|no cumple|defect|dano|danad/;
const RE_CONFORME = /\bcumple|\bconforme|sin desviaci|\bhabilitado|\boperativo|sin problema/;
const NO_PERSONAS = /^(cliente|por asignar|sin supervision|base |sede |prueba)/;
const DIAS_CERCA = 7;

const diasEntre = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

const cumpleTexto = (c) => (c === 'S' ? 'cumple' : c === 'N' ? 'no cumple' : '');
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const resultadoVerificacion = (v) => {
    const errores = [[0, v.error0], [15, v.error15], [30, v.error30]].filter(([, e]) => num(e) !== null && !Number.isNaN(num(e)));
    const detalle = errores.length ? ` (error ${errores.map(([t, e]) => `${t} °C: ${num(e).toFixed(1)}`).join(' · ')})` : '';
    const c = cumpleTexto(v.cumple);
    return `Verificación intermedia de T° N° ${v.id_verificacion}${c ? `: ${c}` : ''}${detalle}`;
};

const recepcionDatos = async (id) => {
    const pool = await getConnection();
    const eq = await cargarEquipo(pool, id);

    const [vt, muestreadores, patron] = await Promise.all([
        pool.request().input('id', sql.Int, eq.id_equipo).query(`
            IF OBJECT_ID('mae_verificacion_temperatura') IS NOT NULL
                SELECT v.id_verificacion, v.fecha_verificacion, v.cumple, v.error0, v.error15, v.error30,
                       v.patron_codigo, v.patron_nombre, m.nombre_muestreador
                FROM mae_verificacion_temperatura v
                LEFT JOIN mae_muestreador m ON m.id_muestreador = v.id_muestreador
                WHERE v.id_equipo = @id AND v.estado = 'FIRMADA'`),
        pool.request().query('SELECT DISTINCT nombre_muestreador FROM mae_muestreador WHERE nombre_muestreador IS NOT NULL'),
        // Termómetros patrón (mismo criterio que la Verificación de T°).
        pool.request().query(`
            SELECT codigo, nombre, sede FROM mae_equipo
            WHERE tipoequipo = 'Termometro patrón' AND codigo LIKE 'TPA%' AND habilitado = 'S'
            ORDER BY codigo`),
    ]);

    const personas = (muestreadores.recordset || [])
        .map((m) => String(m.nombre_muestreador).trim())
        .filter((n) => n.includes(' ') && !NO_PERSONAS.test(sinTildes(n)));
    // Quien hizo la recepción; no la persona a la que se le asigna el equipo.
    const personaEn = (texto) => {
        const t = sinTildes(texto);
        return personas.find((p) => {
            const i = t.indexOf(sinTildes(p));
            return i >= 0 && !/asignad[oa]\s+(a\s+)?$/.test(t.slice(Math.max(0, i - 14), i));
        }) || '';
    };
    // Patrón de la sede donde se hizo la verificación (si la línea lo dice), si
    // no el de la sede del equipo; sin patrón propio (ej. Punta Arenas) el de Puerto Montt.
    const patrones = patron.recordset || [];
    const patronDe = (sede) => patrones.find((p) => p.sede === sede) || patrones.find((p) => p.sede === 'PM') || patrones[0] || null;
    const sedeEnTexto = (t) => {
        if (/\bpm\b|puerto montt/.test(t)) return 'PM';
        if (/\bay\b|aysen|coyhaique/.test(t)) return 'AY';
        if (/\bvi\b|villarrica/.test(t)) return 'VI';
        if (/\bpa\b|punta arenas/.test(t)) return 'PA';
        return null;
    };

    const fichas = (vt.recordset || []).map((v) => ({ ...v, fecha: ymd(v.fecha_verificacion) })).filter((v) => v.fecha);
    const fichaCerca = (fecha) => fichas
        .filter((v) => diasEntre(v.fecha, fecha) <= DIAS_CERCA)
        .sort((a, b) => diasEntre(a.fecha, fecha) - diasEntre(b.fecha, fecha))[0] || null;
    const textoPatron = (p) => [p?.codigo || p?.patron_codigo, p?.nombre || p?.patron_nombre].filter(Boolean).join(' – ');

    const usadas = new Set();
    const eventos = [];
    for (const l of lineasObservacionConFecha(eq.observacion, { quitarFechaFinal: true })) {
        const t = sinTildes(l.texto);
        const esRecepcion = RE_RECEPCION.test(t);
        const esPuesta = RE_PUESTA.test(t);
        if ((!esRecepcion && !esPuesta) || /pendiente/.test(t)) continue;
        const fecha = numAYmd(l.fecha);
        const ficha = fichaCerca(fecha);
        if (ficha) usadas.add(ficha.id_verificacion);
        const conVerificacion = RE_VERIFICACION.test(t) || !!ficha;
        let funcionamiento = '';
        let patronRef = '';
        if (ficha) {
            funcionamiento = resultadoVerificacion(ficha);
            patronRef = textoPatron(ficha);
        } else {
            const deTemperatura = /t\s*°|temperatura/.test(t);
            const conforme = !RE_FALLA.test(t) && RE_CONFORME.test(t);
            if (conVerificacion) {
                funcionamiento = `${deTemperatura ? 'Verificación de T° realizada' : 'Verificación realizada'}${conforme ? ', conforme' : ''}`;
                // La verificación de T° se hace con el termómetro patrón de la sede.
                if (deTemperatura) patronRef = textoPatron(patronDe(sedeEnTexto(t) || eq.sede));
            } else if (conforme) {
                funcionamiento = 'Conforme';
            }
        }
        eventos.push({
            id: `obs-${l.orden}`,
            fecha,
            texto: l.texto,
            origen: 'Observación del equipo',
            recepcion: esRecepcion || /recepcionar/.test(t),
            puesta_marcha: esPuesta,
            verificacion: conVerificacion,
            falla: RE_FALLA.test(t) || ficha?.cumple === 'N',
            firmante: personaEn(l.texto) || ficha?.nombre_muestreador || '',
            funcionamiento,
            patron_referencia: patronRef,
        });
    }
    // Verificaciones de T° firmadas que no tienen línea de recepción en la observación.
    for (const f of fichas) {
        if (usadas.has(f.id_verificacion)) continue;
        eventos.push({
            id: `vt-${f.id_verificacion}`,
            fecha: f.fecha,
            texto: resultadoVerificacion(f),
            origen: 'Verificación de T° (OI-FoGe-39)',
            recepcion: false,
            puesta_marcha: false,
            verificacion: true,
            falla: f.cumple === 'N',
            firmante: f.nombre_muestreador || '',
            funcionamiento: resultadoVerificacion(f),
            patron_referencia: textoPatron(f),
        });
    }
    eventos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

    return {
        id_equipo: eq.id_equipo,
        nombre: eq.nombre || '',
        codigo: eq.codigo || '',
        marca: eq.marca || '',
        modelo: eq.modelo || '',
        serie: eq.n_serie || '',
        eventos,
    };
};

// Como la entrega, sirve también para un equipo que se está creando: todo viene en el cuerpo.
// Firmas (opcionales): Recepción Área Técnica (`imagen_firma_recepcion`, o la
// firma guardada del usuario con `usar_mi_firma_recepcion`) y Área Gestión de
// Calidad (`imagen_firma_calidad`). El nombre de cada una va en firma_recepcion /
// firma_calidad, sobre la línea.
const recepcionPdf = async (body = {}, usuario = null) => {
    const d = {};
    for (const c of CAMPOS_RECEPCION) d[c] = body[c] === undefined || body[c] === null ? '' : String(body[c]).slice(0, LARGOS[c] || 200);
    for (const c of ['recepcion', 'puesta_marcha', 'verificacion']) d[c] = body[c] === true || body[c] === 'true';
    // Solo se acepta una de las opciones del formato; cualquier otra cosa queda sin marcar.
    for (const [c, opciones] of Object.entries(ITEMS_RECEPCION)) d[c] = opciones.includes(body[c]) ? body[c] : '';
    if (!d.codigo.trim() && !d.nombre.trim()) throw error('Indique al menos el nombre o el código del equipo');
    d.imagen_firma_recepcion = body.usar_mi_firma_recepcion && usuario?.id
        ? await firmaDigitalService.obtener('USUARIO', usuario.id)
        : imagenFirma(body.imagen_firma_recepcion);
    d.imagen_firma_calidad = imagenFirma(body.imagen_firma_calidad);
    const buffer = await pdfRecepcion(d);
    return { buffer, nombre: `OI-FoGe-42 ${nombreArchivo(d.codigo || d.nombre)}.pdf` };
};

/**
 * Quién firma el documento que se guarda (mae_gc_documento_firma), con las
 * mismas reglas que el PDF: firma guardada del perfil (GUARDADA, con la versión
 * usada) o dibujada al llenar (EN_EL_MOMENTO).
 * → [{ rol, tipo_firmante, id_firmante, nombre_firmante, cargo, modo, id_firma }]
 */
const firmasDocumento = async (tipo, body = {}, usuario = null) => {
    const firmas = [];
    const idUsuario = Number(usuario?.id) || null;
    const cargoDe = async (id) => (id ? (await firmaDigitalService.datos('USUARIO', id))?.cargo || null : null);
    const guardadaDe = async (id) => (id ? firmaDigitalService.vigente('USUARIO', id) : null);
    const enElMomento = (rol, nombre, extra = {}) => ({
        rol, tipo_firmante: null, id_firmante: null, nombre_firmante: String(nombre || '').trim() || null, cargo: null, modo: 'EN_EL_MOMENTO', id_firma: null, ...extra,
    });

    if (tipo === 'tecnica') {
        if (!(Array.isArray(body.registros) && body.registros.some((r) => r?.firmar))) return firmas;
        for (const f of await firmasElegidas(await getConnection(), body, usuario)) {
            firmas.push({ rol: f.rol, tipo_firmante: 'USUARIO', id_firmante: f.id_usuario, nombre_firmante: f.nombre, cargo: f.cargo, modo: f.modo, id_firma: f.id_firma });
        }
    }

    if (tipo === 'recepcion') {
        // Recepción Área Técnica Medio Ambiente = quien realiza; Área Gestión de Calidad = quien valida.
        const g = body.usar_mi_firma_recepcion ? await guardadaDe(idUsuario) : null;
        if (g) {
            firmas.push({ rol: 'REALIZA', tipo_firmante: 'USUARIO', id_firmante: idUsuario, nombre_firmante: String(body.firma_recepcion || usuario?.name || '').trim() || null, cargo: g.cargo || await cargoDe(idUsuario), modo: 'GUARDADA', id_firma: g.id_firma });
        } else if (imagenFirma(body.imagen_firma_recepcion)) {
            const esUsuario = idUsuario && String(body.firma_recepcion || '').trim().toLowerCase() === String(usuario?.name || '').trim().toLowerCase();
            firmas.push(enElMomento('REALIZA', body.firma_recepcion, esUsuario ? { tipo_firmante: 'USUARIO', id_firmante: idUsuario, cargo: await cargoDe(idUsuario) } : {}));
        }
        if (imagenFirma(body.imagen_firma_calidad)) firmas.push(enElMomento('VALIDA', body.firma_calidad));
    }

    if (tipo === 'entrega') {
        if (imagenFirma(body.firma_equipo)) firmas.push(enElMomento('RECIBE', body.responsable_equipo));
        const g = body.usar_mi_firma_entrega ? await guardadaDe(idUsuario) : null;
        if (g) {
            firmas.push({ rol: 'ENTREGA', tipo_firmante: 'USUARIO', id_firmante: idUsuario, nombre_firmante: String(body.responsable_entrega || usuario?.name || '').trim() || null, cargo: g.cargo || await cargoDe(idUsuario), modo: 'GUARDADA', id_firma: g.id_firma });
        } else if (imagenFirma(body.firma_entrega)) {
            // Si quien entrega es el usuario conectado, queda identificado.
            const esUsuario = idUsuario && String(body.responsable_entrega || '').trim().toLowerCase() === String(usuario?.name || '').trim().toLowerCase();
            firmas.push(enElMomento('ENTREGA', body.responsable_entrega, esUsuario ? { tipo_firmante: 'USUARIO', id_firmante: idUsuario, cargo: await cargoDe(idUsuario) } : {}));
        }
        if (imagenFirma(body.firma_area)) firmas.push(enElMomento('RESPONSABLE_AREA', body.responsable_area));
    }
    return firmas;
};

/** Código y nombre del equipo, para guardar sus fichas. */
const equipoBasico = async (id) => {
    const pool = await getConnection();
    const eq = await cargarEquipo(pool, id);
    return { id_equipo: Number(eq.id_equipo), codigo: eq.codigo || '', nombre: eq.nombre || '', sede: eq.sede || '' };
};

export default { historialAnios, historialPdf, agregarObservacionHistorial, fichaTecnicaDatos, fichaTecnicaPdf, entregaPdf, recepcionDatos, recepcionPdf, equipoBasico, firmasDocumento };
