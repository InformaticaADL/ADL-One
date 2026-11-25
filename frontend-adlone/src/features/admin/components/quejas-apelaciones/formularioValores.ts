import type { Caso, Notificacion } from '../../services/quejasApelaciones.service';

// =============================================================================
// Textos de cada casilla del formulario OI-FoGe-05 "Quejas y Apelaciones".
// Misma regla que rellena el .odt oficial en el servidor
// (api-backend-adlone/src/services/quejasApelaciones.odt.js → formValues), así la
// vista previa en pantalla muestra lo mismo que el documento que se descarga.
// =============================================================================

export interface NotifCasilla { notificadoA: string; fecha: string; via: string; obs: string }
export interface ValoresFormulario {
    numero: string; tipo: string; origen: string;
    empresa: string; nombre: string; mail: string; fono: string;
    fechaRecepcion: string; horaRecepcion: string; fechaTratamiento: string;
    motivo: string; tratamiento: string; conclusiones: string; participantes: string;
    inicio: NotifCasilla; avance: NotifCasilla; fin: NotifCasilla;
}
/** Casillas que se pueden resaltar mientras se editan. */
export type CampoFormulario = keyof Omit<ValoresFormulario, 'inicio' | 'avance' | 'fin'>;

const fmtDate = (d?: string | null) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '');
const lines = (...parts: (string | false | null | undefined | 0)[]) => parts.filter((p) => p && String(p).trim()).join('\n');
// Cada renglón con "- " para distinguir un dato de otro (si ya trae guion o viñeta, se respeta).
const bullets = (text: string) => String(text || '').replace(/\r\n?/g, '\n').split('\n')
    .map((l) => l.trim()).filter(Boolean)
    .map((l) => (/^[-•–*]\s/.test(l) ? l : `- ${l}`)).join('\n');
const VACIA: NotifCasilla = { notificadoA: '', fecha: '', via: '', obs: '' };

function etapa(notificaciones: Notificacion[], e: string): NotifCasilla {
    const items = notificaciones.filter((n) => n.etapa === e);
    if (!items.length) return { ...VACIA };
    return {
        notificadoA: items.map((n) => n.notificado_a).join('\n'),
        fecha: items.map((n) => fmtDate(n.fecha)).join('\n'),
        via: items.map((n) => n.via).join('\n'),
        obs: items.map((n) => (items.length > 1 ? `${fmtDate(n.fecha)}: ${n.observaciones || '—'}` : n.observaciones || '')).join('\n'),
    };
}

/** Valores a partir de un caso guardado (todas las etapas). */
export function valoresDeCaso(c: Caso): ValoresFormulario {
    const evaluado = c.procede === true || c.procede === false;
    const noProcede = c.procede === false;
    const acs = (c.acciones || []).map((a) => `${a.folio} (${a.estado === 'anulada' ? 'anulada por error' : a.estado === 'cerrada' ? 'cerrada' : 'abierta'})`);
    const tratamiento = lines(
        c.emisorLabel && `Presentada por: ${c.emisorLabel}${c.via_ingreso ? ` · Vía de ingreso: ${c.via_ingreso}` : ''}`,
        c.tipo === 'apelacion' && c.reunion_fecha && `Reunión de análisis (${fmtDate(c.reunion_fecha)}): ${c.reunion_asistentes || ''}${c.reunion_directrices ? `. Directrices: ${c.reunion_directrices}` : ''}`,
        ...(c.evaluacion_historial || []).map((h) =>
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
    const conclusiones = lines(
        c.conclusiones || (noProcede && `La ${c.tipo === 'apelacion' ? 'apelación' : 'queja'} no procede${c.relacionada_actividades === false ? ': no se relaciona con las actividades del laboratorio' : ''}. Caso cerrado en la evaluación.`),
        c.respuesta_formal && `Respuesta formal: ${c.respuesta_formal}`,
        c.aprobado_por ? `Revisada y aprobada por: ${c.aprobado_por}` : (noProcede && c.responsable && `Decisión tomada por: ${c.responsable}${c.responsable_independiente ? ' (no participó en la actividad en cuestión)' : ''}`),
        c.eficacia && `Verificación de eficacia: ${c.eficacia}`,
    );
    const participantes = c.participantes || lines(
        c.tipo === 'apelacion' && c.reunion_asistentes,
        c.responsable && `${c.responsable} (responsable del caso)`,
        c.jefe_area && `${c.jefe_area} (jefe de área)`,
    );
    const avance = etapa(c.notificaciones || [], 'avance');
    if (noProcede && !avance.notificadoA) avance.obs = 'No aplica: el caso se cerró en la evaluación (no procede).';
    return {
        numero: c.folio, tipo: c.tipo, origen: c.origen,
        empresa: c.empresa, nombre: c.nombre, mail: c.correo, fono: c.telefono,
        fechaRecepcion: fmtDate(c.fecha_recepcion), horaRecepcion: c.hora_recepcion,
        fechaTratamiento: fmtDate(c.fecha_tratamiento || (noProcede ? c.fecha_evaluacion : '')),
        motivo: c.motivo, tratamiento: bullets(tratamiento), conclusiones: bullets(conclusiones), participantes: bullets(participantes),
        inicio: etapa(c.notificaciones || [], 'inicio'), avance, fin: etapa(c.notificaciones || [], 'finalizacion'),
    };
}

/** Valores mientras se crea un registro nuevo (solo la parte de registro). */
export function valoresDeRegistro(f: {
    tipo: string; origen: string; empresa: string; nombre: string; correo: string; telefono: string;
    fechaRecepcion: string; horaRecepcion: string; fechaTratamiento: string; motivo: string; emisor: string; viaIngreso: string;
}, emisorLabel: string, enviarAcuse: boolean): ValoresFormulario {
    return {
        numero: '', tipo: f.tipo, origen: f.origen,
        empresa: f.empresa, nombre: f.nombre, mail: f.correo, fono: f.telefono === '+' ? '' : f.telefono,
        fechaRecepcion: fmtDate(f.fechaRecepcion), horaRecepcion: f.horaRecepcion, fechaTratamiento: fmtDate(f.fechaTratamiento),
        motivo: f.motivo,
        tratamiento: bullets(lines(emisorLabel && `Presentada por: ${emisorLabel}${f.viaIngreso ? ` · Vía de ingreso: ${f.viaIngreso}` : ''}`)),
        conclusiones: '', participantes: '',
        // El acuse lo envía ADLWeb desde la cola y lo anota como inicio de proceso.
        inicio: enviarAcuse && f.nombre && f.correo
            ? { notificadoA: `${f.nombre} (${f.correo})`, fecha: fmtDate(f.fechaRecepcion), via: 'Correo electrónico (automático)', obs: 'Acuse de recibo con el número de caso (al guardar).' }
            : { ...VACIA },
        avance: { ...VACIA }, fin: { ...VACIA },
    };
}
