// Bloque «detalle» de los correos de solicitudes (equipos y formularios dinámicos de URS), con el diseño del resto de los correos.
// Reemplaza al armado antiguo de notification.service (que ponía colores y tablas distintas según el tipo). Recibe el contexto del evento:
//   · context.equipos   → lista de equipos de la solicitud (cada uno, o un traspaso con datos de origen y nuevos)
//   · context.datos_json → datos del formulario (deshabilitar muestreador, o campos genéricos)
// Tablas y estilos en línea (no flexbox ni clases): Outlook de escritorio no entiende otra cosa.

const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export const escapar = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const vacio = (v) => v === null || v === undefined || String(v).trim() === '' || String(v).trim() === 'N/A';

// «2026-11-18» o «2026-11-18T00:00…» → «18-11-2026»; cualquier otro texto queda igual.
export function formatoFecha(valor) {
    if (typeof valor !== 'string') return valor;
    if (/^\d{4}-\d{2}-\d{2}(\D.*)?$/.test(valor)) {
        const p = valor.split(/\D/);
        if (p.length >= 3 && p[0].length === 4) return `${p[2]}-${p[1]}-${p[0]}`;
    }
    return valor;
}

// Códigos internos → texto para personas.
const CODIGOS = {
    DANIO: 'Daño irreparable', DANO: 'Daño irreparable', OBSOLESCENCIA: 'Obsolescencia', PERDIDA: 'Pérdida', ROBO: 'Robo',
    VIDA_UTIL: 'Vida útil', DETERIORO: 'Deterioro', REEMPLAZO: 'Reemplazo', BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta', OTRO: 'Otro',
    ACEPTADA: 'Aceptada', RECHAZADA: 'Rechazada', PENDIENTE: 'Pendiente', REALIZADA: 'Realizada', EN_REVISION: 'En revisión', CANCELADA: 'Cancelada',
};

const ETIQUETAS = {
    motivo: 'Motivo', fecha_baja: 'Fecha efectiva', fecha_suceso: 'Fecha del suceso', fecha_extravio: 'Fecha de extravío',
    fecha_ocurrencia: 'Fecha de ocurrencia', fecha_anulacion: 'Fecha de anulación', nombre_centro_destino: 'Centro destino',
    nombre_muestreador_destino: 'Muestreador destino', sede_actual: 'Sede actual', responsable_actual: 'Responsable actual',
    descripcion: 'Descripción', descripcion_problema: 'Descripción del problema', tipo_equipo: 'Tipo de equipo', nombre_ubicacion: 'Ubicación',
    ubicacion: 'Ubicación', responsable: 'Responsable', nombre_equipo_full: 'Equipo', observacion: 'Observación', tipo: 'Tipo',
};

// Campos internos que no se muestran a quien lee el correo.
const OCULTOS = new Set([
    'muestreador_origen_id', 'muestreador_origen_nombre', 'tipo_traspaso', 'base_destino', 'muestreador_destino_id', 'muestreador_destino_nombre',
    'reasignacion_manual', 'id_equipo', 'id_equipo_original', 'fecha_traspaso', 'form_type', '_form_type', 'formType', 'formtype',
    'id_muestreador_destino', 'info_actual', 'traspaso_de', 'id_solicitante', 'id_centro_destino', 'nombre_equipo', 'nombre_equipo_full',
    'encargado_actual', 'ubicacion_actual', 'id_tecnico', 'idTecnico', 'origen_solicitud', 'codigo_equipo', 'id_muestreador', 'id_muestreo',
    'id_ficha', 'relacion_tipo', 'num_ficha', 'id_tipo_aviso', 'observaciones',
]);
const OCULTOS_EQUIPO = new Set(['id', 'isTransfer', 'status', 'datos_antiguos', 'datos_nuevos', 'nombre', 'codigo']);

const etiquetaDe = (clave) => ETIQUETAS[clave] || String(clave).replace(/_/g, ' ').replace(/^\w/, (l) => l.toUpperCase());
const textoDe = (valor) => {
    const v = typeof valor === 'string' ? (CODIGOS[valor.trim().toUpperCase()] || valor) : valor;
    return formatoFecha(v);
};

// Una tarjeta: título arriba y filas «etiqueta · valor» (el valor ya viene como HTML seguro).
function tarjeta(titulo, filas, pie = '') {
    const cuerpo = filas.map((f, i) => {
        const borde = i < filas.length - 1 ? 'border-bottom:1px solid #f1f1ef;' : '';
        return `<tr>
          <td width="170" valign="top" style="width:170px; padding:8px 14px; ${borde} font-size:13px; color:#9b9a97; font-family:${FONT};">${escapar(f.etiqueta)}</td>
          <td valign="top" style="padding:8px 14px; ${borde} font-size:13px; color:#1f1f1f; font-weight:500; font-family:${FONT};">${f.html}</td>
        </tr>`;
    }).join('');
    return `<div style="border:1px solid #ededec; border-radius:10px; margin-bottom:22px; overflow:hidden; font-family:${FONT};">
      <div style="padding:10px 14px; background:#fbfbfa; border-bottom:1px solid #ededec; font-size:11px; font-weight:600; color:#6b6b68; text-transform:uppercase; letter-spacing:0.5px;">${escapar(titulo)}</div>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;">${cuerpo}</table>${pie}
    </div>`;
}

const cambio = (antes, despues) => (vacio(antes) || String(antes) === String(despues))
    ? escapar(despues)
    : `<span style="color:#c0392b; text-decoration:line-through; margin-right:6px;">${escapar(antes)}</span><span style="color:#0975a8; font-weight:600;">&rarr; ${escapar(despues)}</span>`;

const nombreEquipo = (e) => `${e.nombre || 'Equipo'}${e.codigo ? ` [${e.codigo}]` : ''}`;

function tarjetaEquipo(equipo) {
    if (equipo.isTransfer) {
        const a = equipo.datos_antiguos || {}; const n = equipo.datos_nuevos || {};
        const filas = [{ etiqueta: 'Tipo', html: escapar(equipo.tipo || 'N/A') }];
        if (!vacio(a.ubicacion) || !vacio(n.ubicacion)) filas.push({ etiqueta: 'Ubicación', html: cambio(a.ubicacion, n.ubicacion || '-') });
        if (!vacio(a.responsable) || !vacio(n.responsable)) filas.push({ etiqueta: 'Responsable', html: cambio(a.responsable, n.responsable || '-') });
        return tarjeta(nombreEquipo(equipo), filas);
    }
    const filas = Object.entries(equipo)
        .filter(([k, v]) => !OCULTOS_EQUIPO.has(k) && !vacio(v) && typeof v !== 'object')
        .map(([k, v]) => ({ etiqueta: etiquetaDe(k), html: escapar(textoDe(v)) }));
    return tarjeta(nombreEquipo(equipo), filas.length ? filas : [{ etiqueta: 'Detalle', html: '—' }]);
}

const TRASPASO = { BASE: 'A otra base', MUESTREADOR: 'A otro muestreador', IGUAL: 'A otro muestreador', MANUAL: 'Reasignación manual' };

function tarjetaDeshabilitarMuestreador(dj) {
    const filas = [
        { etiqueta: 'Muestreador a deshabilitar', html: escapar(dj.muestreador_origen_nombre) },
        { etiqueta: 'Traspaso de equipos', html: escapar(TRASPASO[dj.tipo_traspaso] || dj.tipo_traspaso || '—') },
    ];
    if (dj.tipo_traspaso === 'BASE') filas.push({ etiqueta: 'Base destino', html: escapar(dj.base_destino || 'No especificada') });
    if (dj.tipo_traspaso === 'MUESTREADOR' || dj.tipo_traspaso === 'IGUAL') filas.push({ etiqueta: 'Nuevo muestreador', html: escapar(dj.muestreador_destino_nombre || 'No especificado') });
    let pie = '';
    if (dj.tipo_traspaso === 'MANUAL' && Array.isArray(dj.reasignacion_manual) && dj.reasignacion_manual.length) {
        const celda = 'padding:7px 14px; font-size:13px; font-family:' + FONT + ';';
        const filasM = dj.reasignacion_manual.map((m) => `<tr style="border-top:1px solid #f1f1ef;">
          <td style="${celda} color:#1f1f1f;">${escapar(m.nombre_equipo || 'Equipo')}</td>
          <td style="${celda} color:#6b6b68;">${escapar(m.codigo_equipo || '-')}</td>
          <td style="${celda} color:#0975a8; font-weight:600;">${escapar(m.nombre_muestreador_nuevo || 'Sin asignar')}</td></tr>`).join('');
        pie = `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-top:1px solid #ededec;">
          <tr style="background:#fbfbfa;"><th align="left" style="${celda} font-size:11px; color:#9b9a97; text-transform:uppercase; letter-spacing:0.5px;">Equipo</th>
          <th align="left" style="${celda} font-size:11px; color:#9b9a97; text-transform:uppercase; letter-spacing:0.5px;">Código</th>
          <th align="left" style="${celda} font-size:11px; color:#9b9a97; text-transform:uppercase; letter-spacing:0.5px;">Nuevo responsable</th></tr>${filasM}</table>`;
    }
    return tarjeta('Deshabilitación de muestreador', filas, pie);
}

const sinTildes = (t) => String(t || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function tarjetaGenerica(dj, context) {
    const tipo = sinTildes(context.TIPO_SOLICITUD || context.nombre_tipo);
    const esFicha = tipo.includes('FICHA') || tipo.includes('CANCELACION') || tipo.includes('ANULACION')
        || [12, 15].includes(Number(context.id_tipo))
        || ['SERVICIO', 'FICHA'].includes(String(dj.relacion_tipo || context.relacion_tipo || '').toUpperCase());

    let titulo = 'Detalle de la solicitud';
    if (tipo.includes('BAJA') || tipo.includes('DESVINCULACI')) titulo = 'Plan de desvinculación de equipo';
    else if (tipo.includes('TRASPASO')) titulo = 'Detalle del traspaso';
    else if (tipo.includes('ACTIVACI') || tipo.includes('ALTA')) titulo = 'Solicitud de activación';
    else if (tipo.includes('DESHABILITAR') || tipo.includes('MUESTREADOR')) titulo = 'Solicitud de deshabilitación';

    // Las fechas que repiten la fecha efectiva de baja no se muestran dos veces.
    const repetidas = new Set();
    if (dj.fecha_baja) ['fecha_suceso', 'fecha_extravio', 'fecha_ocurrencia'].forEach((k) => { if (dj[k] === dj.fecha_baja) repetidas.add(k); });

    const nombre = esFicha
        ? (dj.id_ficha || dj.num_ficha || context.equipo_nombre || context.nombre_equipo_full || dj.id_muestreo || dj.correlativo)
        : (context.equipo_nombre || context.nombre_equipo_full || dj.nombre_equipo_full || dj.equipo_nombre || dj.nombre_equipo);
    const codigo = context.codigo_equipo || context.codigo_equipo_db || dj.codigo_equipo || dj.codigo_equipo_db || '';

    const filas = [];
    if (!vacio(nombre)) {
        const n = String(nombre);
        filas.push({ etiqueta: esFicha ? 'Servicio' : 'Equipo', html: escapar(n.includes('[') || !codigo ? n : `${n} [${codigo}]`) });
    }
    Object.entries(dj).forEach(([k, v]) => {
        if (OCULTOS.has(k) || repetidas.has(k) || typeof v === 'object' || vacio(v)) return;
        if (dj._form_type === 'TRASPASO_EQUIPO' && Array.isArray(dj.traspaso_de)) {
            if (k === 'nombre_centro_destino' && !dj.traspaso_de.includes('UBICACION')) return;
            if (k === 'nombre_muestreador_destino' && !dj.traspaso_de.includes('RESPONSABLE')) return;
        }
        filas.push({ etiqueta: etiquetaDe(k), html: escapar(textoDe(v)) });
    });
    return filas.length ? tarjeta(titulo, filas) : '';
}

/** HTML del detalle de la solicitud ('' si el evento no trae equipos ni datos de formulario). */
export function renderDetalleSolicitud(context = {}) {
    if (Array.isArray(context.equipos) && context.equipos.length) return context.equipos.map(tarjetaEquipo).join('');
    const dj = context.datos_json;
    if (dj && typeof dj === 'object') return dj.muestreador_origen_nombre ? tarjetaDeshabilitarMuestreador(dj) : tarjetaGenerica(dj, context);
    return '';
}
