// Modo pruebas de correo: TODO correo que salga por el transporte compartido (notificaciones, facturación, fichas) llega solo a la dirección de pruebas,
// nunca a los destinatarios reales. Arriba del mensaje se anota a quién habría llegado.
// Está ENCENDIDO siempre (mientras ADL ONE no esté en producción): va a EMAIL_REDIRECT_TO o, si no está definida o está vacía, a vremolcoy@adldiagnostic.cl.
// Se apaga SOLO con EMAIL_PRODUCCION=1 (el día de salir a producción). Una variable vacía NO lo apaga: así no se desactiva por descuido.

const comoLista = (v) => {
    if (!v) return [];
    const texto = Array.isArray(v) ? v.join(',') : typeof v === 'object' && v.address ? v.address : String(v);
    return texto.split(',').map((s) => s.trim()).filter(Boolean);
};

const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── Solo correos de ADL ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Ningún correo del sistema debe llegar a alguien que no sea de ADL (un cliente, el jefe de una empresa…). Se quitan los destinatarios cuyo dominio
// no esté en EMAIL_ALLOWED_DOMAINS (por defecto solo adldiagnostic.cl; «*» desactiva el filtro). Si no queda nadie, el correo no se envía.
const DOMINIOS_POR_DEFECTO = 'adldiagnostic.cl';
const correoDe = (token) => {
    const m = /<([^>]+)>/.exec(token);
    return (m ? m[1] : token).trim().toLowerCase();
};
const dominioDe = (token) => {
    const c = correoDe(token);
    const i = c.lastIndexOf('@');
    return i > 0 ? c.slice(i + 1) : '';
};

/** Quita de to/cc/bcc las direcciones que no son de dominios permitidos. Devuelve { opciones, bloqueados, vacio }. */
export const soloDominiosPermitidos = (opciones, dominios = process.env.EMAIL_ALLOWED_DOMAINS ?? DOMINIOS_POR_DEFECTO) => {
    const permitidos = comoLista(dominios).map((d) => d.toLowerCase().replace(/^@/, ''));
    if (!opciones || permitidos.includes('*')) return { opciones, bloqueados: [], vacio: false };
    const bloqueados = [];
    const filtrar = (valor) => {
        const dejar = comoLista(valor).filter((token) => {
            const ok = permitidos.includes(dominioDe(token));
            if (!ok) bloqueados.push(correoDe(token) || String(token));
            return ok;
        });
        return dejar.length ? dejar.join(', ') : undefined;
    };
    const filtradas = { ...opciones, to: filtrar(opciones.to), cc: filtrar(opciones.cc), bcc: filtrar(opciones.bcc) };
    const vacio = !filtradas.to && !filtradas.cc && !filtradas.bcc;
    // Si quedó solo copia, pasa a ser el destinatario (un correo debe tener al menos un "para")
    if (!filtradas.to && filtradas.cc) { filtradas.to = filtradas.cc; filtradas.cc = undefined; }
    return { opciones: bloqueados.length ? filtradas : opciones, bloqueados, vacio };
};

export const REDIRECCION_POR_DEFECTO = 'vremolcoy@adldiagnostic.cl';

/** Dirección(es) a las que va todo el correo ahora mismo; '' si se declaró producción (EMAIL_PRODUCCION=1). */
export const destinoRedireccion = (env = process.env) => (env.EMAIL_PRODUCCION === '1' ? '' : (String(env.EMAIL_REDIRECT_TO || '').trim() || REDIRECCION_POR_DEFECTO));

/** Devuelve las opciones de envío ya redirigidas, o las mismas si ya se declaró producción. */
export const redirigirCorreo = (opciones, redirigirA = destinoRedireccion()) => {
    const destino = comoLista(redirigirA);
    if (!destino.length || !opciones) return opciones;

    const reales = { para: comoLista(opciones.to), cc: comoLista(opciones.cc), cco: comoLista(opciones.bcc) };
    const linea = (nombre, lista) => (lista.length ? `<b>${nombre}:</b> ${escapar(lista.join(', '))}<br>` : '');
    const aviso =
        '<div style="background:#FEF3C7;border:1px solid #FDE68A;color:#78350F;font:12px Arial,sans-serif;padding:8px 12px;margin:0 0 12px">' +
        '<b>MODO PRUEBAS</b>: este correo no se envió a los destinatarios reales.<br>' +
        linea('Para', reales.para) + linea('Cc', reales.cc) + linea('Cco', reales.cco) +
        '</div>';

    return {
        ...opciones,
        to: destino.join(', '),
        cc: undefined,
        bcc: undefined,
        subject: `[PRUEBA] ${opciones.subject || ''}`,
        html: opciones.html ? aviso + opciones.html : opciones.html,
        text: opciones.text && !opciones.html
            ? `MODO PRUEBAS. Destinatarios reales: ${[...reales.para, ...reales.cc, ...reales.cco].join(', ')}\n\n${opciones.text}`
            : opciones.text,
    };
};
