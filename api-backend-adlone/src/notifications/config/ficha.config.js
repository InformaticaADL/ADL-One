// api-backend-adlone/src/notifications/config/ficha.config.js

/**
 * Detail rows shared by every FICHA_* event. Rows whose resolved value is
 * empty (see placeholders.isEmptyValue) are omitted automatically by the
 * renderer.
 */
const FICHA_CAMPOS_BASE = [
    { icono: '🧪', label: 'Tipo de Monitoreo', variable: '{TIPO_FICHA_INFO}' },
    { icono: '🏭', label: 'Base de Operaciones', variable: '{BASE_OPERACIONES}' },
    { icono: '🏢', label: 'Empresa a Facturar', variable: '{EMPRESA_FACTURAR}' },
    { icono: '🔧', label: 'Empresa Servicio', variable: '{EMPRESA_SERVICIO}' },
    { icono: '📍', label: 'Fuente Emisora', variable: '{FUENTE_EMISORA}' },
    { icono: '🎯', label: 'Objetivo del Muestreo', variable: '{OBJETIVO_MUESTREO}' },
];

// Información del evento (quién y cuándo se realizó la acción), mostrada por
// separado de los datos de la ficha para no confundirla con sus atributos.
const EVENTO_META = { usuario: '{USUARIO}', fecha: '{FECHA}', hora: '{HORA}' };

const OBSERVACION_DEFAULT = { etiqueta: 'Observaciones', variable: '{OBSERVACION}' };

const CTA_FICHA = { label: 'Ver Ficha en ADL ONE', ruta: '/?ficha={ID_FICHA}' };

// Eventos de asignación/reprogramación de muestreo apuntan al Calendario,
// donde el responsable gestiona sus servicios agendados.
const CTA_CALENDARIO = { label: 'Ver Calendario en ADL ONE', ruta: '/?vista=calendario' };

// El evento de muestreo completado apunta al listado de Muestreos Ejecutados,
// donde se ve el avance/resultado del proceso recién finalizado.
const CTA_EJECUTADOS = { label: 'Ver Muestreos Ejecutados', ruta: '/?vista=ejecutados' };

export const FICHA_CONFIG = [
    {
        codigo: 'FICHA_CREADA',
        categoria: 'FICHA',
        outcome: 'NUEVA',
        asunto: 'Nueva Ficha Ingresada: #{CORRELATIVO}',
        titulo: 'Ficha Comercial Creada',
        resumen: 'Se ha creado la ficha de ingreso #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_REMUESTREO_CREADA',
        categoria: 'FICHA',
        outcome: 'NUEVA',
        asunto: 'Nueva Ficha de Remuestreo: #{CORRELATIVO} (Origen: Ficha #{ficha_original})',
        titulo: 'Ficha de Remuestreo Creada',
        resumen: 'Se ha creado la ficha de remuestreo #{CORRELATIVO}, originada desde la ficha #{ficha_original}.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_APROBADA_TECNICA',
        categoria: 'FICHA',
        outcome: 'APROBADA',
        asunto: 'Ficha Aceptada Técnica: #{CORRELATIVO}',
        titulo: 'Ficha Aprobada por Área Técnica',
        resumen: 'La ficha #{CORRELATIVO} fue aprobada por el Área Técnica.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_RECHAZADA_TECNICA',
        categoria: 'FICHA',
        outcome: 'RECHAZADA',
        asunto: 'URGENTE: Ficha Rechazada Técnica: #{CORRELATIVO}',
        titulo: 'Ficha Rechazada por Área Técnica',
        resumen: 'La ficha #{CORRELATIVO} fue rechazada por el Área Técnica.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        observacion: { etiqueta: 'Motivo del Rechazo', variable: '{OBSERVACION}' },
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_APROBADA_COORDINACION',
        categoria: 'FICHA',
        outcome: 'APROBADA',
        asunto: 'Ficha Aceptada Coordinación: #{CORRELATIVO}',
        titulo: 'Ficha Aprobada por Coordinación',
        resumen: 'La ficha #{CORRELATIVO} fue aprobada por Coordinación.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_RECHAZADA_COORDINACION',
        categoria: 'FICHA',
        outcome: 'RECHAZADA',
        asunto: 'URGENTE: Ficha Rechazada Coordinación: #{CORRELATIVO}',
        titulo: 'Ficha Devuelta a Revisión por Coordinación',
        resumen: 'La ficha #{CORRELATIVO} fue devuelta a revisión técnica por Coordinación.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        observacion: { etiqueta: 'Motivo de Devolución', variable: '{OBSERVACION}' },
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_ASIGNADA',
        categoria: 'FICHA',
        outcome: 'INFORMATIVA',
        asunto: 'Muestreo Asignado - Ficha #{CORRELATIVO}',
        titulo: 'Muestreo Asignado',
        resumen: 'Se asignaron fechas y/o responsables de muestreo para la ficha #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        bloqueEspecial: 'fichaServicios',
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_CALENDARIO,
    },
    {
        codigo: 'FICHA_MUESTREO_CANCELADO',
        categoria: 'FICHA',
        outcome: 'CANCELADA',
        asunto: 'ADL ONE: {TITULO_CORREO} #{CORRELATIVO}',
        titulo: 'Muestreo Cancelado',
        resumen: 'Un muestreo de la ficha #{CORRELATIVO} fue cancelado.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        observacion: { etiqueta: 'Motivo de Cancelación', variable: '{OBSERVACION}' },
        cta: CTA_CALENDARIO,
    },
    {
        codigo: 'FICHA_MUESTREO_REPROGRAMADO',
        categoria: 'FICHA',
        outcome: 'REPROGRAMADA',
        asunto: 'Muestreo Reprogramado - Ficha #{CORRELATIVO}',
        titulo: 'Muestreo Reprogramado',
        resumen: 'Se reprogramó un muestreo de la ficha #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        bloqueEspecial: 'fichaServicios',
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_CALENDARIO,
    },
    {
        codigo: 'FICHA_MUESTREO_REASIGNADO',
        categoria: 'FICHA',
        outcome: 'REPROGRAMADA',
        asunto: 'ADL ONE: {TITULO_CORREO} #{CORRELATIVO}',
        titulo: 'Muestreo Reasignado',
        resumen: 'Se reasignó el responsable de un muestreo de la ficha #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        bloqueEspecial: 'fichaServicios',
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_CALENDARIO,
    },
    {
        codigo: 'FICHA_MUESTREO_REAGENDADO',
        categoria: 'FICHA',
        outcome: 'REPROGRAMADA',
        asunto: 'ADL ONE: {TITULO_CORREO} #{CORRELATIVO}',
        titulo: 'Muestreo Reagendado',
        resumen: 'Se reagendó la fecha de un muestreo de la ficha #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        bloqueEspecial: 'fichaServicios',
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_CALENDARIO,
    },
    {
        codigo: 'FICHA_MUESTREO_REAGENDADO_REASIGNADO',
        categoria: 'FICHA',
        outcome: 'REPROGRAMADA',
        asunto: 'ADL ONE: {TITULO_CORREO} #{CORRELATIVO}',
        titulo: 'Muestreo Reagendado y Reasignado',
        resumen: 'Se reagendó la fecha y se reasignó el responsable de un muestreo de la ficha #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        bloqueEspecial: 'fichaServicios',
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_CALENDARIO,
    },
    {
        codigo: 'FICHA_MUESTREO_COMPLETADO',
        categoria: 'FICHA',
        outcome: 'INFORMATIVA',
        asunto: 'Muestreo Completado - Ficha #{CORRELATIVO} - Servicio {NUMERO_SERVICIO}/{TOTAL_SERVICIOS}',
        titulo: 'Muestreo Completado',
        resumen: 'Se completó el servicio {NUMERO_SERVICIO}/{TOTAL_SERVICIOS} de la ficha #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        eventoMeta: EVENTO_META,
        cta: CTA_EJECUTADOS,
    },
];
