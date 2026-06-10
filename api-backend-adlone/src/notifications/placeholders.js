/**
 * Replaces {KEY} and {KEY_UPPERCASE} placeholders in a template string with
 * values from context. ISO dates (YYYY-MM-DD...) are reformatted to
 * DD-MM-YYYY. Object/null/undefined context values are skipped (left as-is).
 */
export function resolveTemplate(template, context = {}) {
    if (!template) return '';
    let output = String(template);

    for (const [key, value] of Object.entries(context)) {
        if (value === null || value === undefined || typeof value === 'object') continue;

        let val = String(value);
        if (/^\d{4}-\d{2}-\d{2}(\D.*)?$/.test(val)) {
            const parts = val.split(/\D/);
            if (parts.length >= 3 && parts[0].length === 4) {
                val = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        output = output.split(`{${key}}`).join(val);
        output = output.split(`{${key.toUpperCase()}}`).join(val);
    }

    return output;
}

const EMPTY_STRINGS = new Set([
    '', 'no aplica', 'no especificado', 'no especificada', 'undefined', 'null',
]);

/**
 * Returns true if a resolved value should be treated as "no data" — blank,
 * one of the known placeholder fallback strings, or a placeholder that was
 * never resolved (e.g. "{ALGO}" left over because context had no such key).
 */
export function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    const str = String(value).trim();
    if (EMPTY_STRINGS.has(str.toLowerCase())) return true;
    if (/\{[A-Z0-9_]+\}/.test(str)) return true;
    return false;
}
