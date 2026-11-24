// Correos del sistema que no salen de un evento de notificación (no tienen destinatarios configurables): se arman aquí con el mismo diseño
// de los demás (notifications/layout/base-layout.js). Solo arman el contenido; no envían nada.
import { renderBaseLayout, renderCta, renderObservacion } from './layout/base-layout.js';
import { renderOutcomeBadge } from './outcomes.js';

export const LOGO_CID = 'logo_adlone';
const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Correo de recuperación de contraseña: botón con el enlace de un solo uso, el mismo enlace en texto (por si el botón no funciona) y el aviso
 * para quien no lo pidió. Devuelve { subject, text, html }.
 */
export function renderRecuperacionClave({ nombreUsuario, resetUrl, expiresInMinutes }) {
    const nombre = String(nombreUsuario || '').trim();
    const subject = 'ADL ONE — Recuperación de contraseña';
    const minutos = Number(expiresInMinutes) || 60;
    const enlace = escapar(resetUrl);

    const html = renderBaseLayout({
        titulo: 'Recuperación de contraseña',
        resumen: `Hola <strong style="color:#37352f;">${escapar(nombre || 'usuario')}</strong>, recibimos una solicitud para restablecer tu contraseña de ADL ONE. El enlace caduca en <strong style="color:#37352f;">${minutos} minutos</strong> y solo puede usarse una vez.`,
        ctaHtml: `${renderCta('Restablecer contraseña', enlace)}
      <p style="margin:18px 0 0 0; font-size:12px; color:#9b9a97; line-height:1.6; font-family:${FONT};">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><span style="color:#0062a8; word-break:break-all;">${enlace}</span></p>
      <p style="margin:14px 0 0 0; padding-top:14px; border-top:1px solid #f1f1ef; font-size:12px; color:#9b9a97; line-height:1.6; font-family:${FONT};">Si no fuiste tú quien lo pidió, ignora este correo: tu contraseña actual sigue siendo válida.</p>`,
        logoCid: LOGO_CID,
    });

    const text = `Hola ${nombre},\n\n` +
        'Recibimos una solicitud para restablecer tu contraseña de ADL ONE.\n\n' +
        `Para crear una nueva, abre este enlace dentro de los próximos ${minutos} minutos (solo sirve una vez):\n\n` +
        `${resetUrl}\n\n` +
        'Si no fuiste tú quien lo pidió, ignora este mensaje: tu contraseña actual sigue siendo válida.\n\n' +
        'Equipo ADL ONE';

    return { subject, text, html };
}

// ── Documentos para el cliente (cadena de custodia y FoMa) ─────────────────────────────────────────────────────────────────────────────
// Plantillas que se guardan en mae_evento_notificacion (id 73 = FoMa, 74 = cadena de custodia) y que ADL ONE (reenvío manual) y ADL SAMPLING
// (botón «Enviar» de la pantalla de documentos) leen de la base y rellenan con estos marcadores:
//   {CASO_ADLAB} / {CORRELATIVO}  → identificador del muestreo · {LABORATORIO_ASIGNADO} → laboratorio · el logo viaja adjunto con cid «logo_adl».
const CID_LOGO_ADL = 'logo_adl';
const filaDoc = (etiqueta, valor, ultima) => `<tr>
          <td width="150" valign="top" style="width:150px; padding:9px 14px; ${ultima ? '' : 'border-bottom:1px solid #f1f1ef;'} font-size:13px; color:#9b9a97; font-family:${FONT};">${etiqueta}</td>
          <td valign="top" style="padding:9px 14px; ${ultima ? '' : 'border-bottom:1px solid #f1f1ef;'} font-size:13px; color:#1f1f1f; font-weight:500; font-family:${FONT};">${valor}</td>
        </tr>`;

const DOCUMENTOS = {
    FOMA: { codigo: 'ENV_FOMA_MAM', asunto: 'Informe de muestreo (FoMa) · {CORRELATIVO}', titulo: 'Informe de muestreo (FoMa)', documento: 'Informe de muestreo (FoMa)', conLaboratorio: false },
    CADENA: { codigo: 'ENV_CADENA_MAM', asunto: 'Cadena de custodia · {CORRELATIVO}', titulo: 'Cadena de custodia', documento: 'Cadena de custodia', conLaboratorio: true },
};

/** Plantilla {asunto, html} del documento 'FOMA' o 'CADENA', con los marcadores sin reemplazar. */
export function plantillaDocumentoCliente(tipo) {
    const d = DOCUMENTOS[tipo];
    if (!d) throw new Error(`Documento desconocido: ${tipo}`);
    const filas = [filaDoc('Caso', '{CASO_ADLAB}'), filaDoc('Documento adjunto', d.documento, !d.conLaboratorio)];
    if (d.conLaboratorio) filas.push(filaDoc('Laboratorio', '{LABORATORIO_ASIGNADO}', true));
    const camposHtml = `<div style="border:1px solid #ededec; border-radius:10px; margin-bottom:22px; overflow:hidden;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;">${filas.join('')}</table>
    </div>`;
    const nota = d.conLaboratorio
        ? 'Incluye el comprobante del envío físico, en caso de aplicar.'
        : '';
    const html = renderBaseLayout({
        titulo: d.titulo,
        resumen: `Estimado cliente, el proceso de muestreo de su caso finalizó. Adjuntamos la documentación.${nota ? ' ' + nota : ''}`,
        camposHtml,
        bloqueEspecialHtml: `<p style="margin:0; font-size:12px; color:#9b9a97; line-height:1.6; font-family:${FONT};">Si tiene dudas, contacte a su ejecutivo comercial o responda a este correo. Este documento se generó automáticamente desde la plataforma de muestreo de ADL.</p>`,
        logoCid: CID_LOGO_ADL,
    }).replace('alt="ADL ONE"', 'alt="ADL Diagnostic"');
    return { codigo: d.codigo, asunto: d.asunto, html };
}

// ── Pre-factura al cliente ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const filaPf = (etiqueta, valor, ultima) => `<tr>
          <td width="150" valign="top" style="width:150px; padding:9px 14px; ${ultima ? '' : 'border-bottom:1px solid #f1f1ef;'} font-size:13px; color:#9b9a97; font-family:${FONT};">${etiqueta}</td>
          <td valign="top" style="padding:9px 14px; ${ultima ? '' : 'border-bottom:1px solid #f1f1ef;'} font-size:13px; color:#1f1f1f; font-weight:500; font-family:${FONT};">${valor}</td>
        </tr>`;

/**
 * Correo con el que se envía una pre-factura al cliente (los PDF van adjuntos). El logo va adjunto con cid «logo_adl».
 * requiereOc 'N' = se procesa directo; portalPublicado = el cliente también puede cargar la OC en ADL WEB GO.
 */
export function renderPreFacturaCliente({ numero, empresa, totalUf, totalClp, requiereOc = 'S', portalPublicado = false }) {
    const proximoPaso = requiereOc === 'N'
        ? 'Este documento se procesará directamente para su facturación. No necesita hacer nada más.'
        : portalPublicado
            ? 'Para proceder con la facturación, agradecemos remitir su Orden de Compra (y HES si corresponde). Puede cargarla en el portal ADL WEB GO, en la sección Archivos junto a esta pre-factura, o responder a este correo.'
            : 'Para proceder con la facturación, agradecemos remitir su Orden de Compra (y HES si corresponde) en respuesta a este correo.';
    const filas = [filaPf('Pre-factura', `N° ${escapar(numero)}`), empresa ? filaPf('Cliente', escapar(empresa)) : '', filaPf('Total', `${escapar(totalUf)} U.F.`), filaPf('Equivalente', `$ ${escapar(totalClp)}`, true)].join('');
    const html = renderBaseLayout({
        titulo: `Pre-factura N° ${escapar(numero)}`,
        resumen: 'Estimado(a), adjuntamos la pre-factura con el resumen y el detalle de los servicios.',
        camposHtml: `<div style="border:1px solid #ededec; border-radius:10px; margin-bottom:22px; overflow:hidden;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;">${filas}</table>
    </div>`,
        observacionHtml: renderObservacion('Próximo paso', escapar(proximoPaso)),
        bloqueEspecialHtml: `<p style="margin:0; font-size:12px; color:#9b9a97; line-height:1.6; font-family:${FONT};">Saludos,<br>Facturación ADL Diagnostic</p>`,
        logoCid: CID_LOGO_ADL,
    }).replace('alt="ADL ONE"', 'alt="ADL Diagnostic"');
    const text = `Estimado(a),\n\nAdjuntamos la pre-factura N° ${numero}${empresa ? ` de ${empresa}` : ''} por un total de ${totalUf} U.F. ($ ${totalClp}).\n\n${proximoPaso}\n\nSaludos,\nFacturación ADL Diagnostic`;
    return { html, text };
}

// ── Confirmación de contraseña cambiada ──────────────────────────────────────────────────────────────────────────────────────────────
/** Aviso a la persona de que su contraseña cambió (por su cambio o por la recuperación), con el momento. Devuelve { subject, text, html }. */
export function renderClaveCambiada({ nombreUsuario, motivo = 'cambio', cuando = new Date() }) {
    const nombre = String(nombreUsuario || '').trim();
    const por = motivo === 'recuperacion' ? 'con el enlace de recuperación' : 'desde tu cuenta';
    const momento = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', dateStyle: 'long', timeStyle: 'short' }).format(cuando);
    const subject = 'ADL ONE — Tu contraseña cambió';
    const html = renderBaseLayout({
        titulo: 'Tu contraseña cambió',
        resumen: `Hola <strong style="color:#37352f;">${escapar(nombre || 'usuario')}</strong>, la contraseña de tu cuenta de ADL ONE se cambió ${por} el ${escapar(momento)}.`,
        bloqueEspecialHtml: `<p style="margin:0; padding-top:14px; border-top:1px solid #f1f1ef; font-size:12px; color:#9b9a97; line-height:1.6; font-family:${FONT};">Si fuiste tú, no necesitas hacer nada. Si no reconoces este cambio, avisa de inmediato al área de Informática.</p>`,
        logoCid: LOGO_CID,
    });
    const text = `Hola ${nombre},\n\nLa contraseña de tu cuenta de ADL ONE se cambió ${por} el ${momento}.\n\nSi fuiste tú, no necesitas hacer nada. Si no reconoces este cambio, avisa de inmediato al área de Informática.\n\nEquipo ADL ONE`;
    return { subject, text, html };
}

// ── Equipos por vencer ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const fechaCorta = (d) => {
    const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const [y, m, dd] = s.split('-');
    return `${dd}-${m}-${y}`;
};
const cuando = (n) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`);

/**
 * Correo para quien gestiona los equipos: los que vencen pronto. `tramo` es 7 (urgente) o 30; `equipos` trae { codigo, nombre, sede, siguiente, dias }.
 * Devuelve { subject, text, html }.
 */
export function renderEquiposPorVencer({ tramo = 30, equipos = [], appUrl = 'http://localhost:5173' }) {
    const lista = equipos.slice(0, 40);
    const resto = equipos.length - lista.length;
    const titulo = `Equipos por vencer (${tramo} días)`;
    const subject = `${titulo}: ${equipos.length === 1 ? equipos[0].codigo : `${equipos.length} equipos`}`;
    const celda = `padding:9px 14px; border-bottom:1px solid #f1f1ef; font-size:13px; font-family:${FONT};`;
    const filas = lista.map((e) => `<tr>
          <td valign="top" style="${celda} color:#1f1f1f; font-weight:600;">${escapar(e.codigo)}</td>
          <td valign="top" style="${celda} color:#37352f;">${escapar(String(e.nombre || '').trim())}${e.sede ? `<br><span style="color:#9b9a97; font-size:12px;">Sede ${escapar(e.sede)}</span>` : ''}</td>
          <td valign="top" style="${celda} color:${e.dias <= 7 ? '#c0392b' : '#37352f'}; white-space:nowrap;">${fechaCorta(e.siguiente)}<br><span style="color:#9b9a97; font-size:12px;">${cuando(e.dias)}</span></td>
        </tr>`).join('');
    const tabla = `<div style="border:1px solid #ededec; border-radius:10px; margin-bottom:22px; overflow:hidden;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;">
        <tr style="background:#fbfbfa;"><th align="left" style="${celda} font-size:11px; color:#9b9a97; text-transform:uppercase; letter-spacing:0.5px;">Código</th><th align="left" style="${celda} font-size:11px; color:#9b9a97; text-transform:uppercase; letter-spacing:0.5px;">Equipo</th><th align="left" style="${celda} font-size:11px; color:#9b9a97; text-transform:uppercase; letter-spacing:0.5px;">Vence</th></tr>${filas}
      </table>${resto > 0 ? `<div style="padding:9px 14px; font-size:12px; color:#9b9a97; font-family:${FONT};">y ${resto} más. Revisa el listado completo en ADL ONE.</div>` : ''}
    </div>`;
    const html = renderBaseLayout({
        titulo,
        badgeHtml: renderOutcomeBadge(tramo <= 7 ? 'EN_REVISION' : 'INFORMATIVA'),
        resumen: tramo <= 7
            ? 'Estos equipos operativos vencen en los próximos 7 días y necesitan su revisión.'
            : 'Estos equipos operativos vencen en los próximos 30 días. Conviene programar su revisión.',
        bloqueEspecialHtml: tabla,
        ctaHtml: renderCta('Ver los equipos en ADL ONE', `${appUrl}/`),
        logoCid: LOGO_CID,
    });
    const text = `${titulo}\n\n${lista.map((e) => `${e.codigo} · vence ${fechaCorta(e.siguiente)} (${cuando(e.dias)})${e.sede ? ` · Sede ${e.sede}` : ''}${e.nombre ? ` · ${String(e.nombre).trim()}` : ''}`).join('\n')}${resto > 0 ? `\ny ${resto} más.` : ''}`;
    return { subject, text, html };
}
