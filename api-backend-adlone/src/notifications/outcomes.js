/**
 * Catalog of "outcome" badges. The same badge appearance is reused across
 * every category (FICHA, SOLICITUD_EQUIPO, URS, etc.) — only the label and
 * color vary by outcome, never by category.
 *
 * `INFORMATIVA` has no badge: events that are purely informational (new
 * comments, assignments, mobile-app messages) render the title without a
 * status pill.
 */
export const OUTCOMES = {
    NUEVA: { label: 'NUEVA', color: '#1a56b0', background: '#e8f0fe' },
    APROBADA: { label: 'APROBADA', color: '#1f8b4c', background: '#e3f6e8' },
    RECHAZADA: { label: 'RECHAZADA', color: '#c0392b', background: '#fdecea' },
    EN_REVISION: { label: 'EN REVISIÓN', color: '#b35900', background: '#fff4e5' },
    DERIVADA: { label: 'DERIVADA', color: '#7e3ff2', background: '#f3e8fd' },
    CANCELADA: { label: 'CANCELADA', color: '#787774', background: '#f1f1ef' },
    REPROGRAMADA: { label: 'REPROGRAMADA', color: '#0975a8', background: '#e9f4fb' },
    INFORMATIVA: null,
};

const BADGE_FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/**
 * Renders the HTML for an outcome badge, or '' if the outcome has no badge
 * (INFORMATIVA) or is unknown.
 */
export function renderOutcomeBadge(outcomeKey) {
    const outcome = OUTCOMES[outcomeKey];
    if (!outcome) return '';
    return `<span style="display:inline-block; background:${outcome.background}; color:${outcome.color}; font-size:11px; font-weight:600; padding:3px 10px; border-radius:6px; letter-spacing:0.3px; margin-bottom:14px; font-family:${BADGE_FONT};">${outcome.label}</span>`;
}
