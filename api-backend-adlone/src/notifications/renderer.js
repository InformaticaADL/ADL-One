import { resolveTemplate, isEmptyValue } from './placeholders.js';
import { renderOutcomeBadge } from './outcomes.js';
import { renderBaseLayout, renderCamposList, renderObservacion, renderCta } from './layout/base-layout.js';
import { renderFichaServicios } from './blocks/ficha-servicios.js';
import { FICHA_CONFIG } from './config/ficha.config.js';

const ALL_CONFIGS = [...FICHA_CONFIG];
const CONFIG_BY_CODE = new Map(ALL_CONFIGS.map((c) => [c.codigo, c]));

const SPECIAL_BLOCKS = {
    fichaServicios: renderFichaServicios,
};

const DEFAULT_APP_URL = 'http://localhost:5173';
const DEFAULT_LOGO_CID = 'logo_adlone';

/**
 * Returns the declarative config for an event code, or null if the event
 * hasn't been migrated to the new renderer yet.
 */
export function getEventConfig(codigoEvento) {
    return CONFIG_BY_CODE.get(codigoEvento) || null;
}

/**
 * Renders an email for the given event code using the new declarative
 * engine. Returns { asunto, html }, or null if there is no config for this
 * event code (caller should fall back to the legacy DB-driven renderer).
 */
export function renderEmail(codigoEvento, context = {}, options = {}) {
    const config = getEventConfig(codigoEvento);
    if (!config) return null;

    const logoCid = options.logoCid || DEFAULT_LOGO_CID;

    const titulo = resolveTemplate(config.titulo, context);
    const asunto = resolveTemplate(config.asunto, context);
    const resumen = config.resumen ? resolveTemplate(config.resumen, context) : '';
    const badgeHtml = renderOutcomeBadge(config.outcome);

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
        observacionHtml = renderObservacion(config.observacion.etiqueta, valor);
    }

    let ctaHtml = '';
    if (config.cta) {
        const appUrl = context.APP_URL || DEFAULT_APP_URL;
        const ruta = resolveTemplate(config.cta.ruta, context);
        ctaHtml = renderCta(config.cta.label, `${appUrl}${ruta}`);
    }

    const html = renderBaseLayout({
        titulo,
        badgeHtml,
        resumen,
        camposHtml,
        bloqueEspecialHtml,
        observacionHtml,
        ctaHtml,
        logoCid,
    });

    return { asunto, html };
}
