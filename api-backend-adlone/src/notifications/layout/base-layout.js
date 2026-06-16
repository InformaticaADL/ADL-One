import { isEmptyValue } from '../placeholders.js';

const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/**
 * Renders the Notion/Shadcn-style "key: value" detail list.
 * Returns '' if there are no rows.
 */
export function renderCamposList(rows) {
    if (!rows || rows.length === 0) return '';

    const rowsHtml = rows.map((r, i) => `
        <div style="display:flex; padding:10px 14px; ${i < rows.length - 1 ? 'border-bottom:1px solid #f1f1ef;' : ''} font-size:13px; font-family:${FONT};">
          <div style="width:160px; flex-shrink:0; color:#9b9a97;">${r.icono} ${r.label}</div>
          <div style="color:#1f1f1f; font-weight:500;">${r.valor}</div>
        </div>`).join('');

    return `<div style="border:1px solid #ededec; border-radius:10px; overflow:hidden; margin-bottom:18px;">${rowsHtml}</div>`;
}

/**
 * Renders the "who/when" line for the event (acción realizada por X el Y a
 * las Z), kept visually separate from the ficha's own data fields.
 * Returns '' if usuario is empty.
 */
export function renderMetaInfo(usuario, fecha, hora) {
    if (isEmptyValue(usuario)) return '';

    const cuando = [fecha, hora].filter((v) => !isEmptyValue(v)).join(' ');

    return `<div style="font-size:12px; color:#9b9a97; margin:-4px 0 16px 0; font-family:${FONT};">
      Acción realizada por <strong style="color:#787774;">${usuario}</strong>${cuando ? ` el ${cuando}` : ''}
    </div>`;
}

/**
 * Renders the observation/motivo block. Returns '' if value is empty.
 * "Sin observaciones" gets a neutral gray accent; any other text gets an
 * amber accent (matches the existing visual convention).
 */
export function renderObservacion(etiqueta, valor) {
    if (isEmptyValue(valor)) return '';

    const isSinObs = String(valor).trim().toLowerCase() === 'sin observaciones';
    const accentColor = isSinObs ? '#cbd5e1' : '#d97706';

    return `<div style="background:#fbfbfa; border:1px solid #ededec; border-left:3px solid ${accentColor}; border-radius:8px; padding:12px 14px; margin-bottom:22px; font-family:${FONT};">
      <div style="font-size:11px; color:#9b9a97; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">${etiqueta}</div>
      <div style="font-size:13px; color:#37352f; line-height:1.5;">${valor}</div>
    </div>`;
}

/**
 * Renders the CTA button. Returns '' if label or href is missing.
 */
export function renderCta(label, href) {
    if (!label || !href) return '';
    return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin-top:6px;">
      <tr>
        <td align="center" bgcolor="#0062a8" style="border-radius:8px;">
          <a href="${href}" style="display:inline-block; padding:14px 36px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; font-family:${FONT}; line-height:1; border-radius:8px;">${label}</a>
        </td>
      </tr>
    </table>`;
}

/**
 * Assembles the full standalone HTML email document: header (logo), title +
 * outcome badge, optional summary sentence, detail list, optional special
 * block, optional observation block, optional CTA, and the ADL footer.
 */
export function renderBaseLayout({
    titulo,
    badgeHtml = '',
    resumen = '',
    metaInfoHtml = '',
    camposHtml = '',
    bloqueEspecialHtml = '',
    observacionHtml = '',
    ctaHtml = '',
    logoCid,
}) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:${FONT};">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9; width:100%;">
    <tr>
      <td align="center" style="padding:40px 0;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; max-width:480px; width:100%; border-radius:14px; overflow:hidden; border:1px solid #e9e9e7;">
          <tr>
            <td style="padding:24px 28px 0 28px;">
              <img src="cid:${logoCid}" alt="ADL ONE" width="160" style="display:block; height:38px; width:auto; border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 24px 28px;">
              <h2 style="margin:0 0 6px 0; font-size:18px; color:#1f1f1f; font-weight:600; font-family:${FONT};">${titulo}</h2>
              ${badgeHtml}
              ${resumen ? `<p style="font-size:14px; color:#787774; line-height:1.6; margin:12px 0 18px 0; font-family:${FONT};">${resumen}</p>` : ''}
              ${metaInfoHtml}
              ${camposHtml}
              ${bloqueEspecialHtml}
              ${observacionHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px; border-top:1px solid #f1f1ef; background:#fbfbfa;">
              <div style="font-size:11px; color:#9b9a97; line-height:1.6; font-family:${FONT};">
                <strong style="color:#787774;">ADL Diagnostic Chile SpA</strong><br>
                Sector La Vara s/n, Camino a Alerce, Puerto Montt &middot;
                <a href="http://www.adldiagnostic.cl" style="color:#0062a8; text-decoration:none;">www.adldiagnostic.cl</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
