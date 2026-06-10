const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

function isValidDate(dateStr) {
    if (!dateStr || dateStr === 'No asignada') return false;
    if (String(dateStr).includes('1900')) return false;
    return true;
}

function diffOrPlain(oldVal, newVal) {
    if (!oldVal) return newVal;
    return `<span style="color:#c0392b; text-decoration:line-through; margin-right:6px;">${oldVal}</span><span style="color:#0975a8; font-weight:600;">&rarr; ${newVal}</span>`;
}

function renderRows(rows) {
    return rows.map((r, i) => `
        <div style="display:flex; padding:8px 14px; ${i < rows.length - 1 ? 'border-bottom:1px solid #f1f1ef;' : ''} font-size:13px; font-family:${FONT};">
          <div style="width:160px; flex-shrink:0; color:#9b9a97;">${r.icono} ${r.label}</div>
          <div style="color:#1f1f1f; font-weight:500;">${r.valor}</div>
        </div>`).join('');
}

function renderServicioCard(servicio) {
    const instalacionHtml = diffOrPlain(servicio.old_muestreador_instalacion, servicio.muestreador_instalacion);

    const hasRetiroMuestreador = servicio.muestreador_retiro && servicio.muestreador_retiro !== 'No asignado';
    let retiroRow = null;
    if (servicio.old_muestreador_retiro) {
        retiroRow = diffOrPlain(servicio.old_muestreador_retiro, servicio.muestreador_retiro);
    } else if (hasRetiroMuestreador) {
        retiroRow = servicio.muestreador_retiro;
    }

    const fechaHtml = diffOrPlain(servicio.old_fecha, servicio.fecha_muestreo);

    const retiroValido = isValidDate(servicio.fecha_retiro);
    const oldRetiroValido = isValidDate(servicio.old_fecha_retiro);
    let fechaRetiroRow = null;
    if (servicio.old_fecha_retiro && oldRetiroValido) {
        fechaRetiroRow = diffOrPlain(servicio.old_fecha_retiro, retiroValido ? servicio.fecha_retiro : 'No asignada');
    } else if (retiroValido) {
        fechaRetiroRow = servicio.fecha_retiro;
    }

    const rows = [
        { icono: '📥', label: 'Muestreador Inst.', valor: instalacionHtml },
        retiroRow ? { icono: '📤', label: 'Muestreador Ret.', valor: retiroRow } : null,
        { icono: '📅', label: 'Fecha Instalación', valor: fechaHtml },
        fechaRetiroRow ? { icono: '📅', label: 'Fecha Retiro', valor: fechaRetiroRow } : null,
    ].filter(Boolean);

    return `<div style="border:1px solid #ededec; border-radius:10px; overflow:hidden; margin-bottom:10px;">
      <div style="padding:8px 14px; background:#fbfbfa; border-bottom:1px solid #f1f1ef; font-size:12px; font-weight:600; color:#0062a8; font-family:${FONT};">Servicio ${servicio.numero}</div>
      ${renderRows(rows)}
    </div>`;
}

/**
 * Renders the "Detalle de Servicios" block: one card per service in
 * context.servicios, each with install/retiro responsible and dates,
 * highlighting old -> new changes when present. Returns '' if
 * context.servicios is missing or empty.
 */
export function renderFichaServicios(context) {
    const servicios = context.servicios;
    if (!Array.isArray(servicios) || servicios.length === 0) return '';

    const cards = servicios.map(renderServicioCard).join('');

    return `<div style="margin-bottom:18px;">
      <div style="font-size:11px; color:#9b9a97; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; font-family:${FONT};">Detalle de Servicios</div>
      ${cards}
    </div>`;
}
