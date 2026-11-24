import { resolveTemplate, isEmptyValue } from './placeholders.js';
import { renderOutcomeBadge } from './outcomes.js';
import { renderBaseLayout, renderCamposList, renderMetaInfo, renderObservacion, renderCta } from './layout/base-layout.js';
import { renderFichaServicios } from './blocks/ficha-servicios.js';
import { FICHA_CONFIG } from './config/ficha.config.js';
import { AVISO_CONFIG } from './config/aviso.config.js';
import { configSolicitud } from './config/solicitud.config.js';
import { renderDetalleSolicitud } from './blocks/solicitud-detalle.js';

const ALL_CONFIGS = [...FICHA_CONFIG, ...AVISO_CONFIG];
const CONFIG_BY_CODE = new Map(ALL_CONFIGS.map((c) => [c.codigo, c]));

const SPECIAL_BLOCKS = {
    fichaServicios: renderFichaServicios,
    detalleSolicitud: renderDetalleSolicitud,
};

const DEFAULT_APP_URL = 'http://localhost:5173';
const DEFAULT_LOGO_CID = 'logo_adlone';

/**
 * Returns the declarative config for an event code, or null if the event
 * hasn't been migrated to the new renderer yet.
 */
export function getEventConfig(codigoEvento) {
    return CONFIG_BY_CODE.get(codigoEvento) || configSolicitud(codigoEvento) || null;
}

/**
 * Renders an email for the given event code using the new declarative
 * engine. Returns { asunto, html }, or null if there is no config for this
 * event code (caller should fall back to the legacy DB-driven renderer).
 */
export function renderEmail(codigoEvento, context = {}, options = {}) {
    // Cómo se llama el registro en el correo: «Ficha #1245» por defecto, o «Visita «Edwards» (6 puntos)» cuando el contexto lo indica.
    context = {
        TIPO_REGISTRO: 'Ficha',
        TIPO_REGISTRO_MIN: 'ficha',
        REGISTRO: `#${context.CORRELATIVO ?? context.ID_FICHA ?? ''}`,
        ...context,
    };
    const config = getEventConfig(codigoEvento);
    if (!config) return null;

    const logoCid = options.logoCid || DEFAULT_LOGO_CID;

    // Un texto de la configuración puede ser una plantilla con {VARIABLES} o una función que recibe el contexto (cuando depende de los datos).
    const texto = (v) => (typeof v === 'function' ? v(context) : resolveTemplate(v, context));

    const titulo = texto(config.titulo);
    const asunto = texto(config.asunto);
    const resumen = config.resumen ? texto(config.resumen) : '';
    const badgeHtml = renderOutcomeBadge(typeof config.outcome === 'function' ? config.outcome(context) : config.outcome);

    let metaInfoHtml = '';
    if (config.eventoMeta) {
        metaInfoHtml = renderMetaInfo(
            resolveTemplate(config.eventoMeta.usuario, context),
            resolveTemplate(config.eventoMeta.fecha, context),
            resolveTemplate(config.eventoMeta.hora, context)
        );
    }

    const camposRows = (config.campos || [])
        .map((campo) => ({
            icono: campo.icono,
            label: campo.label,
            valor: resolveTemplate(campo.variable, context),
        }))
        .filter((row) => !isEmptyValue(row.valor));
    const camposHtml = renderCamposList(camposRows);

    let bloqueEspecialHtml = '';
    if (config.bloqueEspecial && SPECIAL_BLOCKS[config.bloqueEspecial]) {
        bloqueEspecialHtml = SPECIAL_BLOCKS[config.bloqueEspecial](context);
    }

    let observacionHtml = '';
    if (config.observacion) {
        const valor = resolveTemplate(config.observacion.variable, context);
        observacionHtml = renderObservacion(texto(config.observacion.etiqueta), valor);
    }

    let ctaHtml = '';
    if (config.cta) {
        const appUrl = context.APP_URL || DEFAULT_APP_URL;
        const ruta = resolveTemplate(config.cta.ruta, context);
        ctaHtml = renderCta(resolveTemplate(config.cta.label, context), `${appUrl}${ruta}`);
    }

    const html = renderBaseLayout({
        titulo,
        badgeHtml,
        resumen,
        metaInfoHtml,
        camposHtml,
        bloqueEspecialHtml,
        observacionHtml,
        ctaHtml,
        logoCid,
    });

    return { asunto, html };
}
