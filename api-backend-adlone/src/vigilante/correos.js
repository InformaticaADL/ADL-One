// Redacta los correos del vigilante. Solo arma el texto: no envía nada.

const SERVICIOS = {
    frontend: {
        corto: 'La pantalla web de ADL ONE',
        proceso: 'adl-one-frontend',
        puerto: 5174,
        detalle: 'Sin esto nadie puede abrir ADL ONE en el navegador.',
    },
    backend: {
        corto: 'El servidor de ADL ONE',
        proceso: 'adl-one-backend',
        puerto: 8002,
        detalle: 'Sin esto ADL ONE no carga datos y no se puede trabajar en él.',
    },
};

export const servicioDe = (id) => SERVICIOS[id] || { corto: id, proceso: id, puerto: '', detalle: '' };

/** 135 min → «2 h 15 min»; 4 min → «4 min»; menos de 1 min → «menos de 1 min». */
export function formatoDuracion(ms) {
    const min = Math.max(0, Math.round(ms / 60000));
    if (min < 1) return 'menos de 1 min';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60); const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
}

// «el 23-11-2026 a las 14:30» en horario de Chile, en 24 horas («02:30 p. m.» terminaba la frase con dos puntos).
const momentoChile = (ms) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return `el ${p.day}-${p.month}-${p.year} a las ${p.hour}:${p.minute}`;
};

const escapar = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * @param {{tipo:'CAIDO'|'RECORDATORIO'|'RECUPERADO', desde:number, duracionMs:number, fallos:number, motivo:string|null}} accion
 * @param {'frontend'|'backend'} servicioId
 * @returns {{subject:string, text:string, html:string}}
 */
export function armarCorreo(accion, servicioId, { servidor = '192.168.10.28' } = {}) {
    const s = servicioDe(servicioId);
    const desde = momentoChile(accion.desde);
    const duracion = formatoDuracion(accion.duracionMs);

    if (accion.tipo === 'RECUPERADO') {
        const subject = `[ADL ONE] ${s.corto} volvió a responder`;
        const lineas = [
            `${s.corto} volvió a responder.`,
            '',
            `Estuvo sin responder desde ${desde} (${duracion}).`,
            'No hace falta hacer nada más.',
        ];
        return { subject, text: lineas.join('\n'), html: lineas.map((l) => (l ? `<p style="margin:0 0 8px">${escapar(l)}</p>` : '')).join('') };
    }

    const sigue = accion.tipo === 'RECORDATORIO';
    const subject = sigue ? `[ADL ONE] SIGUE SIN RESPONDER: ${s.corto} (hace ${duracion})` : `[ADL ONE] ${s.corto} no responde`;
    const pasos = [
        `1. En el servidor ${servidor}, ver el motivo:   pm2 logs ${s.proceso} --lines 40 --nostream`,
        `2. Detenerlo:   pm2 stop ${s.proceso}`,
        `3. Comprobar que el puerto ${s.puerto} quedó libre:   netstat -ano | findstr ":${s.puerto}"   (si queda un proceso, cerrarlo)`,
        `4. Volver a levantarlo:   pm2 start ${s.proceso}`,
    ];
    const lineas = [
        sigue ? `${s.corto} SIGUE sin responder desde ${desde} (${duracion}).` : `${s.corto} no responde desde ${desde}.`,
        '',
        `Motivo: ${accion.motivo || 'sin detalle'}.`,
        `Comprobaciones seguidas con fallo: ${accion.fallos}.`,
        s.detalle,
        '',
        `Cómo arreglarlo (solo ese proceso):`,
        ...pasos,
        '',
        'Importante: usar siempre el nombre del proceso. Nunca "pm2 restart" ni "pm2 restart all".',
        'Si lo detuviste a propósito (mantención o despliegue), no hace falta hacer nada: el vigilante ignora los procesos detenidos en pm2.',
        'Para silenciar los avisos un rato (mantención con el proceso "online"):   node src/vigilante/pausar.js 30 "motivo"',
    ];
    const html = lineas.map((l) => (l ? `<p style="margin:0 0 8px;font-family:Segoe UI,Arial,sans-serif">${escapar(l)}</p>` : '')).join('');
    return { subject, text: lineas.join('\n'), html };
}
