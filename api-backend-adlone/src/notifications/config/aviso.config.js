// api-backend-adlone/src/notifications/config/aviso.config.js

const EVENTO_META = { usuario: '{USUARIO}', fecha: '{FECHA}', hora: '{HORA}' };

// Los avisos no apuntan a una vista específica (no hay deep-link de
// solicitudes todavía), así que la CTA lleva al inicio de ADL ONE.
const CTA_HOME = { label: 'Ver en ADL ONE', ruta: '/' };

export const AVISO_CONFIG = [
    {
        codigo: 'AVISO_PERDIDO_NUEVO',
        categoria: 'AVISO',
        outcome: 'NUEVA',
        asunto: 'Reporte de Extravío/Robo: {EQUIPO_NOMBRE}',
        titulo: 'Reporte de Extravío/Robo',
        resumen: '{USUARIO} reportó el extravío del equipo {EQUIPO_NOMBRE}.',
        campos: [
            { icono: '🔧', label: 'Equipo', variable: '{EQUIPO_NOMBRE}' },
            { icono: '🏷️', label: 'Código', variable: '{CODIGO_EQUIPO}' },
            { icono: '📅', label: 'Fecha del Suceso', variable: '{FECHA_SUCESO}' },
        ],
        eventoMeta: EVENTO_META,
        observacion: { etiqueta: 'Detalle', variable: '{OBSERVACION}' },
        cta: CTA_HOME,
    },
    {
        codigo: 'AVISO_PROBLEMA_NUEVO',
        categoria: 'AVISO',
        outcome: 'NUEVA',
        asunto: 'Aviso de Problema Técnico: {EQUIPO_NOMBRE}',
        titulo: 'Aviso de Problema Técnico',
        resumen: '{USUARIO} reportó un problema con el equipo {EQUIPO_NOMBRE}.',
        campos: [
            { icono: '🔧', label: 'Equipo', variable: '{EQUIPO_NOMBRE}' },
            { icono: '🏷️', label: 'Código', variable: '{CODIGO_EQUIPO}' },
        ],
        eventoMeta: EVENTO_META,
        observacion: { etiqueta: 'Descripción del Problema', variable: '{OBSERVACION}' },
        cta: CTA_HOME,
    },
    {
        codigo: 'AVISO_CONSULTA_NUEVA',
        categoria: 'AVISO',
        outcome: 'NUEVA',
        asunto: 'Nueva Consulta General',
        titulo: 'Nueva Consulta General',
        resumen: '{USUARIO} ha enviado una consulta al sistema.',
        eventoMeta: EVENTO_META,
        observacion: { etiqueta: 'Consulta', variable: '{OBSERVACION}' },
        cta: CTA_HOME,
    },
    {
        codigo: 'AVISO_CONSULTA_EQUIPO_NUEVA',
        categoria: 'AVISO',
        outcome: 'NUEVA',
        asunto: 'Nueva Consulta de Equipo: {EQUIPO_NOMBRE}',
        titulo: 'Consulta de Equipo',
        resumen: '{USUARIO} realizó una consulta sobre el equipo {EQUIPO_NOMBRE}.',
        campos: [
            { icono: '🔧', label: 'Equipo', variable: '{EQUIPO_NOMBRE}' },
            { icono: '🏷️', label: 'Código', variable: '{CODIGO_EQUIPO}' },
        ],
        eventoMeta: EVENTO_META,
        observacion: { etiqueta: 'Consulta', variable: '{OBSERVACION}' },
        cta: CTA_HOME,
    },
    {
        codigo: 'AVISO_CONSULTA_FICHA_NUEVA',
        categoria: 'AVISO',
        outcome: 'NUEVA',
        asunto: 'Nueva Consulta de Ficha #{CORRELATIVO}',
        titulo: 'Consulta de Ficha',
        resumen: '{USUARIO} realizó una consulta técnica sobre el servicio #{CORRELATIVO}.',
        eventoMeta: EVENTO_META,
        observacion: { etiqueta: 'Consulta', variable: '{OBSERVACION}' },
        cta: CTA_HOME,
    },
    {
        codigo: 'AVISO_CANCELACION_NUEVA',
        categoria: 'AVISO',
        outcome: 'CANCELADA',
        asunto: 'Cancelación de Muestreo - Servicio #{CORRELATIVO}',
        titulo: 'Cancelación de Muestreo',
        resumen: '{USUARIO} ha reportado la anulación del servicio #{CORRELATIVO}.',
        eventoMeta: EVENTO_META,
        observacion: { etiqueta: 'Motivo de Cancelación', variable: '{OBSERVACION}' },
        cta: CTA_HOME,
    },
];
