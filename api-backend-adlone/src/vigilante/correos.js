// Redacta los correos del vigilante con el MISMO diseño que el resto de los correos de ADL ONE (notifications/layout/base-layout.js): logo, título,
// insignia de estado, lista de datos y pie de ADL. Solo arma el contenido: no envía nada.
import { renderBaseLayout, renderCamposList, renderObservacion } from '../notifications/layout/base-layout.js';
import { renderOutcomeBadge } from '../notifications/outcomes.js';

export const LOGO_CID = 'logo_adlone';
const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const SERVICIOS = {
    frontend: {
        corto: 'La pantalla web de ADL ONE',
        nombre: 'Pantalla web de ADL ONE',
        proceso: 'adl-one-frontend',
        puerto: 5174,
        detalle: 'Sin esto nadie puede abrir ADL ONE en el navegador.',
    },
    backend: {
        corto: 'El servidor de ADL ONE',
        nombre: 'Servidor de ADL ONE',
        proceso: 'adl-one-backend',
        puerto: 8002,
        detalle: 'Sin esto ADL ONE no carga datos y no se puede trabajar en él.',
    },
    sampling: {
        corto: 'La API de ADL SAMPLING',
        nombre: 'API de ADL SAMPLING (app de terreno)',
        proceso: 'api-mam-adl',
        puerto: 8001,
        detalle: 'Sin esto la app de terreno no puede iniciar sesión, bajar fichas ni subir muestreos.',
    },
};

export const servicioDe = (id) => SERVICIOS[id] || { corto: id, nombre: id, proceso: id, puerto: '', detalle: '' };

/** 135 min → «2 h 15 min»; 4 min → «4 min»; menos de 1 min → «menos de 1 min». */
export function formatoDuracion(ms) {
    const min = Math.max(0, Math.round(ms / 60000));
    if (min < 1) return 'menos de 1 min';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60); const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
}

// «23-11-2026» y «14:30» en horario de Chile, en 24 horas («02:30 p. m.» terminaba la frase con dos puntos).
const partesChile = (ms) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return { fecha: `${p.day}-${p.month}-${p.year}`, hora: `${p.hour}:${p.minute}` };
};
const momentoChile = (ms) => { const { fecha, hora } = partesChile(ms); return `el ${fecha} a las ${hora}`; };
const fechaHoraChile = (ms) => { const { fecha, hora } = partesChile(ms); return `${fecha} ${hora}`; };

const escapar = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Pasos para arreglarlo (solo ese proceso). Mismo contenido para el texto plano y para el HTML.
const pasosDe = (s, servidor) => [
    { texto: `En el servidor ${servidor}, ver el motivo`, comando: `pm2 logs ${s.proceso} --lines 40 --nostream` },
    { texto: 'Detener el proceso', comando: `pm2 stop ${s.proceso}` },
    { texto: `Comprobar que el puerto ${s.puerto} quedó libre (si queda un proceso, cerrarlo)`, comando: `netstat -ano | findstr ":${s.puerto}"` },
    { texto: 'Volver a levantarlo', comando: `pm2 start ${s.proceso}` },
];

const AVISO_IMPORTANTE = 'Usar siempre el nombre del proceso: nunca "pm2 restart" ni "pm2 restart all". Si lo detuviste a propósito (mantención o despliegue), no hace falta hacer nada: el vigilante ignora los procesos detenidos en pm2.';
const AVISO_PAUSA = 'Para silenciar los avisos un rato (mantención con el proceso "online"):   node src/vigilante/pausar.js 30 "motivo"';

// Bloque «Cómo arreglarlo» con el mismo estilo de los bloques de los otros correos (tablas/divs en línea, compatible con Outlook).
const pasosHtml = (pasos) => `<div style="border:1px solid #ededec; border-radius:10px; padding:14px 16px; margin-bottom:22px; font-family:${FONT};">
      <div style="font-size:11px; color:#9b9a97; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">Cómo arreglarlo (solo ese proceso)</div>
      ${pasos.map((p, i) => `<div style="font-size:13px; color:#37352f; line-height:1.5; margin-bottom:${i < pasos.length - 1 ? 12 : 0}px;"><strong style="color:#1f1f1f;">${i + 1}.</strong> ${escapar(p.texto)}<br><span style="display:inline-block; margin-top:5px; background:#f4f4f3; border:1px solid #ededec; border-radius:6px; padding:4px 9px; font-family:Consolas, 'Courier New', monospace; font-size:12px; color:#1f1f1f;">${escapar(p.comando)}</span></div>`).join('')}
    </div>`;

/**
 * @param {{tipo:'CAIDO'|'RECORDATORIO'|'RECUPERADO', desde:number, duracionMs:number, fallos:number, motivo:string|null}} accion
 * @param {'frontend'|'backend'} servicioId
 * @returns {{subject:string, text:string, html:string, logoCid:string}}
 */
export function armarCorreo(accion, servicioId, { servidor = '192.168.10.28' } = {}) {
    const s = servicioDe(servicioId);
    const desde = momentoChile(accion.desde);
    const duracion = formatoDuracion(accion.duracionMs);

    if (accion.tipo === 'RECUPERADO') {
        const subject = `[ADL ONE] ${s.corto} volvió a responder`;
        const text = [
            `${s.corto} volvió a responder.`,
            '',
            `Estuvo sin responder desde ${desde} (${duracion}).`,
            'No hace falta hacer nada más.',
        ].join('\n');
        const html = renderBaseLayout({
            titulo: `${s.corto} volvió a responder`,
            badgeHtml: renderOutcomeBadge('RECUPERADO'),
            resumen: `Estuvo sin responder ${duracion}. No hace falta hacer nada más.`,
            camposHtml: renderCamposList([
                { icono: '🖥️', label: 'Servicio', valor: escapar(s.nombre) },
                { icono: '🕒', label: 'Sin respuesta desde', valor: fechaHoraChile(accion.desde) },
                { icono: '✅', label: 'Volvió a responder', valor: fechaHoraChile(accion.desde + accion.duracionMs) },
                { icono: '⏱️', label: 'Duración', valor: duracion },
            ]),
            logoCid: LOGO_CID,
        });
        return { subject, text, html, logoCid: LOGO_CID };
    }

    const sigue = accion.tipo === 'RECORDATORIO';
    const subject = sigue ? `[ADL ONE] SIGUE SIN RESPONDER: ${s.corto} (hace ${duracion})` : `[ADL ONE] ${s.corto} no responde`;
    const pasos = pasosDe(s, servidor);
    const motivo = accion.motivo || 'sin detalle';

    const text = [
        sigue ? `${s.corto} SIGUE sin responder desde ${desde} (${duracion}).` : `${s.corto} no responde desde ${desde}.`,
        '',
        `Motivo: ${motivo}.`,
        `Comprobaciones seguidas con fallo: ${accion.fallos}.`,
        s.detalle,
        '',
        'Cómo arreglarlo (solo ese proceso):',
        ...pasos.map((p, i) => `${i + 1}. ${p.texto}:   ${p.comando}`),
        '',
        `Importante: ${AVISO_IMPORTANTE}`,
        AVISO_PAUSA,
    ].join('\n');

    const html = renderBaseLayout({
        titulo: sigue ? `${s.corto} sigue sin responder` : `${s.corto} no responde`,
        badgeHtml: renderOutcomeBadge('SIN_RESPUESTA'),
        resumen: sigue ? `Lleva ${duracion} sin responder. ${s.detalle}` : `No responde desde ${desde}. ${s.detalle}`,
        camposHtml: renderCamposList([
            { icono: '🖥️', label: 'Servicio', valor: escapar(s.nombre) },
            { icono: '🕒', label: 'Sin respuesta desde', valor: fechaHoraChile(accion.desde) },
            { icono: '⏱️', label: 'Duración', valor: duracion },
            { icono: '⚠️', label: 'Motivo', valor: escapar(motivo) },
            { icono: '🔁', label: 'Fallos seguidos', valor: String(accion.fallos) },
            { icono: '🧩', label: 'Proceso y puerto', valor: `${escapar(s.proceso)} · ${escapar(s.puerto)}` },
        ]),
        bloqueEspecialHtml: pasosHtml(pasos),
        observacionHtml: renderObservacion('Importante', escapar(AVISO_IMPORTANTE)),
        logoCid: LOGO_CID,
    });
    return { subject, text, html, logoCid: LOGO_CID };
}
