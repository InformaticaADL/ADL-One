// =============================================================================
// Trasladado desde ADLWeb (api-backend-adlclone/quality-form-odt.js) para
// administrar Quejas y apelaciones desde ADL-One. Misma lógica; solo cambia
// de CommonJS a ESM y la ubicación de las plantillas
// (src/templates/quejas-apelaciones/). Si se cambia un lado, cambiar el otro.
// =============================================================================
// =============================================================================
// Formulario OI-FoGe-05 "Quejas y Apelaciones" v01 (Gestión de Calidad).
//
// Se usa el archivo original (templates/OI-FoGe-05-quejas-apelaciones-v01.odt)
// tal cual: solo se escribe texto dentro de las casillas vacías del formulario.
// Encabezado, firmas, logo, estilos, márgenes y pie quedan idénticos.
//
// Cada casilla se ubica por el estilo de su párrafo vacío (único en el
// documento). Si alguien reemplaza la plantilla por otra versión y alguna
// casilla ya no existe, se avisa en el registro del servidor y no se escribe.
//
// Sin dependencias: lectura y escritura ZIP con zlib (el .odt es un ZIP).
// =============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'quejas-apelaciones');

const TEMPLATE = path.join(TEMPLATES_DIR, 'OI-FoGe-05-quejas-apelaciones-v01.odt');

// Casilla del formulario → estilo del párrafo vacío que la ocupa.
const FIELDS = {
  numero: 'P78',
  marcaQueja: 'P121', marcaApelacion: 'P125', marcaInterno: 'P140', marcaExterno: 'P144',
  empresa: 'P156', nombre: 'P166', fechaRecepcion: 'P174', mail: 'P181', horaRecepcion: 'P189',
  fono: 'P196', fechaTratamiento: 'P204',
  motivo: 'P212', tratamiento: 'P218', conclusiones: 'P224', participantes: 'TableContents',
  inicioNotificadoA: 'P247', inicioFecha: 'P255', inicioVia: 'P262', inicioObs: 'P277',
  avanceNotificadoA: 'P294', avanceFecha: 'P302', avanceVia: 'P309', avanceObs: 'P324',
  finNotificadoA: 'P342', finFecha: 'P350', finVia: 'P357', finObs: 'P372',
};

// Títulos de Motivo, Tratamiento, Conclusiones y Participantes.
const KEEP_WITH_NEXT = ['P207', 'P213', 'P219', 'P225'];
const GROWING_ROWS = ['TableRow210', 'TableRow216', 'TableRow222'];

// ── ZIP mínimo ───────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('La plantilla no es un archivo .odt válido.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Directorio ZIP dañado.');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const raw = buf.subarray(local + 30 + lNameLen + lExtraLen, local + 30 + lNameLen + lExtraLen + csize);
    const data = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
    entries.push({ name, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// "mimetype" va primero y sin comprimir (requisito de ODF).
function writeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const ordered = [...entries.filter((e) => e.name === 'mimetype'), ...entries.filter((e) => e.name !== 'mimetype')];
  for (const e of ordered) {
    const store = e.name === 'mimetype' || /\.(jpe?g|png|gif)$/i.test(e.name);
    const body = store ? e.data : zlib.deflateRawSync(e.data);
    const name = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres UTF-8
    local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt32LE(0x00210000, 10); // fecha fija (1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(store ? 0 : 8, 10);
    central.writeUInt32LE(0x00210000, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(ordered.length, 8);
  end.writeUInt16LE(ordered.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// ── Relleno ──────────────────────────────────────────────────────────────────
const xmlEscape = (v) => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Caracteres de control no válidos en XML.
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

// Texto con saltos de línea → párrafo ODF (espacios múltiples y tabs incluidos).
// paragraphStyle: cada línea va en su propio párrafo con ese estilo (así una
// casilla con texto justificado no estira la línea anterior a un salto).
function odfText(value, paragraphStyle = null) {
  const sep = paragraphStyle ? `</text:p><text:p text:style-name="${paragraphStyle}">` : '<text:line-break/>';
  return String(value).replace(/\r\n?/g, '\n').split('\n').map((line) => xmlEscape(line)
    .replace(/\t/g, '<text:tab/>')
    .replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`))
    .join(sep);
}

// fields: casilla → estilo de su párrafo VACÍO (se escribe dentro).
// append: casilla → estilo de un párrafo con etiqueta ("Participantes:"): el
//         valor se agrega a continuación de la etiqueta, en el mismo renglón.
function fillContent(xml, values, { fields = FIELDS, append = {}, growRows = GROWING_ROWS, keepWithNext = [], label = 'OI-FoGe-05' } = {}) {
  let out = xml;
  // Títulos de casilla ("Conclusiones:"…): "conservar con el siguiente", para
  // que si la casilla pasa a la página siguiente el título pase con ella.
  for (const st of keepWithNext) {
    const re = new RegExp(`(<style:style style:name="${st}"[^>]*>)([\\s\\S]*?)(</style:style>)`);
    out = out.replace(re, (m, open, body, close) => {
      if (/fo:keep-with-next=/.test(body)) return m;
      const withPP = /<style:paragraph-properties(?=[\s/>])/.test(body)
        ? body.replace(/<style:paragraph-properties(?=[\s/>])/, '<style:paragraph-properties fo:keep-with-next="always"')
        : `<style:paragraph-properties fo:keep-with-next="always"/>${body}`;
      return `${open}${withPP}${close}`;
    });
  }
  const faltan = [];
  const has = (v) => !(v === undefined || v === null || v === '');
  for (const [key, style] of Object.entries(fields)) {
    const v = values[key];
    if (!has(v)) continue;
    const empty = `<text:p text:style-name="${style}"/>`;
    const i = out.indexOf(empty);
    if (i < 0) { faltan.push(key); continue; }
    // Solo las casillas con texto justificado se separan en párrafos (un salto
    // de línea estiraría la línea anterior); el resto usa saltos de línea para
    // no agregar el espacio entre párrafos de la plantilla.
    const def = out.match(new RegExp(`<style:style style:name="${style}"[^>]*>([\\s\\S]*?)</style:style>`));
    const justified = Boolean(def && /fo:text-align="justify"/.test(def[1]));
    out = `${out.slice(0, i)}<text:p text:style-name="${style}">${odfText(v, justified ? style : null)}</text:p>${out.slice(i + empty.length)}`;
  }
  for (const [key, style] of Object.entries(append)) {
    const v = values[key];
    if (!has(v)) continue;
    const open = out.indexOf(`<text:p text:style-name="${style}">`);
    const close = open < 0 ? -1 : out.indexOf('</text:p>', open);
    if (close < 0) { faltan.push(key); continue; }
    out = `${out.slice(0, close)} ${odfText(v)}${out.slice(close)}`;
  }
  if (faltan.length) console.warn(`⚠️ Formulario ${label}: casillas no encontradas en la plantilla: ${faltan.join(', ')}`);
  // Casillas de texto con alto FIJO en la plantilla: un texto largo quedaría
  // cortado. Se usa la misma medida como alto MÍNIMO (si el texto cabe, el
  // formulario se ve idéntico; si no, la casilla crece).
  for (const row of growRows) {
    out = out.replace(
      new RegExp(`(<style:style style:name="${row}"[^>]*>\\s*<style:table-row-properties )style:row-height=`),
      '$1style:min-row-height=',
    );
  }
  return out;
}

const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '');
const lines = (...parts) => parts.filter((p) => p && String(p).trim()).join('\n');
// Cada renglón con "- " para distinguir un dato de otro (si ya trae un guion o
// viñeta, se respeta). Los renglones vacíos se omiten.
const bullets = (text) => String(text || '').replace(/\r\n?/g, '\n').split('\n')
  .map((l) => l.trim()).filter(Boolean)
  .map((l) => (/^[-•–*]\s/.test(l) ? l : `- ${l}`)).join('\n');

/** Datos del caso → texto de cada casilla del formulario. */
function formValues(c) {
  const notif = (etapa) => (c.notificaciones || []).filter((n) => n.etapa === etapa);
  const stage = (etapa) => {
    const items = notif(etapa);
    // Una línea por notificación, alineadas en las cuatro casillas de la etapa.
    return {
      notificadoA: items.map((n) => n.notificado_a).join('\n'),
      fecha: items.map((n) => fmtDate(n.fecha)).join('\n'),
      via: items.map((n) => n.via).join('\n'),
      obs: items.map((n) => (items.length > 1 ? `${fmtDate(n.fecha)}: ${n.observaciones || '—'}` : n.observaciones || '')).join('\n'),
    };
  };
  const ini = stage('inicio');
  const ava = stage('avance');
  const fin = stage('finalizacion');
  const evaluado = c.procede === true || c.procede === false;
  const acs = (c.acciones || []).map((a) => `${a.folio} (${a.estado === 'anulada' ? 'anulada por error' : a.estado === 'cerrada' ? 'cerrada' : 'abierta'})`);
  const tratamiento = lines(
    c.emisorLabel && `Presentada por: ${c.emisorLabel}${c.via_ingreso ? ` · Vía de ingreso: ${c.via_ingreso}` : ''}`,
    c.tipo === 'apelacion' && c.reunion_fecha && `Reunión de análisis (${fmtDate(c.reunion_fecha)}): ${c.reunion_asistentes || ''}${c.reunion_directrices ? `. Directrices: ${c.reunion_directrices}` : ''}`,
    // Reasignaciones y decisiones anuladas: quedan en el registro del caso.
    ...(Array.isArray(c.evaluacion_historial) ? c.evaluacion_historial : []).map((h) =>
      `${h.tipo === 'anulacion' ? `Decisión anulada (${h.decisionAnterior || ''})` : 'Responsable reasignado'} el ${fmtDate(h.dia || String(h.fecha || '').slice(0, 10))}${h.responsableAnterior ? ` (responsable anterior: ${h.responsableAnterior})` : ''}${h.por ? ` por ${h.por}` : ''}. Motivo: ${h.motivo}`),
    evaluado && `Evaluación (${fmtDate(c.fecha_evaluacion)}): ${c.procede ? 'procede' : 'no procede'}${c.relacionada_actividades === false ? ' (no se relaciona con las actividades del laboratorio)' : ''}. ${c.evaluacion || ''}`.trim(),
    c.causa && `Causa: ${c.causa}`,
    c.requisito && `Requisito afectado: ${c.requisito}`,
    c.responsable && `Responsable: ${c.responsable}`,
    c.jefe_area && `Jefe de área que investiga: ${c.jefe_area}`,
    (c.requiere_tnc || c.requiere_auditoria) && `Requiere: ${[c.requiere_tnc && 'trabajo no conforme', c.requiere_auditoria && 'auditoría'].filter(Boolean).join(' y ')}.`,
    c.analisis_causa && `Análisis de causa: ${c.analisis_causa}`,
    acs.length && `Acciones correctivas (OI-FoGe-02): ${acs.join(', ')}`,
    c.acciones_correctivas && `Acciones correctivas: ${c.acciones_correctivas}`,
    c.acciones_preventivas && `Acciones preventivas: ${c.acciones_preventivas}`,
    c.tratamiento,
  );
  const noProcede = c.procede === false;
  const conclusiones = lines(
    c.conclusiones || (noProcede && `La ${c.tipo === 'apelacion' ? 'apelación' : 'queja'} no procede${c.relacionada_actividades === false ? ': no se relaciona con las actividades del laboratorio' : ''}. Caso cerrado en la evaluación.`),
    c.respuesta_formal && `Respuesta formal: ${c.respuesta_formal}`,
    c.aprobado_por ? `Revisada y aprobada por: ${c.aprobado_por}` : (noProcede && c.responsable && `Decisión tomada por: ${c.responsable}${c.responsable_independiente ? ' (no participó en la actividad en cuestión)' : ''}`),
    c.eficacia && `Verificación de eficacia: ${c.eficacia}`,
  );
  // Participantes: los del tratamiento; si el caso no llegó a tratamiento
  // (no procede), quienes participaron en la evaluación.
  const participantes = c.participantes || lines(
    c.tipo === 'apelacion' && c.reunion_asistentes,
    c.responsable && `${c.responsable} (responsable del caso)`,
    c.jefe_area && `${c.jefe_area} (jefe de área)`,
  );
  // En un caso que no procede no hay avance: se deja constancia.
  if (noProcede && !notif('avance').length) ava.obs = 'No aplica: el caso se cerró en la evaluación (no procede).';
  // Fecha de tratamiento de casos antiguos que no procedieron: la de la evaluación.
  const fechaTratamiento = c.fecha_tratamiento || (noProcede ? c.fecha_evaluacion : '');
  return {
    numero: c.folio,
    marcaQueja: c.tipo === 'queja' ? 'X' : '',
    marcaApelacion: c.tipo === 'apelacion' ? 'X' : '',
    marcaInterno: c.origen === 'interno' ? 'X' : '',
    marcaExterno: c.origen === 'externo' ? 'X' : '',
    empresa: c.empresa, nombre: c.nombre, mail: c.correo, fono: c.telefono,
    fechaRecepcion: fmtDate(c.fecha_recepcion), horaRecepcion: c.hora_recepcion, fechaTratamiento: fmtDate(fechaTratamiento),
    motivo: c.motivo, tratamiento: bullets(tratamiento), conclusiones: bullets(conclusiones), participantes: bullets(participantes),
    inicioNotificadoA: ini.notificadoA, inicioFecha: ini.fecha, inicioVia: ini.via, inicioObs: ini.obs,
    avanceNotificadoA: ava.notificadoA, avanceFecha: ava.fecha, avanceVia: ava.via, avanceObs: ava.obs,
    finNotificadoA: fin.notificadoA, finFecha: fin.fecha, finVia: fin.via, finObs: fin.obs,
  };
}

function buildOdt(templatePath, values, opts) {
  const entries = readZip(fs.readFileSync(templatePath));
  const content = entries.find((e) => e.name === 'content.xml');
  if (!content) throw new Error('La plantilla no tiene content.xml.');
  content.data = Buffer.from(fillContent(content.data.toString('utf8'), values, opts), 'utf8');
  return writeZip(entries);
}

/** Genera el .odt del formulario OI-FoGe-05 con los datos del caso. */
function buildQualityFormOdt(caso, templatePath = TEMPLATE) {
  return buildOdt(templatePath, formValues(caso), { keepWithNext: KEEP_WITH_NEXT });
}

// ── Formulario OI-FoGe-02 "Acción Correctiva" v02 ───────────────────────────
const AC_TEMPLATE = path.join(TEMPLATES_DIR, 'OI-FoGe-02-accion-correctiva-v02.odt');
const AC_FIELDS = {
  numero: 'P71', area: 'P104', fechaDeteccion: 'P118', fechaInicio: 'P122', detectadoPor: 'P146', requisito: 'P154',
  // Origen (casillas): se marca Queja o Apelación según el caso.
  marcaAuditoriaInterna: 'P109', marcaQueja: 'P113', marcaAuditoria2: 'P127', marcaRevisionGerencia: 'P131',
  marcaAuditoria3: 'P139', marcaAutodetectada: 'P143', marcaApelacion: 'P160', marcaOtro: 'P164',
  hallazgo: 'P174', justificacion: 'P180', correccion: 'P186', procedeSi: 'P195', procedeNo: 'P199',
  alcance: 'P214', accion: 'P222', responsable: 'P232', plazo: 'P234', fechaSeguimiento: 'P236',
  cumplePlazoSi: 'P244', cumplePlazoNo: 'P248', observaciones: 'P257',
  s1Fecha: 'P282', s1Cumplimiento: 'P286', s1Responsable: 'P290',
  s2Fecha: 'P301', s2Cumplimiento: 'P305', s2Responsable: 'P309',
  s3Fecha: 'P320', s3Cumplimiento: 'P324', s3Responsable: 'P328',
  eficacia: 'P340', causaEliminadaSi: 'P347', causaEliminadaNo: 'P355', ncSi: 'P364', ncNo: 'P368',
  observacionesFinales: 'P376', cierreNombre: 'P386', cierreFecha: 'P388',
};
const AC_APPEND = { participantes: 'P205', tecnica: 'P208', s1Obs: 'P293', s2Obs: 'P312', s3Obs: 'P331' };
const AC_GROW = ['TableRow172', 'TableRow178', 'TableRow184', 'TableRow212', 'TableRow220', 'TableRow291', 'TableRow310', 'TableRow329'];

const mark = (cond) => (cond ? 'X' : '');
function acValues(ac, caso) {
  const seg = Array.isArray(ac.seguimientos) ? ac.seguimientos : [];
  const s = (i) => seg[i] || {};
  const cumple = (v) => (v === true ? 'Sí' : v === false ? 'No' : v || '');
  return {
    numero: ac.folio, area: ac.area, fechaDeteccion: fmtDate(ac.fecha_deteccion), fechaInicio: fmtDate(ac.fecha_inicio),
    detectadoPor: ac.detectado_por, requisito: ac.requisito,
    marcaQueja: mark(caso && caso.tipo === 'queja'), marcaApelacion: mark(caso && caso.tipo === 'apelacion'),
    hallazgo: [ac.hallazgo, caso && `(${caso.tipoLabel || caso.tipo} N° ${caso.folio})`].filter(Boolean).join(' '),
    justificacion: ac.justificacion, correccion: ac.correccion_inmediata,
    procedeSi: mark(ac.procede_ac === true), procedeNo: mark(ac.procede_ac === false),
    participantes: ac.participantes, tecnica: ac.tecnica, alcance: ac.alcance, accion: ac.accion_propuesta,
    responsable: ac.responsable, plazo: fmtDate(ac.plazo), fechaSeguimiento: fmtDate(ac.fecha_seguimiento),
    cumplePlazoSi: mark(ac.cumplimiento_plazo === true), cumplePlazoNo: mark(ac.cumplimiento_plazo === false),
    observaciones: ac.observaciones,
    s1Fecha: fmtDate(s(0).fecha), s1Cumplimiento: cumple(s(0).cumplimiento), s1Responsable: s(0).responsable, s1Obs: s(0).observaciones,
    s2Fecha: fmtDate(s(1).fecha), s2Cumplimiento: cumple(s(1).cumplimiento), s2Responsable: s(1).responsable, s2Obs: s(1).observaciones,
    s3Fecha: fmtDate(s(2).fecha), s3Cumplimiento: cumple(s(2).cumplimiento), s3Responsable: s(2).responsable, s3Obs: s(2).observaciones,
    eficacia: ac.eficacia, causaEliminadaSi: mark(ac.causa_eliminada === true), causaEliminadaNo: mark(ac.causa_eliminada === false),
    ncSi: mark(ac.se_levanta_nc === true), ncNo: mark(ac.se_levanta_nc === false),
    observacionesFinales: ac.observaciones_finales, cierreNombre: ac.cierre_nombre, cierreFecha: fmtDate(ac.cierre_fecha),
  };
}

/** Genera el .odt del formulario OI-FoGe-02 (Acción Correctiva) con los datos de la acción. */
function buildCorrectiveActionOdt(ac, caso, templatePath = AC_TEMPLATE) {
  return buildOdt(templatePath, acValues(ac, caso), { fields: AC_FIELDS, append: AC_APPEND, growRows: AC_GROW, label: 'OI-FoGe-02' });
}

export {
  buildQualityFormOdt, buildCorrectiveActionOdt, formValues, acValues, fillContent, readZip, writeZip,
  FIELDS, TEMPLATE, AC_FIELDS, AC_APPEND, AC_TEMPLATE,
};
