// Correos de solicitudes (equipos, traspasos, deshabilitar muestreador, extensión de vigencia y las solicitudes URS). Son ~50 códigos con el mismo
// cuerpo, así que en vez de una ficha por código se arma la configuración según el nombre del código:
//   …_NUEVA → nueva · …_APR → aprobada · …_RECH → rechazada · …_REV → en revisión · SOLICITUD_ESTADO_CAMBIO → según el estado que trae el evento.
// Los textos que dependen de los datos del evento son funciones (reciben el contexto); el resto de los datos viene de los mismos campos que
// siempre usó el envío (CORRELATIVO, TIPO_SOLICITUD, SOLICITANTE, RESPONSABLE, OBSERVACION, equipos, datos_json…).

const CODIGOS_SOLICITUD = /^(SOL_EQUIPO_[A-Z_]+|SOL_TRASPASO_[A-Z_]+_NUEVA|SOL_DESHABILITAR_MUESTREADOR_NUEVA|SOL_EXTENSION_VIGENCIA_NUEVA|SOLICITUD_(NUEVA|ESTADO_CAMBIO|COMENTARIO_NUEVO|DERIVACION))$/;

const ESTADO_A_RESULTADO = {
    ACEPTADA: 'APROBADA', APROBADO: 'APROBADA', APROBADA: 'APROBADA', REALIZADA: 'REALIZADA', CONCLUIDO_TECNICA: 'REALIZADA',
    RECHAZADA: 'RECHAZADA', RECHAZADO: 'RECHAZADA', EN_REVISION: 'EN_REVISION', CANCELADA: 'CANCELADA', DERIVADO: 'DERIVADA', DERIVADA: 'DERIVADA',
};

/** Resultado (insignia) de un evento de solicitud, o null si no es de este tipo. */
export function resultadoDe(codigo, context = {}) {
    if (codigo === 'SOLICITUD_ESTADO_CAMBIO') return ESTADO_A_RESULTADO[String(context.estado || '').toUpperCase()] || 'INFORMATIVA';
    if (codigo === 'SOLICITUD_DERIVACION') return 'DERIVADA';
    if (codigo === 'SOLICITUD_COMENTARIO_NUEVO' || /_CAMBIO$/.test(codigo)) return 'INFORMATIVA';
    // «SOL_EQUIPO_NUEVA» es el aviso de que el Área Técnica aceptó la solicitud y la está revisando.
    if (codigo === 'SOL_EQUIPO_NUEVA') return 'EN_REVISION';
    if (/_APR$/.test(codigo)) return 'APROBADA';
    if (/_RECH$/.test(codigo)) return 'RECHAZADA';
    if (/_REV$/.test(codigo)) return 'EN_REVISION';
    return 'NUEVA';
}

const tipoDe = (c) => String(c.TIPO_SOLICITUD || c.nombre_tipo || 'Solicitud').trim();
const numeroDe = (c) => String(c.CORRELATIVO ?? c.id_solicitud ?? '').trim();

const TITULOS = {
    NUEVA: (c) => `Nueva solicitud: ${tipoDe(c)}`,
    APROBADA: (c) => `Solicitud aprobada: ${tipoDe(c)}`,
    REALIZADA: (c) => `Solicitud realizada: ${tipoDe(c)}`,
    RECHAZADA: (c) => `Solicitud rechazada: ${tipoDe(c)}`,
    EN_REVISION: (c) => `Solicitud en revisión: ${tipoDe(c)}`,
    DERIVADA: (c) => `Solicitud derivada: ${tipoDe(c)}`,
    CANCELADA: (c) => `Solicitud cancelada: ${tipoDe(c)}`,
    INFORMATIVA: (c) => (numeroDe(c) ? `Novedad en la solicitud #${numeroDe(c)}` : 'Novedad en una solicitud'),
};

const VERBOS = {
    NUEVA: 'se ingresó', APROBADA: 'fue aprobada', REALIZADA: 'fue realizada', RECHAZADA: 'fue rechazada',
    EN_REVISION: 'está en revisión', DERIVADA: 'fue derivada', CANCELADA: 'fue cancelada',
};

/** Configuración de un correo de solicitud, o null si el código no es de esta familia. */
export function configSolicitud(codigo) {
    if (!CODIGOS_SOLICITUD.test(String(codigo))) return null;
    return {
        codigo,
        categoria: 'SOLICITUD',
        outcome: (c) => resultadoDe(codigo, c),
        titulo: (c) => String(c.TITULO_CORREO || '').trim() || TITULOS[resultadoDe(codigo, c)](c),
        asunto: (c) => {
            const t = String(c.TITULO_CORREO || '').trim() || TITULOS[resultadoDe(codigo, c)](c);
            return numeroDe(c) ? `${t} #${numeroDe(c)}` : t;
        },
        resumen: (c) => {
            const r = resultadoDe(codigo, c);
            const n = numeroDe(c);
            const sujeto = n ? `La solicitud #${n}` : 'La solicitud';
            if (r === 'INFORMATIVA') return codigo === 'SOLICITUD_COMENTARIO_NUEVO' ? `${sujeto} tiene un comentario nuevo.` : '';
            if (r === 'NUEVA') return `${n ? `Se ingresó la solicitud #${n}` : 'Se ingresó una solicitud'}${c.SOLICITANTE ? ` de ${c.SOLICITANTE}` : ''}.`;
            return `${sujeto} ${VERBOS[r] || 'cambió de estado'}.`;
        },
        campos: [
            { icono: '🧾', label: 'Solicitud', variable: 'N° {CORRELATIVO}' },
            { icono: '🗂️', label: 'Tipo', variable: '{TIPO_SOLICITUD}' },
            { icono: '👤', label: 'Solicitante', variable: '{SOLICITANTE}' },
            { icono: '👷', label: 'Responsable', variable: '{RESPONSABLE}' },
        ],
        eventoMeta: { usuario: '{USUARIO}', fecha: '{FECHA}', hora: '{HORA}' },
        bloqueEspecial: 'detalleSolicitud',
        observacion: { etiqueta: (c) => String(c.ETIQUETA_OBSERVACION || '').trim() || 'Observaciones', variable: '{OBSERVACION}' },
        cta: { label: 'Ver solicitud en ADL ONE', ruta: '/' },
    };
}
