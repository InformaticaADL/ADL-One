// =============================================================================
// Quejas y apelaciones — Gestión de Calidad (NCh-ISO/IEC 17025:2017 cl. 7.9).
//
// Administración desde ADL-One (G. Calidad → Calidad) sobre las MISMAS tablas
// que usa ADLWeb (base ADLWeb): dbo.quejas_apelaciones, _notificaciones,
// _adjuntos y dbo.qa_acciones_correctivas. Los casos se pueden administrar desde
// las dos aplicaciones; por eso este servicio replica las reglas de ADLWeb
// (api-backend-adlclone/quality-complaints.js, parte del panel): si se cambia
// una regla en un lado, hay que cambiarla en el otro.
//
// El formulario público (/quejas-apelaciones) y el seguimiento con N° + código
// siguen en ADLWeb.
//
// Correos al cliente: ADL-One no los envía. Los deja en la cola de ADLWeb
// (quejasApelaciones.cola.js) y ADLWeb los envía —con el código de acceso en el
// acuse— y registra la notificación en el caso cuando salen.
//
// Etapas: 1. Registro · 2. Evaluación · 3. Tratamiento · 4. Estadística.
// =============================================================================
import sql from 'mssql';
import { getConnectionAdlWeb } from '../config/databaseAdlWeb.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import { buildQualityFormOdt, buildCorrectiveActionOdt } from './quejasApelaciones.odt.js';
import { getSystemConfig, getLegalInfo, encolarCorreo } from './quejasApelaciones.cola.js';

const fallo = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

// ── Catálogos (iguales a ADLWeb) ─────────────────────────────────────────────
// El procedimiento de quejas y apelaciones aplica solo al área de Medioambiente.
const AREA = 'medioambiente';
const AREA_LABEL = { acuicola: 'Salud acuícola', medioambiente: 'Medioambiente', proteccion_datos: 'Protección de datos', otro: 'Otro' };
export const TIPOS = { queja: 'Queja', apelacion: 'Apelación' };
export const ORIGENES = { externo: 'Externo', interno: 'Interno' };
const CANALES = { web: 'Formulario web', panel: 'Registro en el panel' };
const EMISORES = { cliente: 'Cliente', fiscalizador: 'Organismo fiscalizador', otro: 'Otro' };
const AC_ESTADOS = { abierta: 'Abierta', cerrada: 'Cerrada', anulada: 'Anulada' };
const ADJ_TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const ESTADOS = {
    registrada: 'Registrada',
    en_evaluacion: 'En evaluación',
    en_tratamiento: 'En tratamiento',
    cerrada: 'Cerrada',
    no_procede: 'No procede (cerrada)',
};
const CERRADOS = ['cerrada', 'no_procede'];
const ETAPAS = { inicio: 'Inicio de proceso', avance: 'Avance de proceso', finalizacion: 'Finalización de proceso' };
const REAPERTURAS = { reasignacion: 'Responsable reasignado', anulacion: 'Decisión anulada' };

// ── Validación de texto (mismas reglas que legal-compliance.js de ADLWeb) ────
const LETTERS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const clip = (value, max) => (value === undefined || value === null) ? '' : String(value).replace(/[<>]/g, '').trim().slice(0, max);
const isValidEmail = (email) => typeof email === 'string' && email.length <= 254
    && /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(email.trim());
const isValidName = (v) => typeof v === 'string'
    && new RegExp(`^[${LETTERS}]+( [${LETTERS}]+)*$`).test(v.trim()) && v.replace(/ /g, '').length >= 2 && v.length <= 100;
const isValidCompany = (v) => !v || (typeof v === 'string' && new RegExp(`^[${LETTERS} .&-]+$`).test(v.trim())
    && new RegExp(`[${LETTERS}]{2,}`).test(v) && v.length <= 120);
const isValidPhone = (v) => !v || /^\+\d{8,15}$/.test(String(v));
const isValidReference = (v) => !v || /^[A-Za-z0-9\-./ ]{1,50}$/.test(String(v));
const toBool = (v) => (v === true || v === 'true' || v === 1 || v === '1' ? true : v === false || v === 'false' || v === 0 || v === '0' ? false : null);

// ── Fechas (hora de Chile) ───────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const isValidDate = (v) => DATE_RE.test(String(v || '')) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());
function nowChile() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const g = (t) => (parts.find((p) => p.type === t) || {}).value || '00';
    return { fecha: `${g('year')}-${g('month')}-${g('day')}`, hora: `${g('hour')}:${g('minute')}` };
}
// La conexión usa useUTC: false: las columnas DATE se leen como medianoche LOCAL;
// por eso se leen con los componentes locales y se escriben con dbDate().
const pad2 = (n) => String(n).padStart(2, '0');
const isFuture = (v) => Boolean(v) && String(v) > nowChile().fecha;
const isoDate = (d) => (d instanceof Date
    ? (Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`)
    : d ? String(d).slice(0, 10) : null);
const dbDate = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : v;
};
function addBusinessDays(isoDay, days) {
    const d = new Date(`${isoDay}T12:00:00Z`);
    let added = 0;
    while (added < days) {
        d.setUTCDate(d.getUTCDate() + 1);
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) added += 1;
    }
    return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((new Date(`${isoDate(b)}T12:00:00Z`) - new Date(`${isoDate(a)}T12:00:00Z`)) / 86400000);
const fmtDay = (iso) => (iso ? new Date(`${isoDate(iso)}T12:00:00Z`).toLocaleDateString('es-CL', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }) : '');

// ── Vistas ───────────────────────────────────────────────────────────────────
function parseHistorial(raw) {
    try { const v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v : []; } catch { return []; }
}
const bool = (v) => (v === null || v === undefined ? null : Boolean(v));

function view(c) {
    const hoy = nowChile().fecha;
    const { codigo_acceso_hash: hash, ...rest } = c; // el hash nunca sale del servidor
    return {
        ...rest,
        evaluacion_historial: parseHistorial(c.evaluacion_historial).map((h) => ({ ...h, tipoLabel: REAPERTURAS[h.tipo] || h.tipo })),
        tiene_codigo_acceso: Boolean(hash),
        fecha_recepcion: isoDate(c.fecha_recepcion),
        fecha_tratamiento: isoDate(c.fecha_tratamiento),
        fecha_evaluacion: isoDate(c.fecha_evaluacion),
        reunion_fecha: isoDate(c.reunion_fecha),
        plazo_vence: isoDate(c.plazo_vence),
        emisorLabel: c.emisor ? EMISORES[c.emisor] || c.emisor : null,
        relacionada_actividades: bool(c.relacionada_actividades),
        procede: bool(c.procede),
        responsable_independiente: bool(c.responsable_independiente),
        requiere_tnc: bool(c.requiere_tnc),
        requiere_auditoria: bool(c.requiere_auditoria),
        tipoLabel: TIPOS[c.tipo] || c.tipo,
        origenLabel: ORIGENES[c.origen] || c.origen,
        canalLabel: CANALES[c.canal] || c.canal,
        areaLabel: c.area ? AREA_LABEL[c.area] || c.area : null,
        estadoLabel: ESTADOS[c.estado] || c.estado,
        cerrado: CERRADOS.includes(c.estado),
        vencida: !CERRADOS.includes(c.estado) && Boolean(c.plazo_vence) && isoDate(c.plazo_vence) < hoy,
    };
}

function acView(a) {
    let seguimientos = [];
    try { seguimientos = a.seguimientos ? JSON.parse(a.seguimientos) : []; } catch { seguimientos = []; }
    return {
        ...a,
        fecha_deteccion: isoDate(a.fecha_deteccion), fecha_inicio: isoDate(a.fecha_inicio), plazo: isoDate(a.plazo),
        fecha_seguimiento: isoDate(a.fecha_seguimiento), cierre_fecha: isoDate(a.cierre_fecha),
        procede_ac: bool(a.procede_ac), cumplimiento_plazo: bool(a.cumplimiento_plazo), causa_eliminada: bool(a.causa_eliminada), se_levanta_nc: bool(a.se_levanta_nc),
        seguimientos, estadoLabel: AC_ESTADOS[a.estado] || a.estado,
    };
}

// ── Lectura de campos ────────────────────────────────────────────────────────
// parcial=true → solo valida los campos enviados (edición).
function readRegistro(body, { parcial = false } = {}) {
    const has = (k) => !parcial || Object.prototype.hasOwnProperty.call(body, k);
    const out = {};
    const errors = [];
    if (has('tipo')) { out.tipo = clip(body.tipo, 20); if (!TIPOS[out.tipo]) errors.push('Selecciona si es una queja o una apelación.'); }
    if (has('origen')) { out.origen = clip(body.origen, 20); if (!ORIGENES[out.origen]) errors.push('Selecciona si es interna o externa.'); }
    if (has('empresa')) {
        out.empresa = clip(body.empresa, 120);
        if (!out.empresa || !isValidCompany(out.empresa)) errors.push('Indica la empresa (solo letras; se permiten ".", "-" y "&").');
    }
    if (has('nombre')) { out.nombre = clip(body.nombre, 200); if (!isValidName(out.nombre)) errors.push('Indica el nombre (solo letras y espacios).'); }
    if (has('correo')) { out.correo = clip(body.correo, 255).toLowerCase(); if (!isValidEmail(out.correo)) errors.push('Ingresa un mail de contacto válido.'); }
    if (has('telefono')) {
        out.telefono = clip(body.telefono, 16);
        if (!out.telefono || !isValidPhone(out.telefono)) errors.push('Indica el fono de contacto: "+" seguido del código de país y el número.');
    }
    if (has('numeroInforme')) {
        out.numeroInforme = clip(body.numeroInforme, 50);
        if (!isValidReference(out.numeroInforme)) errors.push('El N° de informe solo puede tener letras, números, "-", "." y "/".');
    }
    if (has('fechaRecepcion')) {
        out.fechaRecepcion = clip(body.fechaRecepcion, 10);
        if (!isValidDate(out.fechaRecepcion)) errors.push('Indica la fecha de recepción.');
        else if (isFuture(out.fechaRecepcion)) errors.push('La fecha de recepción no puede ser posterior a hoy.');
    }
    if (has('horaRecepcion')) { out.horaRecepcion = clip(body.horaRecepcion, 5); if (!TIME_RE.test(out.horaRecepcion)) errors.push('Indica la hora de recepción (HH:MM).'); }
    if (has('fechaTratamiento')) {
        out.fechaTratamiento = clip(body.fechaTratamiento, 10);
        if (out.fechaTratamiento && !isValidDate(out.fechaTratamiento)) errors.push('La fecha de tratamiento no es válida.');
        else if (isFuture(out.fechaTratamiento)) errors.push('La fecha de tratamiento no puede ser posterior a hoy.');
    }
    if (has('emisor')) { out.emisor = clip(body.emisor, 30); if (!EMISORES[out.emisor]) errors.push('Indica quién presenta: cliente, organismo fiscalizador u otro.'); }
    if (has('viaIngreso')) out.viaIngreso = clip(body.viaIngreso, 50);
    if (has('motivo')) {
        out.motivo = clip(body.motivo, 5000);
        if (out.motivo.length < 10) errors.push('Describe el motivo de la queja o apelación (al menos 10 caracteres).');
    }
    return { data: out, error: errors[0] || null };
}

const REGISTRO_COLS = {
    tipo: ['tipo', sql.NVarChar(20)], origen: ['origen', sql.NVarChar(20)],
    empresa: ['empresa', sql.NVarChar(200)], nombre: ['nombre', sql.NVarChar(200)], correo: ['correo', sql.NVarChar(255)],
    telefono: ['telefono', sql.NVarChar(50)], numeroInforme: ['numero_informe', sql.NVarChar(100)],
    fechaRecepcion: ['fecha_recepcion', sql.Date], horaRecepcion: ['hora_recepcion', sql.NVarChar(5)],
    fechaTratamiento: ['fecha_tratamiento', sql.Date], motivo: ['motivo', sql.NVarChar(sql.MAX)],
    emisor: ['emisor', sql.NVarChar(30)], viaIngreso: ['via_ingreso', sql.NVarChar(50)],
};
const EVALUACION_COLS = {
    relacionada: ['relacionada_actividades', sql.Bit], procede: ['procede', sql.Bit], evaluacion: ['evaluacion', sql.NVarChar(sql.MAX)],
    responsable: ['responsable', sql.NVarChar(200)], responsableIndependiente: ['responsable_independiente', sql.Bit],
    requiereTnc: ['requiere_tnc', sql.Bit], requiereAuditoria: ['requiere_auditoria', sql.Bit], fechaEvaluacion: ['fecha_evaluacion', sql.Date],
    respuestaFormal: ['respuesta_formal', sql.NVarChar(sql.MAX)],
    causa: ['causa', sql.NVarChar(120)], requisito: ['requisito', sql.NVarChar(500)], jefeArea: ['jefe_area', sql.NVarChar(200)],
    reunionFecha: ['reunion_fecha', sql.Date], reunionAsistentes: ['reunion_asistentes', sql.NVarChar(sql.MAX)],
    reunionDirectrices: ['reunion_directrices', sql.NVarChar(sql.MAX)],
};
const TRATAMIENTO_COLS = {
    fechaTratamiento: ['fecha_tratamiento', sql.Date], analisisCausa: ['analisis_causa', sql.NVarChar(sql.MAX)],
    accionesCorrectivas: ['acciones_correctivas', sql.NVarChar(sql.MAX)], accionesPreventivas: ['acciones_preventivas', sql.NVarChar(sql.MAX)],
    tratamiento: ['tratamiento', sql.NVarChar(sql.MAX)], conclusiones: ['conclusiones', sql.NVarChar(sql.MAX)],
    participantes: ['participantes', sql.NVarChar(sql.MAX)], aprobadoPor: ['aprobado_por', sql.NVarChar(200)],
    respuestaFormal: ['respuesta_formal', sql.NVarChar(sql.MAX)], eficacia: ['eficacia', sql.NVarChar(sql.MAX)],
};
const AC_COLS = {
    area: ['area', sql.NVarChar(200)], fechaDeteccion: ['fecha_deteccion', sql.Date], fechaInicio: ['fecha_inicio', sql.Date],
    detectadoPor: ['detectado_por', sql.NVarChar(300)], requisito: ['requisito', sql.NVarChar(500)],
    hallazgo: ['hallazgo', sql.NVarChar(sql.MAX)], justificacion: ['justificacion', sql.NVarChar(sql.MAX)],
    correccion: ['correccion_inmediata', sql.NVarChar(sql.MAX)], procedeAc: ['procede_ac', sql.Bit],
    participantes: ['participantes', sql.NVarChar(sql.MAX)], tecnica: ['tecnica', sql.NVarChar(300)], alcance: ['alcance', sql.NVarChar(sql.MAX)],
    accion: ['accion_propuesta', sql.NVarChar(sql.MAX)], responsable: ['responsable', sql.NVarChar(200)], plazo: ['plazo', sql.Date],
    fechaSeguimiento: ['fecha_seguimiento', sql.Date], cumplimientoPlazo: ['cumplimiento_plazo', sql.Bit],
    observaciones: ['observaciones', sql.NVarChar(sql.MAX)], seguimientos: ['seguimientos', sql.NVarChar(sql.MAX)],
    eficacia: ['eficacia', sql.NVarChar(sql.MAX)], causaEliminada: ['causa_eliminada', sql.Bit], seLevantaNc: ['se_levanta_nc', sql.Bit],
    observacionesFinales: ['observaciones_finales', sql.NVarChar(sql.MAX)], cierreNombre: ['cierre_nombre', sql.NVarChar(200)],
    cierreFecha: ['cierre_fecha', sql.Date],
};

function readEvaluacion(body) {
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const out = {};
    const errors = [];
    for (const k of ['relacionada', 'procede', 'responsableIndependiente', 'requiereTnc', 'requiereAuditoria']) if (has(k)) out[k] = toBool(body[k]);
    if (has('evaluacion')) out.evaluacion = clip(body.evaluacion, 8000);
    if (has('responsable')) out.responsable = clip(body.responsable, 200);
    if (has('respuestaFormal')) out.respuestaFormal = clip(body.respuestaFormal, 8000);
    // Causa: texto corto y homogéneo (sin espacios dobles) para agrupar en la estadística.
    if (has('causa')) out.causa = clip(body.causa, 120).replace(/\s+/g, ' ');
    if (has('requisito')) out.requisito = clip(body.requisito, 500);
    if (has('jefeArea')) out.jefeArea = clip(body.jefeArea, 200);
    if (has('reunionAsistentes')) out.reunionAsistentes = clip(body.reunionAsistentes, 4000);
    if (has('reunionDirectrices')) out.reunionDirectrices = clip(body.reunionDirectrices, 8000);
    for (const [k, label] of [['reunionFecha', 'de la reunión'], ['fechaEvaluacion', 'de evaluación']]) {
        if (!has(k)) continue;
        out[k] = clip(body[k], 10);
        if (out[k] && !isValidDate(out[k])) errors.push(`La fecha ${label} no es válida.`);
        else if (isFuture(out[k])) errors.push(`La fecha ${label} no puede ser posterior a hoy.`);
    }
    return { data: out, error: errors[0] || null };
}

function readTratamiento(body) {
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const out = {};
    const errors = [];
    for (const k of ['analisisCausa', 'accionesCorrectivas', 'accionesPreventivas', 'tratamiento', 'conclusiones', 'participantes', 'respuestaFormal', 'eficacia']) {
        if (has(k)) out[k] = clip(body[k], 8000);
    }
    if (has('aprobadoPor')) out.aprobadoPor = clip(body.aprobadoPor, 200);
    if (has('fechaTratamiento')) {
        out.fechaTratamiento = clip(body.fechaTratamiento, 10);
        if (out.fechaTratamiento && !isValidDate(out.fechaTratamiento)) errors.push('La fecha de tratamiento no es válida.');
        else if (isFuture(out.fechaTratamiento)) errors.push('La fecha de tratamiento no puede ser posterior a hoy.');
    }
    return { data: out, error: errors[0] || null };
}

function readAccion(body) {
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const out = {};
    const errors = [];
    const text = { area: 200, detectadoPor: 300, requisito: 500, hallazgo: 8000, justificacion: 8000, correccion: 8000, participantes: 4000, tecnica: 300, alcance: 8000, accion: 8000, responsable: 200, observaciones: 8000, eficacia: 8000, observacionesFinales: 8000, cierreNombre: 200 };
    for (const [k, max] of Object.entries(text)) if (has(k)) out[k] = clip(body[k], max);
    for (const k of ['procedeAc', 'cumplimientoPlazo', 'causaEliminada', 'seLevantaNc']) if (has(k)) out[k] = toBool(body[k]);
    for (const k of ['fechaDeteccion', 'fechaInicio', 'plazo', 'fechaSeguimiento', 'cierreFecha']) {
        if (!has(k)) continue;
        out[k] = clip(body[k], 10);
        if (out[k] && !isValidDate(out[k])) errors.push('Revisa las fechas de la acción correctiva.');
        else if (!['plazo', 'fechaSeguimiento'].includes(k) && isFuture(out[k])) errors.push('Las fechas de detección, inicio y cierre no pueden ser posteriores a hoy.');
    }
    if (has('seguimientos')) {
        const list = Array.isArray(body.seguimientos) ? body.seguimientos : [];
        if (list.length > 3) errors.push('El formulario admite hasta 3 seguimientos.');
        const seg = list.slice(0, 3).map((x) => ({
            fecha: clip(x && x.fecha, 10), cumplimiento: clip(x && x.cumplimiento, 50),
            responsable: clip(x && x.responsable, 200), observaciones: clip(x && x.observaciones, 2000),
        }));
        if (seg.some((x) => x.fecha && !isValidDate(x.fecha))) errors.push('Revisa las fechas de los seguimientos.');
        else if (seg.some((x) => isFuture(x.fecha))) errors.push('Un seguimiento realizado no puede tener fecha posterior a hoy.');
        out.seguimientos = JSON.stringify(seg);
    }
    return { data: out, error: errors[0] || null };
}

// Ninguna fecha del caso puede ser anterior a la recepción de la queja o apelación.
const FECHA_LABELS = {
    fechaTratamiento: 'tratamiento', reunionFecha: 'la reunión de análisis', fechaEvaluacion: 'evaluación',
    fechaDeteccion: 'detección', fechaInicio: 'inicio del tratamiento', plazo: 'plazo de implementación',
    fechaSeguimiento: 'seguimiento', cierreFecha: 'cierre',
};
function antesDeRecepcion(recepcion, data) {
    const rec = isoDate(recepcion);
    if (!rec) return null;
    const msg = (label, v) => `La fecha de ${label} (${fmtDay(v)}) no puede ser anterior a la recepción del caso (${fmtDay(rec)}).`;
    for (const [k, label] of Object.entries(FECHA_LABELS)) {
        if (data[k] && String(data[k]) < rec) return msg(label, data[k]);
    }
    if (data.seguimientos) {
        let seg = [];
        try { seg = JSON.parse(data.seguimientos); } catch { seg = []; }
        const malo = seg.find((x) => x.fecha && x.fecha < rec);
        if (malo) return msg('un seguimiento', malo.fecha);
    }
    return null;
}
const validar = ({ data, error }) => { if (error) throw fallo(error); return data; };
const sinFechaPrevia = (recepcion, data) => { const m = antesDeRecepcion(recepcion, data); if (m) throw fallo(m); };

// ── Acceso a datos ───────────────────────────────────────────────────────────
const pool = () => getConnectionAdlWeb();
const parseId = (v) => {
    const id = parseInt(v, 10);
    if (!Number.isFinite(id)) throw fallo('ID inválido');
    return id;
};

async function loadCase(p, id) {
    const r = await p.request().input('id', sql.Int, id).query('SELECT * FROM dbo.quejas_apelaciones WHERE id = @id');
    return r.recordset[0] || null;
}
async function mustLoadCase(p, id) {
    const caso = await loadCase(p, id);
    if (!caso) throw fallo('Caso no encontrado', 404);
    return caso;
}
async function loadNotifications(p, casoId) {
    const r = await p.request().input('id', sql.Int, casoId)
        .query('SELECT * FROM dbo.quejas_apelaciones_notificaciones WHERE caso_id = @id ORDER BY fecha, id');
    return r.recordset.map((n) => ({ ...n, fecha: isoDate(n.fecha), automatico: Boolean(n.automatico), etapaLabel: ETAPAS[n.etapa] || n.etapa }));
}
async function loadAttachments(p, casoId) {
    const r = await p.request().input('id', sql.Int, casoId)
        .query('SELECT id, nombre, tipo_mime, tamano, descripcion, subido_por, creado_en FROM dbo.quejas_apelaciones_adjuntos WHERE caso_id = @id ORDER BY id');
    return r.recordset;
}
async function loadActions(p, casoId) {
    const r = await p.request().input('id', sql.Int, casoId).query('SELECT * FROM dbo.qa_acciones_correctivas WHERE caso_id = @id ORDER BY id');
    return r.recordset.map(acView);
}
async function loadAction(p, id, acId) {
    const r = await p.request().input('id', sql.Int, acId).input('caso', sql.Int, id)
        .query('SELECT * FROM dbo.qa_acciones_correctivas WHERE id = @id AND caso_id = @caso');
    if (!r.recordset[0]) throw fallo('Acción correctiva no encontrada', 404);
    return r.recordset[0];
}

async function addNotification(p, { casoId, etapa, notificadoA, via, observaciones, fecha, automatico = false, creadoPor = null }) {
    try {
        await p.request()
            .input('caso_id', sql.Int, casoId)
            .input('etapa', sql.NVarChar(20), etapa)
            .input('notificado_a', sql.NVarChar(300), clip(notificadoA, 300))
            .input('via', sql.NVarChar(100), clip(via, 100))
            .input('obs', sql.NVarChar(2000), clip(observaciones, 2000) || null)
            .input('fecha', sql.Date, dbDate(fecha || nowChile().fecha))
            .input('auto', sql.Bit, automatico ? 1 : 0)
            .input('por', sql.NVarChar(100), creadoPor)
            .query(`INSERT INTO dbo.quejas_apelaciones_notificaciones (caso_id, etapa, notificado_a, via, observaciones, fecha, automatico, creado_por)
                    VALUES (@caso_id, @etapa, @notificado_a, @via, @obs, @fecha, @auto, @por)`);
    } catch (e) {
        logger.warn(`[Quejas y apelaciones] No se pudo registrar la notificación del caso: ${e.message}`);
    }
}

// Auditoría en la misma tabla que usa ADLWeb (registro_auditoria). Nunca bloquea.
// usuario_api indica que la acción se hizo desde ADL-One.
async function audit(operacion, campo, valorAnterior, valorNuevo, usuario) {
    try {
        const p = await pool();
        await p.request()
            .input('tabla', sql.NVarChar, 'quejas_apelaciones')
            .input('operacion', sql.NVarChar, operacion)
            .input('campo', sql.NVarChar, campo)
            .input('valorAnterior', sql.NVarChar, valorAnterior ? JSON.stringify(valorAnterior) : null)
            .input('valorNuevo', sql.NVarChar, valorNuevo ? JSON.stringify(valorNuevo) : null)
            .input('usuario', sql.NVarChar, `${usuario || 'desconocido'} (ADL ONE)`.slice(0, 100))
            .query(`INSERT INTO registro_auditoria (tabla, operacion, campo, valor_anterior, valor_nuevo, usuario_api)
                    VALUES (@tabla, @operacion, @campo, @valorAnterior, @valorNuevo, @usuario)`);
    } catch (e) {
        logger.warn(`[Quejas y apelaciones] No se pudo registrar la auditoría: ${e.message}`);
    }
}

// UPDATE con solo las columnas enviadas; devuelve las columnas que cambiaron.
async function applyUpdate(p, registro, data, cols, extraSets = [], table = 'quejas_apelaciones') {
    const request = p.request().input('id', sql.Int, registro.id);
    const sets = [...extraSets];
    const cambios = [];
    for (const [k, v] of Object.entries(data)) {
        const [col, type] = cols[k];
        let value = v === '' || v === undefined ? null : v;
        if (type === sql.Bit && value !== null) value = value ? 1 : 0;
        if (type === sql.Date) value = dbDate(value);
        request.input(`p_${k}`, type, value);
        sets.push(`${col} = @p_${k}`);
        const before = registro[col] instanceof Date ? isoDate(registro[col]) : typeof registro[col] === 'boolean' ? (registro[col] ? 1 : 0) : registro[col] ?? null;
        const after = value instanceof Date ? isoDate(value) : value;
        if (String(before ?? '') !== String(after ?? '')) cambios.push(col);
    }
    if (!sets.length) return cambios;
    await request.query(`UPDATE dbo.${table} SET ${sets.join(', ')}, actualizado_en = GETDATE() WHERE id = @id`);
    return cambios;
}


// =============================================================================
// Operaciones
// =============================================================================

/** Listado (todas las solicitudes); ?q= busca, ?anio= filtra por año de recepción. */
async function listar(query = {}) {
    const p = await pool();
    const request = p.request();
    const where = [];
    const q = clip(query.q, 100);
    if (q) {
        request.input('q', sql.NVarChar(120), `%${q.replace(/[%_[\]]/g, (c) => `[${c}]`)}%`);
        where.push(`(folio LIKE @q OR empresa LIKE @q OR nombre LIKE @q OR correo LIKE @q OR numero_informe LIKE @q
                    OR motivo LIKE @q OR conclusiones LIKE @q OR participantes LIKE @q OR responsable LIKE @q OR causa LIKE @q OR jefe_area LIKE @q)`);
    }
    const anio = parseInt(query.anio, 10);
    if (Number.isFinite(anio)) { request.input('anio', sql.Int, anio); where.push('YEAR(fecha_recepcion) = @anio'); }
    // Quejas y Apelaciones se muestran en secciones separadas.
    const tipo = clip(query.tipo, 20);
    if (TIPOS[tipo]) { request.input('tipo', sql.NVarChar(20), tipo); where.push('tipo = @tipo'); }
    const r = await request.query(`
        SELECT id, folio, tipo, origen, canal, empresa, nombre, correo, telefono, fecha_recepcion, hora_recepcion,
               fecha_tratamiento, area, numero_informe, estado, procede, responsable, plazo_vence, cerrado_en, creado_en, actualizado_en,
               emisor, via_ingreso, causa, jefe_area,
               (SELECT COUNT(*) FROM dbo.qa_acciones_correctivas a WHERE a.caso_id = quejas_apelaciones.id AND a.estado = 'abierta') AS acciones_abiertas,
               (SELECT COUNT(*) FROM dbo.quejas_apelaciones_notificaciones n WHERE n.caso_id = quejas_apelaciones.id) AS notificaciones
        FROM dbo.quejas_apelaciones
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY fecha_recepcion DESC, id DESC`);
    return r.recordset.map(view);
}

/** Indicadores para la revisión por la dirección (cl. 8.9). */
async function estadistica(query = {}) {
    const p = await pool();
    const tipoQ = clip(query.tipo, 20);
    const r = await p.request().query(`
        SELECT id, folio, tipo, origen, canal, area, estado, procede, relacionada_actividades, requiere_tnc, requiere_auditoria,
               fecha_recepcion, fecha_evaluacion, plazo_vence, cerrado_en, causa, emisor, via_ingreso, empresa, nombre, responsable
        FROM dbo.quejas_apelaciones`);
    const all = r.recordset
        .filter((c) => !TIPOS[tipoQ] || c.tipo === tipoQ)
        .map((c) => ({ ...c, fecha_recepcion: isoDate(c.fecha_recepcion), fecha_evaluacion: isoDate(c.fecha_evaluacion), plazo_vence: isoDate(c.plazo_vence) }));
    const hoyDash = nowChile().fecha;
    // Casos abiertos (de cualquier año) ordenados por plazo: vencidos y por vencer primero.
    const abiertosHoy = all.filter((c) => !CERRADOS.includes(c.estado));
    const plazos = abiertosHoy
        .map((c) => ({
            id: c.id, folio: c.folio, tipo: c.tipo, tipoLabel: TIPOS[c.tipo] || c.tipo, empresa: c.empresa, nombre: c.nombre,
            responsable: c.responsable, estado: c.estado, estadoLabel: ESTADOS[c.estado] || c.estado, plazo_vence: c.plazo_vence,
            diasHabiles: c.plazo_vence ? diasHabilesHasta(hoyDash, c.plazo_vence) : null,
        }))
        .sort((a, b) => (a.diasHabiles ?? 9999) - (b.diasHabiles ?? 9999));
    // Carga de trabajo: casos abiertos por responsable.
    const carga = new Map();
    for (const c of abiertosHoy) {
        const k = (c.responsable || '').trim() || 'Sin responsable';
        const e = carga.get(k) || { responsable: k, abiertos: 0, vencidos: 0 };
        e.abiertos += 1;
        if (c.plazo_vence && c.plazo_vence < hoyDash) e.vencidos += 1;
        carga.set(k, e);
    }
    const anios = [...new Set(all.map((c) => Number(c.fecha_recepcion.slice(0, 4))))].sort((a, b) => b - a);
    const anioQ = parseInt(query.anio, 10);
    const anio = Number.isFinite(anioQ) ? anioQ : Number(nowChile().fecha.slice(0, 4));
    const rows = all.filter((c) => Number(c.fecha_recepcion.slice(0, 4)) === anio);
    const hoy = nowChile().fecha;
    const count = (fn) => rows.filter(fn).length;
    const by = (key, labels) => Object.entries(labels).map(([value, label]) => ({ value, label, total: count((c) => c[key] === value) }));
    const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
    const cerrados = rows.filter((c) => CERRADOS.includes(c.estado) && c.cerrado_en);
    const diasCierre = cerrados.map((c) => daysBetween(c.fecha_recepcion, c.cerrado_en));
    const diasEval = rows.filter((c) => c.fecha_evaluacion).map((c) => daysBetween(c.fecha_recepcion, c.fecha_evaluacion));
    const enPlazo = cerrados.filter((c) => !c.plazo_vence || isoDate(c.cerrado_en) <= c.plazo_vence).length;
    const delMes = (i) => rows.filter((c) => c.fecha_recepcion.startsWith(`${anio}-${String(i + 1).padStart(2, '0')}`));
    const meses = Array.from({ length: 12 }, (_, i) => {
        const enMes = delMes(i);
        return { mes: i + 1, queja: enMes.filter((c) => c.tipo === 'queja').length, apelacion: enMes.filter((c) => c.tipo === 'apelacion').length };
    });
    // Causas: se agrupan sin distinguir mayúsculas; "Sin clasificar" si aún no se evaluó.
    const causaKey = (c) => (c.causa ? String(c.causa).trim().toLowerCase() : '');
    const causaLabel = new Map();
    for (const c of rows) if (causaKey(c) && !causaLabel.has(causaKey(c))) causaLabel.set(causaKey(c), String(c.causa).trim());
    const porCausa = [...causaLabel.entries()].map(([value, label]) => ({ value, label, total: count((c) => causaKey(c) === value) }))
        .sort((a, b) => b.total - a.total);
    const sinCausa = count((c) => !causaKey(c));
    if (sinCausa) porCausa.push({ value: '', label: 'Sin clasificar', total: sinCausa });
    // Tendencia: las 4 causas más frecuentes por mes; el resto suma en "Otras".
    const top = porCausa.filter((x) => x.value).slice(0, 4);
    const tendenciaCausas = Array.from({ length: 12 }, (_, i) => {
        const enMes = delMes(i);
        const fila = { mes: i + 1 };
        for (const t of top) fila[t.label] = enMes.filter((c) => causaKey(c) === t.value).length;
        fila.Otras = enMes.filter((c) => !top.some((t) => t.value === causaKey(c))).length;
        return fila;
    });
    const vias = [...new Set(rows.map((c) => c.via_ingreso).filter(Boolean))];
    return {
        anio,
        porCausa,
        causasTendencia: [...top.map((t) => t.label), 'Otras'],
        tendenciaCausas,
        porEmisor: by('emisor', EMISORES),
        porVia: vias.map((v) => ({ value: v, label: v, total: count((c) => c.via_ingreso === v) })).sort((a, b) => b.total - a.total),
        anios: anios.includes(anio) ? anios : [anio, ...anios].sort((a, b) => b - a),
        total: rows.length,
        abiertos: count((c) => !CERRADOS.includes(c.estado)),
        vencidos: count((c) => !CERRADOS.includes(c.estado) && c.plazo_vence && c.plazo_vence < hoy),
        cerrados: cerrados.length,
        procedentes: count((c) => c.procede === true || c.procede === 1),
        noProcedentes: count((c) => c.procede === false || c.procede === 0),
        sinEvaluar: count((c) => c.procede === null || c.procede === undefined),
        noRelacionadas: count((c) => c.relacionada_actividades === false || c.relacionada_actividades === 0),
        trabajoNoConforme: count((c) => c.requiere_tnc === true || c.requiere_tnc === 1),
        auditorias: count((c) => c.requiere_auditoria === true || c.requiere_auditoria === 1),
        diasPromedioEvaluacion: avg(diasEval),
        diasPromedioCierre: avg(diasCierre),
        cerradosEnPlazo: enPlazo,
        porcentajeEnPlazo: cerrados.length ? Math.round((enPlazo / cerrados.length) * 100) : null,
        porTipo: by('tipo', TIPOS),
        porOrigen: by('origen', ORIGENES),
        porCanal: by('canal', CANALES),
        porEstado: by('estado', ESTADOS),
        porMes: meses,
        // Dashboard (casos abiertos hoy, de cualquier año)
        tipo: TIPOS[tipoQ] ? tipoQ : null,
        plazos: plazos.slice(0, 50),
        porVencer: plazos.filter((x) => x.diasHabiles !== null && x.diasHabiles >= 0 && x.diasHabiles <= DIAS_AVISO).length,
        vencidosHoy: plazos.filter((x) => x.diasHabiles !== null && x.diasHabiles < 0).length,
        abiertosHoy: abiertosHoy.length,
        cargaResponsables: [...carga.values()].sort((a, b) => b.abiertos - a.abiertos),
    };
}

/** Días hábiles (lun-vie) desde hoy hasta el plazo; negativo si ya venció. */
export function diasHabilesHasta(hoy, plazo) {
    const a = new Date(`${hoy}T12:00:00Z`);
    const b = new Date(`${plazo}T12:00:00Z`);
    const signo = b >= a ? 1 : -1;
    const [desde, hasta] = signo > 0 ? [a, b] : [b, a];
    let n = 0;
    const d = new Date(desde);
    while (d < hasta) {
        d.setUTCDate(d.getUTCDate() + 1);
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) n += 1;
    }
    return signo * n;
}
/** Desde cuántos días hábiles antes del plazo un caso se considera "por vencer". */
export const DIAS_AVISO = 3;

/** Detalle del caso con notificaciones, adjuntos, acciones correctivas y consentimiento. */
async function obtener(idParam) {
    const id = parseId(idParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    let consentimiento = null;
    try {
        const c = await p.request().input('ref', sql.NVarChar(255), caso.folio)
            .query(`SELECT TOP 1 version_documentos, acepta_privacidad, ip_truncada, creado_en FROM dbo.consentimientos WHERE formulario = 'quejas_apelaciones' AND referencia = @ref ORDER BY id`);
        consentimiento = c.recordset[0] || null;
    } catch { /* tabla opcional */ }
    return {
        ...view(caso), consentimiento,
        notificaciones: await loadNotifications(p, id), adjuntos: await loadAttachments(p, id), acciones: await loadActions(p, id),
    };
}

/** Formulario OI-FoGe-05 (plantilla original de Calidad, rellenada). */
async function formulario(idParam, usuario) {
    const id = parseId(idParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    const buffer = buildQualityFormOdt({ ...view(caso), notificaciones: await loadNotifications(p, id), acciones: await loadActions(p, id) });
    await audit('FORMULARIO', 'OI-FoGe-05', null, `${caso.folio}: formulario generado`, usuario);
    return { buffer, nombre: `OI-FoGe-05 ${caso.folio}.odt` };
}

// ── 1. Registro ──────────────────────────────────────────────────────────────
async function crear(body = {}, usuario) {
    const data = validar(readRegistro({ numeroInforme: '', fechaTratamiento: '', emisor: 'cliente', viaIngreso: '', ...body }));
    sinFechaPrevia(data.fechaRecepcion, data);
    const p = await pool();
    const config = await getSystemConfig();
    const info = getLegalInfo(config);
    const plazo = addBusinessDays(data.fechaRecepcion, info.plazoRespuestaQuejasDias);
    const r = await p.request()
        .input('tipo', sql.NVarChar(20), data.tipo)
        .input('origen', sql.NVarChar(20), data.origen)
        .input('canal', sql.NVarChar(20), 'panel')
        .input('empresa', sql.NVarChar(200), data.empresa)
        .input('nombre', sql.NVarChar(200), data.nombre)
        .input('correo', sql.NVarChar(255), data.correo)
        .input('telefono', sql.NVarChar(50), data.telefono)
        .input('fecha_recepcion', sql.Date, dbDate(data.fechaRecepcion))
        .input('hora_recepcion', sql.NVarChar(5), data.horaRecepcion)
        .input('fecha_tratamiento', sql.Date, dbDate(data.fechaTratamiento || null))
        .input('area', sql.NVarChar(50), AREA)
        .input('numero_informe', sql.NVarChar(100), data.numeroInforme || null)
        .input('emisor', sql.NVarChar(30), data.emisor || 'cliente')
        .input('via_ingreso', sql.NVarChar(50), data.viaIngreso || null)
        .input('motivo', sql.NVarChar(sql.MAX), data.motivo)
        .input('plazo', sql.Date, dbDate(plazo))
        .input('version', sql.NVarChar(20), info.version)
        .input('por', sql.NVarChar(100), usuario || null)
        .query(`
            INSERT INTO dbo.quejas_apelaciones (tipo, origen, canal, empresa, nombre, correo, telefono, fecha_recepcion, hora_recepcion,
              fecha_tratamiento, area, numero_informe, emisor, via_ingreso, motivo, plazo_vence, version_documentos, creado_por, estado, actualizado_en)
            OUTPUT INSERTED.id
            VALUES (@tipo, @origen, @canal, @empresa, @nombre, @correo, @telefono, @fecha_recepcion, @hora_recepcion,
              @fecha_tratamiento, @area, @numero_informe, @emisor, @via_ingreso, @motivo, @plazo, @version, @por, 'registrada', GETDATE())`);
    const { id } = r.recordset[0];
    // Mismo formato de folio que ADLWeb (correlativo por id): QA-AAAA-00001.
    const folio = `QA-${data.fechaRecepcion.slice(0, 4)}-${String(id).padStart(5, '0')}`;
    await p.request().input('id', sql.Int, id).input('folio', sql.NVarChar(30), folio)
        .query('UPDATE dbo.quejas_apelaciones SET folio = @folio WHERE id = @id');

    // El acuse (con N° y código de acceso) lo envía ADLWeb desde la cola.
    const correo = body.enviarAcuse ? await encolarCorreo(p, { casoId: id, tipo: 'acuse', eventoId: 'registro', usuario }) : null;
    await audit('INSERT', 'registro', null, `${folio}: ${TIPOS[data.tipo]} ${ORIGENES[data.origen].toLowerCase()}`, usuario);
    return { id, folio, correo };
}

// En los casos llegados por la web, el motivo, el mail y la fecha/hora de
// recepción son los que registró el sistema y no se modifican.
async function editarRegistro(idParam, body = {}, usuario) {
    const id = parseId(idParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    if (CERRADOS.includes(caso.estado)) throw fallo('El caso está cerrado y su registro ya no se puede modificar.', 409);
    const entrada = { ...body };
    if (caso.canal === 'web') for (const k of ['motivo', 'correo', 'fechaRecepcion', 'horaRecepcion']) delete entrada[k];
    const data = validar(readRegistro(entrada, { parcial: true }));
    sinFechaPrevia(data.fechaRecepcion || isoDate(caso.fecha_recepcion), data);
    // Si se corrige la recepción (casos del panel), no puede quedar después de fechas ya registradas.
    if (data.fechaRecepcion) {
        const notifs = await loadNotifications(p, id);
        const registradas = [
            ['tratamiento', 'fechaTratamiento' in data ? data.fechaTratamiento : isoDate(caso.fecha_tratamiento)],
            ['evaluación', isoDate(caso.fecha_evaluacion)],
            ['la reunión de análisis', isoDate(caso.reunion_fecha)],
            ...notifs.map((n) => [`la notificación de ${(ETAPAS[n.etapa] || n.etapa).toLowerCase()}`, n.fecha]),
        ];
        const choca = registradas.find(([, v]) => v && v < data.fechaRecepcion);
        if (choca) throw fallo(`La recepción no puede quedar después de la fecha de ${choca[0]} (${fmtDay(choca[1])}).`);
    }
    const cambios = await applyUpdate(p, caso, data, REGISTRO_COLS);
    if (cambios.length) await audit('REGISTRO', cambios.join(','), null, `${caso.folio}: ${cambios.join(', ')}`, usuario);
    return { cambios };
}

// ── 2. Evaluación ────────────────────────────────────────────────────────────
// Guardar sin decidir → "En evaluación". Decidir (decidir: true):
//  - procede → "En tratamiento" (opcional: avisar al cliente = avance).
//  - no procede → se cierra con respuesta formal (opcional: enviarla = finalización).
async function guardarEvaluacion(idParam, body = {}, usuario) {
    const id = parseId(idParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    if (CERRADOS.includes(caso.estado)) throw fallo('El caso está cerrado.', 409);
    const data = validar(readEvaluacion(body));
    sinFechaPrevia(caso.fecha_recepcion, data);
    const decidir = body.decidir === true;
    if (caso.estado === 'en_tratamiento' && (decidir || data.procede === false || data.relacionada === false)) {
        throw fallo('La decisión ya fue tomada: el caso está en tratamiento.', 409);
    }
    const merged = {
        relacionada: 'relacionada' in data ? data.relacionada : (caso.relacionada_actividades === null ? null : Boolean(caso.relacionada_actividades)),
        procede: 'procede' in data ? data.procede : (caso.procede === null ? null : Boolean(caso.procede)),
        evaluacion: 'evaluacion' in data ? data.evaluacion : caso.evaluacion || '',
        responsable: 'responsable' in data ? data.responsable : caso.responsable || '',
        independiente: 'responsableIndependiente' in data ? data.responsableIndependiente : Boolean(caso.responsable_independiente),
        respuesta: 'respuestaFormal' in data ? data.respuestaFormal : caso.respuesta_formal || '',
    };
    if (merged.relacionada === false && merged.procede === true) throw fallo('Si no se relaciona con las actividades del laboratorio, no puede proceder.');

    let estado = caso.estado === 'registrada' ? 'en_evaluacion' : caso.estado;
    const extra = [];
    if (decidir) {
        if (merged.relacionada === null) throw fallo('Indica si se relaciona con las actividades del laboratorio.');
        if (merged.procede === null) throw fallo('Indica si la queja o apelación procede.');
        if (String(merged.evaluacion).length < 10) throw fallo('Fundamenta la evaluación (al menos 10 caracteres).');
        if (String(merged.responsable).length < 2) throw fallo('Indica el responsable del caso.');
        if (!merged.independiente) throw fallo('El responsable debe ser una persona que no participó en la actividad en cuestión (cl. 7.9.6).');
        const causa = 'causa' in data ? data.causa : caso.causa || '';
        if (String(causa).length < 2) throw fallo('Clasifica la causa: se usa en la estadística para la revisión por la dirección.');
        if (caso.tipo === 'apelacion') {
            const rf = 'reunionFecha' in data ? data.reunionFecha : isoDate(caso.reunion_fecha);
            const ra = 'reunionAsistentes' in data ? data.reunionAsistentes : caso.reunion_asistentes || '';
            if (!rf || String(ra).length < 2) throw fallo('En una apelación registra la reunión de análisis (fecha y asistentes) antes de decidir.');
        }
        if (!data.fechaEvaluacion && !caso.fecha_evaluacion) data.fechaEvaluacion = nowChile().fecha;
        if (merged.procede) {
            estado = 'en_tratamiento';
        } else {
            if (String(merged.respuesta).length < 10) throw fallo('Redacta la respuesta formal con los fundamentos (al menos 10 caracteres).');
            estado = 'no_procede';
            extra.push('cerrado_en = GETDATE()');
        }
    }
    // estado es siempre una clave de ESTADOS (no viene del cliente).
    extra.push(`estado = '${estado}'`);
    const cols = {
        ...EVALUACION_COLS, evaluadoPor: ['evaluado_por', sql.NVarChar(100)], cerradoPor: ['cerrado_por', sql.NVarChar(100)],
        fechaTratamiento: ['fecha_tratamiento', sql.Date],
    };
    const payload = { ...data };
    if (decidir) payload.evaluadoPor = usuario || null;
    if (estado === 'no_procede') {
        payload.cerradoPor = usuario || null;
        // Si no procede, la evaluación y la respuesta formal son el tratamiento del caso.
        if (!caso.fecha_tratamiento) payload.fechaTratamiento = data.fechaEvaluacion || isoDate(caso.fecha_evaluacion) || nowChile().fecha;
    }
    const cambios = await applyUpdate(p, caso, payload, cols, extra);
    if (cambios.length || estado !== caso.estado) {
        await audit('EVALUACION', [...cambios, estado !== caso.estado && 'estado'].filter(Boolean).join(','), caso.estado, `${caso.folio}: ${ESTADOS[estado]}`, usuario);
    }

    // Aviso al cliente (opcional): lo envía ADLWeb desde la cola. evento_id = n° de decisión
    // del caso (sube con cada anulación), así un reintento no duplica y una nueva decisión sí avisa.
    let correo = null;
    if (decidir && body.notificarCliente && (estado === 'en_tratamiento' || estado === 'no_procede')) {
        correo = await encolarCorreo(p, {
            casoId: id, tipo: estado === 'en_tratamiento' ? 'tratamiento' : 'no_procede',
            eventoId: `decision-${parseHistorial(caso.evaluacion_historial).length}`, usuario,
        });
    }
    return { estado, cambios, correo };
}

// reasignacion: antes de decidir, el responsable designado sí participó en la
//   actividad (cl. 7.9.6) → se quita y se designa otro.
// anulacion: el caso ya pasó a tratamiento y la decisión no es válida → vuelve a
//   evaluación. No se permite con acciones correctivas levantadas ni con el caso cerrado.
async function reabrirEvaluacion(idParam, body = {}, usuario) {
    const id = parseId(idParam);
    const tipo = clip(body.tipo, 20);
    if (!REAPERTURAS[tipo]) throw fallo('Tipo de reapertura no válido.');
    const motivo = clip(body.motivo, 2000);
    if (motivo.length < 10) throw fallo('Explica el motivo (al menos 10 caracteres): queda en el historial del caso.');
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    if (CERRADOS.includes(caso.estado)) {
        throw fallo('El caso está cerrado y la respuesta ya se comunicó. Si hay que revisarlo, registra un nuevo caso (por ejemplo, una apelación).', 409);
    }
    if (tipo === 'reasignacion' && caso.estado === 'en_tratamiento') throw fallo('La decisión ya fue tomada: para cambiar al responsable, anula la decisión.', 409);
    if (tipo === 'anulacion') {
        if (caso.estado !== 'en_tratamiento') throw fallo('Solo se anula una decisión ya registrada (caso en tratamiento).', 409);
        const acs = (await loadActions(p, id)).filter((a) => a.estado !== 'anulada');
        if (acs.length) {
            throw fallo(`El caso tiene ${acs.length} acción(es) correctiva(s) levantada(s) (${acs.map((a) => a.folio).join(', ')}). No se puede anular la decisión: resuélvelas en el tratamiento.`, 409);
        }
    }
    const ahora = nowChile();
    const entrada = {
        tipo,
        fecha: new Date().toISOString(),
        dia: ahora.fecha,
        hora: ahora.hora,
        por: usuario || null,
        motivo,
        responsableAnterior: caso.responsable || null,
        decisionAnterior: tipo === 'anulacion' ? (caso.procede ? 'procede' : 'no procede') : null,
        fechaEvaluacionAnterior: tipo === 'anulacion' ? isoDate(caso.fecha_evaluacion) : null,
        evaluadoPorAnterior: tipo === 'anulacion' ? caso.evaluado_por || null : null,
    };
    const historial = [...parseHistorial(caso.evaluacion_historial), entrada];
    // Se conserva el fundamento escrito como punto de partida de la nueva investigación.
    const sets = [
        'responsable = NULL', 'responsable_independiente = 0', 'evaluacion_historial = @hist',
        ...(tipo === 'anulacion' ? ['procede = NULL', 'fecha_evaluacion = NULL', 'evaluado_por = NULL', 'fecha_tratamiento = NULL'] : []),
        "estado = 'en_evaluacion'", 'actualizado_en = GETDATE()',
    ];
    await p.request().input('id', sql.Int, id).input('hist', sql.NVarChar(sql.MAX), JSON.stringify(historial))
        .query(`UPDATE dbo.quejas_apelaciones SET ${sets.join(', ')} WHERE id = @id`);
    await audit('EVALUACION_REABIERTA', tipo, caso.estado,
        `${caso.folio}: ${REAPERTURAS[tipo]}${caso.responsable ? ` (responsable: ${caso.responsable})` : ''}. Motivo: ${motivo}`, usuario);
    return { estado: 'en_evaluacion' };
}

// ── 3. Tratamiento ───────────────────────────────────────────────────────────
// Solo con el caso "En tratamiento". Cerrar (cerrar: true) exige conclusiones,
// participantes, respuesta formal y la aprobación de una persona independiente.
// Ya cerrado, solo se puede registrar la verificación de eficacia.
async function guardarTratamiento(idParam, body = {}, usuario) {
    const id = parseId(idParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    const data = validar(readTratamiento(body));
    sinFechaPrevia(caso.fecha_recepcion, data);

    if (caso.estado === 'cerrada') {
        const soloEficacia = Object.keys(data).every((k) => k === 'eficacia');
        if (!soloEficacia || body.cerrar) throw fallo('El caso está cerrado: solo puedes registrar la verificación de la eficacia.', 409);
        const cambios = await applyUpdate(p, caso, data, TRATAMIENTO_COLS);
        if (cambios.length) await audit('EFICACIA', 'eficacia', null, `${caso.folio}: verificación de eficacia`, usuario);
        return { estado: caso.estado, cambios, correo: null };
    }
    if (caso.estado !== 'en_tratamiento') throw fallo('Primero completa la evaluación y decide si el caso procede.', 409);

    if (!data.fechaTratamiento && !caso.fecha_tratamiento) data.fechaTratamiento = nowChile().fecha;
    const v = (k, col) => (k in data ? data[k] : caso[col] || '');
    const extra = [];
    let estado = caso.estado;
    if (body.cerrar === true) {
        if (String(v('conclusiones', 'conclusiones')).length < 10) throw fallo('Escribe las conclusiones (al menos 10 caracteres).');
        if (String(v('participantes', 'participantes')).length < 2) throw fallo('Indica los participantes.');
        if (String(v('respuestaFormal', 'respuesta_formal')).length < 10) throw fallo('Redacta la respuesta formal (al menos 10 caracteres).');
        if (String(v('aprobadoPor', 'aprobado_por')).length < 2) throw fallo('Indica quién revisa y aprueba la resolución.');
        if (body.aprobadorIndependiente !== true) throw fallo('Confirma que quien aprueba no participó en la actividad en cuestión (cl. 7.9.6).');
        const abiertas = (await loadActions(p, id)).filter((a) => a.estado === 'abierta');
        if (abiertas.length) throw fallo(`No se puede cerrar: hay acciones correctivas abiertas (${abiertas.map((a) => a.folio).join(', ')}).`, 409);
        estado = 'cerrada';
        extra.push("estado = 'cerrada'", 'cerrado_en = GETDATE()');
        data.cerradoPor = usuario || null;
    }
    const cambios = await applyUpdate(p, caso, data, { ...TRATAMIENTO_COLS, cerradoPor: ['cerrado_por', sql.NVarChar(100)] }, extra);
    if (cambios.length || estado !== caso.estado) {
        await audit(estado === 'cerrada' ? 'CIERRE' : 'TRATAMIENTO', cambios.join(','), caso.estado, `${caso.folio}: ${ESTADOS[estado]}`, usuario);
    }
    // Respuesta formal y cierre: la envía ADLWeb desde la cola (un caso se cierra una sola vez).
    const correo = estado === 'cerrada' && body.notificarCliente
        ? await encolarCorreo(p, { casoId: id, tipo: 'cierre', eventoId: 'cierre', usuario })
        : null;
    return { estado, cambios, correo };
}

// ── Notificaciones ───────────────────────────────────────────────────────────
/**
 * Acuse de recibo posterior (si no se envió al registrar): queda en la cola de ADLWeb, que lo
 * envía SOLO al mail de contacto con un código de acceso nuevo y registra la notificación de inicio.
 * No se encola si ya hay un acuse esperando para el caso; el evento por minuto evita el doble clic.
 */
async function enviarAcuse(idParam, usuario) {
    const id = parseId(idParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    const ahora = nowChile();
    const correo = await encolarCorreo(p, { casoId: id, tipo: 'acuse', eventoId: `acuse-${ahora.fecha}-${ahora.hora}`, usuario });
    if (correo === 'sin_cola') throw fallo('La cola de correos de ADLWeb no está disponible. Actualiza y reinicia ADLWeb.', 503);
    if (correo === 'en_cola') await audit('NOTIFICACION', 'inicio', null, `${caso.folio}: acuse de recibo en cola`, usuario);
    return { correo, notificaciones: await loadNotifications(p, id) };
}

/** Notificación manual (inicio / avance / finalización). Solo se agregan: no se editan ni se borran. */
async function agregarNotificacion(idParam, body = {}, usuario) {
    const id = parseId(idParam);
    const etapa = clip(body.etapa, 20);
    if (!ETAPAS[etapa]) throw fallo('Etapa no válida.');
    const notificadoA = clip(body.notificadoA, 300);
    const via = clip(body.via, 100);
    const observaciones = clip(body.observaciones, 2000);
    const fecha = clip(body.fecha, 10);
    if (notificadoA.length < 2) throw fallo('Indica a quién se notificó.');
    if (via.length < 2) throw fallo('Indica la vía de notificación.');
    if (!isValidDate(fecha)) throw fallo('Indica la fecha de la notificación.');
    if (isFuture(fecha)) throw fallo('La fecha de la notificación no puede ser posterior a hoy.');
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    if (fecha < isoDate(caso.fecha_recepcion)) {
        throw fallo(`La fecha de la notificación (${fmtDay(fecha)}) no puede ser anterior a la recepción del caso (${fmtDay(caso.fecha_recepcion)}).`);
    }
    await addNotification(p, { casoId: id, etapa, notificadoA, via, observaciones, fecha, creadoPor: usuario || null });
    await p.request().input('id', sql.Int, id).query('UPDATE dbo.quejas_apelaciones SET actualizado_en = GETDATE() WHERE id = @id');
    await audit('NOTIFICACION', etapa, null, `${caso.folio}: ${ETAPAS[etapa]} → ${notificadoA} (${via})`, usuario);
    return { notificaciones: await loadNotifications(p, id) };
}

// ── Adjuntos (queja original escrita, evidencias) ────────────────────────────
async function adjunto(idParam, adjIdParam) {
    const id = parseId(idParam);
    const adjId = parseId(adjIdParam);
    const p = await pool();
    const r = await p.request().input('id', sql.Int, adjId).input('caso', sql.Int, id)
        .query('SELECT nombre, tipo_mime, contenido FROM dbo.quejas_apelaciones_adjuntos WHERE id = @id AND caso_id = @caso');
    const a = r.recordset[0];
    if (!a) throw fallo('Adjunto no encontrado', 404);
    return { nombre: a.nombre, tipo: ADJ_TIPOS.includes(a.tipo_mime) ? a.tipo_mime : 'application/octet-stream', contenido: Buffer.from(a.contenido) };
}

async function subirAdjunto(idParam, file, descripcion, usuario) {
    const id = parseId(idParam);
    if (!file) throw fallo('Selecciona un archivo PDF o imagen de hasta 5 MB.');
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    await p.request()
        .input('caso_id', sql.Int, id)
        .input('nombre', sql.NVarChar(255), String(file.originalname || 'archivo').slice(0, 255))
        .input('tipo', sql.NVarChar(100), file.mimetype)
        .input('tamano', sql.Int, file.size || file.buffer.length)
        .input('contenido', sql.VarBinary(sql.MAX), file.buffer)
        .input('descripcion', sql.NVarChar(300), clip(descripcion, 300) || null)
        .input('por', sql.NVarChar(100), usuario || null)
        .query(`INSERT INTO dbo.quejas_apelaciones_adjuntos (caso_id, nombre, tipo_mime, tamano, contenido, descripcion, subido_por)
                VALUES (@caso_id, @nombre, @tipo, @tamano, @contenido, @descripcion, @por)`);
    await audit('ADJUNTO', 'adjunto', null, `${caso.folio}: ${String(file.originalname).slice(0, 120)}`, usuario);
    return { adjuntos: await loadAttachments(p, id) };
}

// ── Acciones correctivas (formulario OI-FoGe-02) ─────────────────────────────
// Se abren desde un caso que procede. El caso no se puede cerrar mientras tenga
// acciones correctivas abiertas.
async function abrirAccion(idParam, body = {}, usuario) {
    const id = parseId(idParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    if (caso.estado !== 'en_tratamiento') throw fallo('Las acciones correctivas se abren cuando el caso procede y está en tratamiento.', 409);
    const data = validar(readAccion(body));
    sinFechaPrevia(caso.fecha_recepcion, data);
    const hoy = nowChile().fecha;
    const r = await p.request()
        .input('caso_id', sql.Int, id)
        .input('area', sql.NVarChar(200), data.area || 'Medioambiente')
        .input('fecha_deteccion', sql.Date, dbDate(data.fechaDeteccion || isoDate(caso.fecha_recepcion)))
        .input('fecha_inicio', sql.Date, dbDate(data.fechaInicio || hoy))
        .input('requisito', sql.NVarChar(500), data.requisito || caso.requisito || null)
        .input('hallazgo', sql.NVarChar(sql.MAX), data.hallazgo || caso.motivo)
        .input('por', sql.NVarChar(100), usuario || null)
        .query(`INSERT INTO dbo.qa_acciones_correctivas (caso_id, area, fecha_deteccion, fecha_inicio, requisito, hallazgo, estado, creado_por, actualizado_en)
                OUTPUT INSERTED.id
                VALUES (@caso_id, @area, @fecha_deteccion, @fecha_inicio, @requisito, @hallazgo, 'abierta', @por, GETDATE())`);
    const acId = r.recordset[0].id;
    const folio = `AC-${hoy.slice(0, 4)}-${String(acId).padStart(5, '0')}`;
    await p.request().input('id', sql.Int, acId).input('folio', sql.NVarChar(30), folio)
        .query('UPDATE dbo.qa_acciones_correctivas SET folio = @folio WHERE id = @id');
    await audit('ACCION_CORRECTIVA', 'apertura', null, `${caso.folio}: ${folio}`, usuario);
    return { id: acId, folio, acciones: await loadActions(p, id) };
}

async function guardarAccion(idParam, acIdParam, body = {}, usuario) {
    const id = parseId(idParam);
    const acId = parseId(acIdParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    const ac = await loadAction(p, id, acId);
    if (ac.estado !== 'abierta') throw fallo(`La acción correctiva está ${ac.estado === 'anulada' ? 'anulada' : 'cerrada'}.`, 409);
    const data = validar(readAccion(body));
    sinFechaPrevia(caso.fecha_recepcion, data);
    if (body.cerrar === true) {
        const v = (k, col) => (k in data ? data[k] : ac[col]);
        const procede = 'procedeAc' in data ? data.procedeAc : (ac.procede_ac === null ? null : Boolean(ac.procede_ac));
        if (procede === null) throw fallo('Indica si procede una acción correctiva.');
        if (procede) {
            if (String(v('accion', 'accion_propuesta') || '').length < 5) throw fallo('Describe la acción correctiva propuesta.');
            if (String(v('responsable', 'responsable') || '').length < 2) throw fallo('Indica el responsable de implementación.');
            if (!v('plazo', 'plazo')) throw fallo('Indica el plazo de implementación.');
            if (String(v('eficacia', 'eficacia') || '').length < 5) throw fallo('Describe la comprobación de la eficacia.');
            const ce = 'causaEliminada' in data ? data.causaEliminada : ac.causa_eliminada;
            if (ce === null || ce === undefined) throw fallo('Indica si la causa fue eliminada.');
        }
        if (String(v('cierreNombre', 'cierre_nombre') || '').length < 2 || !v('cierreFecha', 'cierre_fecha')) throw fallo('Indica el nombre y la fecha de cierre.');
    }
    const cambios = await applyUpdate(p, ac, data, AC_COLS, [], 'qa_acciones_correctivas');
    if (body.cerrar === true) {
        await p.request().input('id', sql.Int, acId).input('por', sql.NVarChar(100), usuario || null)
            .query("UPDATE dbo.qa_acciones_correctivas SET estado = 'cerrada', cerrado_por = @por, actualizado_en = GETDATE() WHERE id = @id");
    }
    if (cambios.length || body.cerrar) {
        await audit(body.cerrar ? 'ACCION_CORRECTIVA_CIERRE' : 'ACCION_CORRECTIVA', cambios.join(','), null, `${caso.folio}: ${ac.folio}`, usuario);
    }
    return { cambios, acciones: await loadActions(p, id) };
}

// Anular una acción correctiva levantada por error. No se borra: queda "Anulada"
// con motivo, autor y fecha, y deja de bloquear el cierre del caso.
async function anularAccion(idParam, acIdParam, motivoParam, usuario) {
    const id = parseId(idParam);
    const acId = parseId(acIdParam);
    const motivo = clip(motivoParam, 2000);
    if (motivo.length < 10) throw fallo('Explica por qué se anula (al menos 10 caracteres): queda registrado.');
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    const ac = await loadAction(p, id, acId);
    if (caso.estado !== 'en_tratamiento') throw fallo('Solo se anulan acciones de un caso en tratamiento.', 409);
    if (ac.estado === 'cerrada') throw fallo('La acción correctiva ya está cerrada: no se puede anular.', 409);
    if (ac.estado === 'anulada') throw fallo('La acción correctiva ya está anulada.', 409);
    await p.request().input('id', sql.Int, acId).input('motivo', sql.NVarChar(2000), motivo).input('por', sql.NVarChar(100), usuario || null)
        .query("UPDATE dbo.qa_acciones_correctivas SET estado = 'anulada', anulacion_motivo = @motivo, anulada_por = @por, anulada_en = GETDATE(), actualizado_en = GETDATE() WHERE id = @id");
    await audit('ACCION_CORRECTIVA_ANULADA', ac.folio, 'abierta', `${caso.folio}: ${ac.folio} anulada. Motivo: ${motivo}`, usuario);
    return { acciones: await loadActions(p, id) };
}

async function formularioAccion(idParam, acIdParam, usuario) {
    const id = parseId(idParam);
    const acId = parseId(acIdParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    const ac = await loadAction(p, id, acId);
    const buffer = buildCorrectiveActionOdt(acView(ac), view(caso));
    await audit('FORMULARIO', 'OI-FoGe-02', null, `${caso.folio}: ${ac.folio} formulario generado`, usuario);
    return { buffer, nombre: `OI-FoGe-02 ${ac.folio}.odt` };
}

// ── Historial del caso (línea de tiempo) ─────────────────────────────────────
// Reúne lo que ya se guarda (no hay tablas nuevas): recepción, notificaciones,
// correos de la cola, decisiones y reaperturas, acciones correctivas, adjuntos,
// cierre y el registro de auditoría (ADL-One y panel de ADLWeb).
const enFecha = (d, hora) => {
    // DATE (sin hora) → mediodía local, para ordenar junto a los DATETIME.
    const iso = isoDate(d);
    if (!iso) return null;
    const [y, m, dd] = iso.split('-').map(Number);
    const [hh, mi] = hora && TIME_RE.test(hora) ? hora.split(':').map(Number) : [12, 0];
    return new Date(y, m - 1, dd, hh, mi).toISOString();
};
const enMomento = (d) => (d ? new Date(d).toISOString() : null);

async function loadCorreos(p, casoId) {
    try {
        const r = await p.request().input('id', sql.Int, casoId)
            .query('SELECT id, tipo, evento_id, estado, intentos, ultimo_error, solicitado_por, origen, creado_en, tomado_en, enviado_en FROM dbo.qa_correos_pendientes WHERE caso_id = @id ORDER BY id');
        return r.recordset;
    } catch (e) {
        if (e.number === 208) return []; // la cola aún no existe (ADLWeb sin actualizar)
        throw e;
    }
}

const CORREO_LABEL = { acuse: 'Acuse de recibo', tratamiento: 'Aviso de paso a tratamiento', no_procede: 'Respuesta formal (no procede)', cierre: 'Respuesta formal y cierre' };
const CORREO_ESTADO = { pendiente: 'En cola', enviando: 'Enviándose', enviado: 'Enviado', error: 'Error', revisar: 'Revisar', descartado: 'Descartado' };

async function historial(idParam) {
    const id = parseId(idParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    const [notifs, acciones, adjuntos, correos] = await Promise.all([loadNotifications(p, id), loadActions(p, id), loadAttachments(p, id), loadCorreos(p, id)]);
    const ev = [];
    const add = (fecha, tipo, titulo, detalle = null, por = null, extra = {}) => { if (fecha) ev.push({ fecha, tipo, titulo, detalle, por, ...extra }); };

    add(enFecha(caso.fecha_recepcion, caso.hora_recepcion), 'recepcion',
        `${TIPOS[caso.tipo]} recibida ${caso.canal === 'web' ? 'por el formulario web' : 'y registrada en el panel'}`,
        [caso.empresa, caso.nombre, caso.via_ingreso && `Vía: ${caso.via_ingreso}`].filter(Boolean).join(' · '), caso.creado_por);
    for (const n of notifs) {
        add(n.automatico ? enMomento(n.creado_en) : enFecha(n.fecha), 'notificacion', `Notificación: ${ETAPAS[n.etapa] || n.etapa}`,
            [`A ${n.notificado_a}`, `vía ${n.via}`, n.observaciones].filter(Boolean).join(' · '), n.automatico ? 'Sistema (correo)' : n.creado_por);
    }
    for (const c of correos) {
        add(enMomento(c.creado_en), 'correo', `Correo en cola: ${CORREO_LABEL[c.tipo] || c.tipo}`, `Pedido desde ${c.origen === 'adlone' ? 'ADL ONE' : 'ADLWeb'}`, c.solicitado_por);
        if (c.estado === 'enviado') add(enMomento(c.enviado_en), 'correo', `Correo enviado: ${CORREO_LABEL[c.tipo] || c.tipo}`, `A ${caso.correo}`, 'ADLWeb');
        else if (['error', 'revisar', 'descartado'].includes(c.estado)) {
            add(enMomento(c.tomado_en || c.creado_en), 'alerta', `Correo ${CORREO_ESTADO[c.estado].toLowerCase()}: ${CORREO_LABEL[c.tipo] || c.tipo}`, c.ultimo_error, 'ADLWeb');
        }
    }
    for (const h of parseHistorial(caso.evaluacion_historial)) {
        add(enMomento(h.fecha), 'reapertura', REAPERTURAS[h.tipo] || h.tipo,
            [h.responsableAnterior && `Responsable anterior: ${h.responsableAnterior}`, h.decisionAnterior && `Decisión anulada: ${h.decisionAnterior}`, `Motivo: ${h.motivo}`].filter(Boolean).join(' · '), h.por);
    }
    if (caso.procede !== null && caso.procede !== undefined && caso.fecha_evaluacion) {
        add(enFecha(caso.fecha_evaluacion), 'decision', `Decisión: ${caso.procede ? 'procede' : 'no procede'}`,
            [caso.causa && `Causa: ${caso.causa}`, caso.responsable && `Responsable: ${caso.responsable}`].filter(Boolean).join(' · '), caso.evaluado_por);
    }
    for (const a of acciones) {
        add(enMomento(a.creado_en), 'accion', `Acción correctiva ${a.folio} levantada`, a.hallazgo ? String(a.hallazgo).slice(0, 160) : null, a.creado_por);
        if (a.estado === 'cerrada') add(a.cierre_fecha ? enFecha(a.cierre_fecha) : enMomento(a.actualizado_en), 'accion', `Acción correctiva ${a.folio} cerrada`, a.cierre_nombre && `Cierra: ${a.cierre_nombre}`, a.cerrado_por);
        if (a.estado === 'anulada') add(enMomento(a.anulada_en), 'alerta', `Acción correctiva ${a.folio} anulada`, a.anulacion_motivo && `Motivo: ${a.anulacion_motivo}`, a.anulada_por);
    }
    for (const a of adjuntos) add(enMomento(a.creado_en), 'adjunto', `Adjunto: ${a.nombre}`, a.descripcion, a.subido_por);
    if (CERRADOS.includes(caso.estado) && caso.cerrado_en) {
        add(enMomento(caso.cerrado_en), 'cierre', caso.estado === 'cerrada' ? 'Caso cerrado' : 'Caso cerrado: no procede',
            caso.aprobado_por ? `Aprobó: ${caso.aprobado_por}` : null, caso.cerrado_por);
    }
    ev.sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Registro de auditoría completo (lo que hizo cada usuario, en ADL-One o en ADLWeb).
    let auditoria = [];
    try {
        const r = await p.request().input('q', sql.NVarChar(80), `%${caso.folio}:%`).query(`
            SELECT TOP 300 operacion, campo, valor_nuevo, usuario_api, fecha_hora
            FROM registro_auditoria WHERE tabla = 'quejas_apelaciones' AND valor_nuevo LIKE @q ORDER BY fecha_hora, id`);
        auditoria = r.recordset.map((a) => {
            let texto = a.valor_nuevo;
            try { texto = JSON.parse(a.valor_nuevo); } catch { /* texto plano */ }
            return { fecha: enMomento(a.fecha_hora), operacion: a.operacion, campo: a.campo, detalle: String(texto || '').replace(`${caso.folio}: `, ''), por: a.usuario_api };
        });
    } catch (e) {
        logger.warn(`[Quejas y apelaciones] No se pudo leer la auditoría del caso ${caso.folio}: ${e.message}`);
    }
    return { eventos: ev, auditoria };
}

// ── Correos del caso (cola de ADLWeb) ────────────────────────────────────────
async function correos(idParam) {
    const id = parseId(idParam);
    const p = await pool();
    await mustLoadCase(p, id);
    return (await loadCorreos(p, id)).map((c) => ({ ...c, tipoLabel: CORREO_LABEL[c.tipo] || c.tipo, estadoLabel: CORREO_ESTADO[c.estado] || c.estado }));
}

/**
 * Vuelve a poner en cola un correo con error (agotó los reintentos) o en "revisar" (quedó a medio enviar).
 * En "revisar" lo decide una persona tras confirmar con el cliente que NO le llegó, para no duplicarlo.
 */
async function reintentarCorreo(idParam, correoIdParam, usuario) {
    const id = parseId(idParam);
    const correoId = parseId(correoIdParam);
    const p = await pool();
    const caso = await mustLoadCase(p, id);
    const r = await p.request().input('id', sql.Int, correoId).input('caso', sql.Int, id).input('por', sql.NVarChar(100), usuario || null).query(`
        UPDATE dbo.qa_correos_pendientes
        SET estado = 'pendiente', intentos = 0, tomado_en = NULL,
            ultimo_error = CONCAT(N'Reintento pedido por ', @por, N'. Antes: ', ultimo_error)
        OUTPUT INSERTED.tipo
        WHERE id = @id AND caso_id = @caso AND estado IN ('error', 'revisar')`);
    if (!r.recordset.length) throw fallo('Solo se reintentan correos con error o en revisión.', 409);
    await audit('CORREO_REINTENTO', r.recordset[0].tipo, null, `${caso.folio}: correo "${r.recordset[0].tipo}" vuelto a la cola`, usuario);
    return correos(id);
}

// ── Usuarios de ADL-One (selectores de responsable, aprobador y jefe de área) ─
// Solo lectura sobre la base de ADL-One. El campo sigue siendo texto: se puede escribir otro nombre.
async function usuarios() {
    const p = await getConnection();
    const r = await p.request().query(`
        SELECT u.id_usuario, LTRIM(RTRIM(u.usuario)) AS nombre, LTRIM(RTRIM(c.nombre_cargo)) AS cargo
        FROM mae_usuario u LEFT JOIN mae_cargo c ON c.id_cargo = u.id_cargo
        WHERE u.habilitado = 'S' AND LEN(LTRIM(RTRIM(ISNULL(u.usuario, '')))) > 1
        ORDER BY u.usuario`);
    return r.recordset;
}

export default {
    listar, estadistica, obtener, formulario, crear, editarRegistro, guardarEvaluacion, reabrirEvaluacion,
    guardarTratamiento, enviarAcuse, agregarNotificacion, adjunto, subirAdjunto, abrirAccion, guardarAccion,
    anularAccion, formularioAccion, historial, correos, reintentarCorreo, usuarios,
};

// Para pruebas.
export { addBusinessDays, readRegistro, antesDeRecepcion };
