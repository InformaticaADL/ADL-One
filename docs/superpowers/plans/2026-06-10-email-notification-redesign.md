# Email Notification Redesign (FICHA Pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the new declarative, Notion-style email rendering engine and migrate all 12 `FICHA_*` notification events to it, replacing the per-event HTML stored in `mae_evento_notificacion.cuerpo_template_html` for those events.

**Architecture:** A small rendering engine (`src/notifications/`) composed of: a placeholder-resolution helper, an outcome-badge catalog, a base layout renderer (Notion/Shadcn style — logo, title, badge, key/value detail list, optional special block, observation block, optional CTA, footer), one special block (`fichaServicios`, the services table with old→new diff highlighting), and a declarative config file listing all 12 `FICHA_*` events. `notification.service.js` tries the new renderer first (by event code); if no config exists for the event, it falls back to the existing legacy HTML-from-DB path unchanged — so no other category is affected.

**Tech Stack:** Node.js (ESM), `node:test` + `node:assert/strict` for unit tests (no new dependencies), existing `nodemailer`/`mailer.js` for sending.

---

## File Structure

```
api-backend-adlone/src/notifications/
  placeholders.js              // resolveTemplate(), isEmptyValue()
  placeholders.test.js
  outcomes.js                  // OUTCOMES catalog + renderOutcomeBadge()
  outcomes.test.js
  layout/
    base-layout.js              // renderBaseLayout(), renderCamposList(), renderObservacion(), renderCta()
    base-layout.test.js
  blocks/
    ficha-servicios.js          // renderFichaServicios(context)
    ficha-servicios.test.js
  config/
    ficha.config.js             // FICHA_CONFIG: 12 event configs
  renderer.js                   // renderEmail(codigoEvento, context) -> {asunto, html} | null
  renderer.test.js

api-backend-adlone/src/services/notification.service.js   // modified: try renderEmail() first
api-backend-adlone/src/scripts/preview-ficha-emails.js     // new: writes sample HTML files for visual review
```

---

### Task 1: Placeholder resolution helper

**Files:**
- Create: `api-backend-adlone/src/notifications/placeholders.js`
- Test: `api-backend-adlone/src/notifications/placeholders.test.js`

- [ ] **Step 1: Write the failing test**

```js
// api-backend-adlone/src/notifications/placeholders.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTemplate, isEmptyValue } from './placeholders.js';

test('resolveTemplate replaces {VAR} and {VAR_UPPER} placeholders', () => {
    const result = resolveTemplate('Hola {nombre}, ficha #{CORRELATIVO}', {
        nombre: 'Juan',
        CORRELATIVO: '1245',
    });
    assert.equal(result, 'Hola Juan, ficha #1245');
});

test('resolveTemplate converts ISO dates (YYYY-MM-DD) to DD-MM-YYYY', () => {
    const result = resolveTemplate('Fecha: {FECHA_ISO}', { FECHA_ISO: '2026-06-10' });
    assert.equal(result, 'Fecha: 10-06-2026');
});

test('resolveTemplate ignores object/null/undefined context values', () => {
    const result = resolveTemplate('Servicios: {servicios} - Cliente: {cliente}', {
        servicios: [{ a: 1 }],
        cliente: null,
    });
    assert.equal(result, 'Servicios: {servicios} - Cliente: {cliente}');
});

test('resolveTemplate combines two placeholders in the same template', () => {
    const result = resolveTemplate('{FECHA} {HORA}', { FECHA: '10 de junio de 2026', HORA: '16:18' });
    assert.equal(result, '10 de junio de 2026 16:18');
});

test('isEmptyValue treats null, undefined, blank and "No aplica" as empty', () => {
    assert.equal(isEmptyValue(null), true);
    assert.equal(isEmptyValue(undefined), true);
    assert.equal(isEmptyValue('   '), true);
    assert.equal(isEmptyValue('No aplica'), true);
    assert.equal(isEmptyValue('no especificado'), true);
    assert.equal(isEmptyValue('Planta Puerto Montt'), false);
});

test('isEmptyValue treats unresolved {PLACEHOLDER} strings as empty', () => {
    assert.equal(isEmptyValue('{ALGUNA_VARIABLE}'), true);
    assert.equal(isEmptyValue('Texto {ALGUNA_VARIABLE} mezclado'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api-backend-adlone/src/notifications/placeholders.test.js`
Expected: FAIL — `Cannot find module './placeholders.js'`

- [ ] **Step 3: Write the implementation**

```js
// api-backend-adlone/src/notifications/placeholders.js

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api-backend-adlone/src/notifications/placeholders.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
cd "api-backend-adlone"
git add src/notifications/placeholders.js src/notifications/placeholders.test.js
git commit -m "feat(notifications): add placeholder resolution helper"
```

---

### Task 2: Outcome badge catalog

**Files:**
- Create: `api-backend-adlone/src/notifications/outcomes.js`
- Test: `api-backend-adlone/src/notifications/outcomes.test.js`

- [ ] **Step 1: Write the failing test**

```js
// api-backend-adlone/src/notifications/outcomes.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OUTCOMES, renderOutcomeBadge } from './outcomes.js';

test('OUTCOMES catalog has the 8 approved states', () => {
    const keys = Object.keys(OUTCOMES);
    assert.deepEqual(keys.sort(), [
        'APROBADA', 'CANCELADA', 'DERIVADA', 'EN_REVISION',
        'INFORMATIVA', 'NUEVA', 'RECHAZADA', 'REPROGRAMADA',
    ]);
});

test('renderOutcomeBadge renders a span with label and colors for a real outcome', () => {
    const html = renderOutcomeBadge('RECHAZADA');
    assert.match(html, /RECHAZADA/);
    assert.match(html, /#c0392b/); // text color
    assert.match(html, /#fdecea/); // background color
});

test('renderOutcomeBadge returns empty string for INFORMATIVA (no badge)', () => {
    assert.equal(renderOutcomeBadge('INFORMATIVA'), '');
});

test('renderOutcomeBadge returns empty string for unknown outcome', () => {
    assert.equal(renderOutcomeBadge('NO_EXISTE'), '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api-backend-adlone/src/notifications/outcomes.test.js`
Expected: FAIL — `Cannot find module './outcomes.js'`

- [ ] **Step 3: Write the implementation**

```js
// api-backend-adlone/src/notifications/outcomes.js

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api-backend-adlone/src/notifications/outcomes.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd "api-backend-adlone"
git add src/notifications/outcomes.js src/notifications/outcomes.test.js
git commit -m "feat(notifications): add outcome badge catalog"
```

---

### Task 3: Base layout renderer

**Files:**
- Create: `api-backend-adlone/src/notifications/layout/base-layout.js`
- Test: `api-backend-adlone/src/notifications/layout/base-layout.test.js`

- [ ] **Step 1: Write the failing test**

```js
// api-backend-adlone/src/notifications/layout/base-layout.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBaseLayout, renderCamposList, renderObservacion, renderCta } from './base-layout.js';

test('renderCamposList renders one row per item with icon, label and value', () => {
    const html = renderCamposList([
        { icono: '📄', label: 'Ficha', valor: '#1245' },
        { icono: '🏭', label: 'Centro', valor: 'Planta Puerto Montt' },
    ]);
    assert.match(html, /📄/);
    assert.match(html, /Ficha/);
    assert.match(html, /#1245/);
    assert.match(html, /Planta Puerto Montt/);
});

test('renderCamposList returns empty string for an empty list', () => {
    assert.equal(renderCamposList([]), '');
});

test('renderObservacion returns empty string for empty value', () => {
    assert.equal(renderObservacion('Observaciones', ''), '');
    assert.equal(renderObservacion('Observaciones', null), '');
});

test('renderObservacion renders neutral style for "Sin observaciones"', () => {
    const html = renderObservacion('Observaciones', 'Sin observaciones');
    assert.match(html, /Sin observaciones/);
    assert.match(html, /#cbd5e1/); // neutral border color
});

test('renderObservacion renders amber accent style for real text', () => {
    const html = renderObservacion('Motivo del rechazo', 'Faltan datos de muestreo');
    assert.match(html, /Faltan datos de muestreo/);
    assert.match(html, /Motivo del rechazo/);
    assert.match(html, /#d97706/); // amber accent color
});

test('renderCta renders a link with label and href', () => {
    const html = renderCta('Ver Ficha', 'http://localhost:5173/medio-ambiente/fichas/1245');
    assert.match(html, /Ver Ficha/);
    assert.match(html, /http:\/\/localhost:5173\/medio-ambiente\/fichas\/1245/);
});

test('renderCta returns empty string when label or href is missing', () => {
    assert.equal(renderCta('', 'http://x'), '');
    assert.equal(renderCta('Ver', ''), '');
});

test('renderBaseLayout assembles the full document with title, badge, sections and footer', () => {
    const html = renderBaseLayout({
        titulo: 'Ficha Comercial Creada',
        badgeHtml: '<span>NUEVA</span>',
        resumen: 'Se ha creado la ficha #1245.',
        camposHtml: '<div>campos</div>',
        bloqueEspecialHtml: '<div>especial</div>',
        observacionHtml: '<div>observacion</div>',
        ctaHtml: '<a>Ver Ficha</a>',
        logoCid: 'logo_adlone',
    });

    assert.match(html, /<!DOCTYPE html>/);
    assert.match(html, /cid:logo_adlone/);
    assert.match(html, /Ficha Comercial Creada/);
    assert.match(html, /<span>NUEVA<\/span>/);
    assert.match(html, /Se ha creado la ficha #1245\./);
    assert.match(html, /<div>campos<\/div>/);
    assert.match(html, /<div>especial<\/div>/);
    assert.match(html, /<div>observacion<\/div>/);
    assert.match(html, /<a>Ver Ficha<\/a>/);
    assert.match(html, /ADL Diagnostic Chile SpA/);
});

test('renderBaseLayout omits optional sections when empty', () => {
    const html = renderBaseLayout({
        titulo: 'Ficha Comercial Creada',
        badgeHtml: '',
        resumen: '',
        camposHtml: '<div>campos</div>',
        bloqueEspecialHtml: '',
        observacionHtml: '',
        ctaHtml: '',
        logoCid: 'logo_adlone',
    });
    assert.doesNotMatch(html, /<p[^>]*><\/p>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api-backend-adlone/src/notifications/layout/base-layout.test.js`
Expected: FAIL — `Cannot find module './base-layout.js'`

- [ ] **Step 3: Write the implementation**

```js
// api-backend-adlone/src/notifications/layout/base-layout.js
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
    return `<a href="${href}" style="display:inline-block; background:#0062a8; color:#fff; font-size:14px; font-weight:600; padding:10px 20px; border-radius:8px; text-decoration:none; font-family:${FONT};">${label}</a>`;
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
              <img src="cid:${logoCid}" alt="ADL ONE" width="120" style="display:block; height:28px; width:auto; border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 24px 28px;">
              <h2 style="margin:0 0 6px 0; font-size:18px; color:#1f1f1f; font-weight:600; font-family:${FONT};">${titulo}</h2>
              ${badgeHtml}
              ${resumen ? `<p style="font-size:14px; color:#787774; line-height:1.6; margin:12px 0 18px 0; font-family:${FONT};">${resumen}</p>` : ''}
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api-backend-adlone/src/notifications/layout/base-layout.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
cd "api-backend-adlone"
git add src/notifications/layout/base-layout.js src/notifications/layout/base-layout.test.js
git commit -m "feat(notifications): add Notion-style base layout renderer"
```

---

### Task 4: Ficha-servicios special block

This block renders the "Detalle de Servicios" section used by `FICHA_ASIGNADA`,
`FICHA_MUESTREO_REPROGRAMADO`, `FICHA_MUESTREO_REASIGNADO`,
`FICHA_MUESTREO_REAGENDADO` and `FICHA_MUESTREO_REAGENDADO_REASIGNADO`. It
consumes `context.servicios` (array), the same shape produced today by
`ficha.service.js` (see `src/services/ficha.service.js:2839-2851`):

```js
{
  numero: '1',
  muestreador_instalacion: 'Juan Pérez',
  muestreador_retiro: 'No asignado',
  fecha_muestreo: '12-06-2026',
  fecha_retiro: 'No asignada',
  old_fecha: null,                    // set when value changed (reprogramación)
  old_fecha_retiro: null,
  old_muestreador_instalacion: null,
  old_muestreador_retiro: null,
  isModified: false,
}
```

**Files:**
- Create: `api-backend-adlone/src/notifications/blocks/ficha-servicios.js`
- Test: `api-backend-adlone/src/notifications/blocks/ficha-servicios.test.js`

- [ ] **Step 1: Write the failing test**

```js
// api-backend-adlone/src/notifications/blocks/ficha-servicios.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFichaServicios } from './ficha-servicios.js';

test('returns empty string when context.servicios is missing or empty', () => {
    assert.equal(renderFichaServicios({}), '');
    assert.equal(renderFichaServicios({ servicios: [] }), '');
});

test('renders a card per service with installation/retiro and dates', () => {
    const html = renderFichaServicios({
        servicios: [
            {
                numero: '1',
                muestreador_instalacion: 'Juan Pérez',
                muestreador_retiro: 'No asignado',
                fecha_muestreo: '12-06-2026',
                fecha_retiro: 'No asignada',
                old_fecha: null,
                old_fecha_retiro: null,
                old_muestreador_instalacion: null,
                old_muestreador_retiro: null,
                isModified: false,
            },
        ],
    });

    assert.match(html, /Servicio 1/);
    assert.match(html, /Juan Pérez/);
    assert.match(html, /12-06-2026/);
    // "Muestreador Ret." row is omitted when retiro is "No asignado" and unchanged
    assert.doesNotMatch(html, /Muestreador Ret\./);
    // "Fecha Retiro" row is omitted when retiro date is "No asignada" and unchanged
    assert.doesNotMatch(html, /Fecha Retiro/);
});

test('highlights old -> new values with strikethrough when a field changed', () => {
    const html = renderFichaServicios({
        servicios: [
            {
                numero: '2',
                muestreador_instalacion: 'María Soto',
                muestreador_retiro: 'No asignado',
                fecha_muestreo: '15-06-2026',
                fecha_retiro: 'No asignada',
                old_fecha: '12-06-2026',
                old_fecha_retiro: null,
                old_muestreador_instalacion: 'Juan Pérez',
                old_muestreador_retiro: null,
                isModified: true,
            },
        ],
    });

    assert.match(html, /text-decoration:line-through/);
    assert.match(html, /Juan Pérez/);
    assert.match(html, /María Soto/);
    assert.match(html, /12-06-2026/);
    assert.match(html, /15-06-2026/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api-backend-adlone/src/notifications/blocks/ficha-servicios.test.js`
Expected: FAIL — `Cannot find module './ficha-servicios.js'`

- [ ] **Step 3: Write the implementation**

```js
// api-backend-adlone/src/notifications/blocks/ficha-servicios.js

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api-backend-adlone/src/notifications/blocks/ficha-servicios.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd "api-backend-adlone"
git add src/notifications/blocks/ficha-servicios.js src/notifications/blocks/ficha-servicios.test.js
git commit -m "feat(notifications): add ficha-servicios special block"
```

---

### Task 5: FICHA category config (12 events)

**Files:**
- Create: `api-backend-adlone/src/notifications/config/ficha.config.js`

This is pure data — no test file needed (it's exercised end-to-end by
Task 6's renderer tests). Field reference used by all 12 events comes from
`ficha.service.js getFichaContextForNotification()` (`CORRELATIVO`,
`TIPO_FICHA_INFO`, `BASE_OPERACIONES`, `EMPRESA_FACTURAR`, `EMPRESA_SERVICIO`,
`FUENTE_EMISORA`, `OBJETIVO_MUESTREO`, `USUARIO`, `FECHA`, `HORA`) plus
`OBSERVACION` (added by `uns.service.js`).

- [ ] **Step 1: Write the config file**

```js
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
    { icono: '👤', label: 'Responsable', variable: '{USUARIO}' },
    { icono: '🕒', label: 'Fecha', variable: '{FECHA} {HORA}' },
];

const OBSERVACION_DEFAULT = { etiqueta: 'Observaciones', variable: '{OBSERVACION}' };

const CTA_FICHA = { label: 'Ver Ficha en ADL ONE', ruta: '/medio-ambiente/fichas/{CORRELATIVO}' };

export const FICHA_CONFIG = [
    {
        codigo: 'FICHA_CREADA',
        categoria: 'FICHA',
        outcome: 'NUEVA',
        asunto: 'Nueva Ficha Ingresada: #{CORRELATIVO}',
        titulo: 'Ficha Comercial Creada',
        resumen: 'Se ha creado la ficha de ingreso #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
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
        bloqueEspecial: 'fichaServicios',
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_MUESTREO_CANCELADO',
        categoria: 'FICHA',
        outcome: 'CANCELADA',
        asunto: 'ADL ONE: {TITULO_CORREO} #{CORRELATIVO}',
        titulo: 'Muestreo Cancelado',
        resumen: 'Un muestreo de la ficha #{CORRELATIVO} fue cancelado.',
        campos: FICHA_CAMPOS_BASE,
        observacion: { etiqueta: 'Motivo de Cancelación', variable: '{OBSERVACION}' },
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_MUESTREO_REPROGRAMADO',
        categoria: 'FICHA',
        outcome: 'REPROGRAMADA',
        asunto: 'Muestreo Reprogramado - Ficha #{CORRELATIVO}',
        titulo: 'Muestreo Reprogramado',
        resumen: 'Se reprogramó un muestreo de la ficha #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        bloqueEspecial: 'fichaServicios',
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_MUESTREO_REASIGNADO',
        categoria: 'FICHA',
        outcome: 'REPROGRAMADA',
        asunto: 'ADL ONE: {TITULO_CORREO} #{CORRELATIVO}',
        titulo: 'Muestreo Reasignado',
        resumen: 'Se reasignó el responsable de un muestreo de la ficha #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        bloqueEspecial: 'fichaServicios',
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_MUESTREO_REAGENDADO',
        categoria: 'FICHA',
        outcome: 'REPROGRAMADA',
        asunto: 'ADL ONE: {TITULO_CORREO} #{CORRELATIVO}',
        titulo: 'Muestreo Reagendado',
        resumen: 'Se reagendó la fecha de un muestreo de la ficha #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        bloqueEspecial: 'fichaServicios',
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_FICHA,
    },
    {
        codigo: 'FICHA_MUESTREO_REAGENDADO_REASIGNADO',
        categoria: 'FICHA',
        outcome: 'REPROGRAMADA',
        asunto: 'ADL ONE: {TITULO_CORREO} #{CORRELATIVO}',
        titulo: 'Muestreo Reagendado y Reasignado',
        resumen: 'Se reagendó la fecha y se reasignó el responsable de un muestreo de la ficha #{CORRELATIVO}.',
        campos: FICHA_CAMPOS_BASE,
        bloqueEspecial: 'fichaServicios',
        observacion: OBSERVACION_DEFAULT,
        cta: CTA_FICHA,
    },
];
```

- [ ] **Step 2: Commit**

```bash
cd "api-backend-adlone"
git add src/notifications/config/ficha.config.js
git commit -m "feat(notifications): add FICHA category event configs"
```

---

### Task 6: Renderer

**Files:**
- Create: `api-backend-adlone/src/notifications/renderer.js`
- Test: `api-backend-adlone/src/notifications/renderer.test.js`

- [ ] **Step 1: Write the failing test**

```js
// api-backend-adlone/src/notifications/renderer.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderEmail, getEventConfig } from './renderer.js';

const BASE_CONTEXT = {
    CORRELATIVO: '1245',
    TIPO_FICHA_INFO: 'Monitoreo Agua/Ril - Terreno',
    BASE_OPERACIONES: 'Puerto Montt',
    EMPRESA_FACTURAR: 'Empresa XYZ',
    EMPRESA_SERVICIO: 'Servicios ABC',
    FUENTE_EMISORA: 'Planta Norte',
    OBJETIVO_MUESTREO: 'Cumplimiento Normativo',
    USUARIO: 'J. Pérez',
    FECHA: '10 de junio de 2026',
    HORA: '16:18',
    OBSERVACION: 'Sin observaciones',
};

test('returns null for an event with no config (not yet migrated)', () => {
    assert.equal(renderEmail('SOL_EQUIPO_NUEVA', BASE_CONTEXT), null);
    assert.equal(getEventConfig('SOL_EQUIPO_NUEVA'), null);
});

test('renders FICHA_CREADA: subject, title, badge, fields and CTA', () => {
    const result = renderEmail('FICHA_CREADA', BASE_CONTEXT);

    assert.equal(result.asunto, 'Nueva Ficha Ingresada: #1245');
    assert.match(result.html, /Ficha Comercial Creada/);
    assert.match(result.html, /NUEVA/);
    assert.match(result.html, /Monitoreo Agua\/Ril - Terreno/);
    assert.match(result.html, /Puerto Montt/);
    assert.match(result.html, /J\. Pérez/);
    assert.match(result.html, /10 de junio de 2026 16:18/);
    assert.match(result.html, /Sin observaciones/);
    assert.match(result.html, /Ver Ficha en ADL ONE/);
    assert.match(result.html, /\/medio-ambiente\/fichas\/1245/);
});

test('renders FICHA_RECHAZADA_TECNICA with RECHAZADA badge and motivo label', () => {
    const result = renderEmail('FICHA_RECHAZADA_TECNICA', {
        ...BASE_CONTEXT,
        OBSERVACION: 'Faltan datos de muestreo en el sector norte.',
    });

    assert.match(result.asunto, /URGENTE: Ficha Rechazada Técnica: #1245/);
    assert.match(result.html, /RECHAZADA/);
    assert.match(result.html, /Motivo del Rechazo/);
    assert.match(result.html, /Faltan datos de muestreo en el sector norte\./);
});

test('renders FICHA_ASIGNADA with the ficha-servicios special block', () => {
    const result = renderEmail('FICHA_ASIGNADA', {
        ...BASE_CONTEXT,
        servicios: [
            {
                numero: '1',
                muestreador_instalacion: 'Juan Pérez',
                muestreador_retiro: 'No asignado',
                fecha_muestreo: '12-06-2026',
                fecha_retiro: 'No asignada',
                old_fecha: null,
                old_fecha_retiro: null,
                old_muestreador_instalacion: null,
                old_muestreador_retiro: null,
                isModified: false,
            },
        ],
    });

    assert.match(result.html, /Detalle de Servicios/);
    assert.match(result.html, /Servicio 1/);
    assert.match(result.html, /Juan Pérez/);
    // INFORMATIVA outcome has no badge
    assert.doesNotMatch(result.html, />NUEVA</);
});

test('omits a campo row when its value is empty', () => {
    const result = renderEmail('FICHA_CREADA', {
        ...BASE_CONTEXT,
        EMPRESA_SERVICIO: 'No aplica',
    });
    assert.doesNotMatch(result.html, /Empresa Servicio/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test api-backend-adlone/src/notifications/renderer.test.js`
Expected: FAIL — `Cannot find module './renderer.js'`

- [ ] **Step 3: Write the implementation**

```js
// api-backend-adlone/src/notifications/renderer.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test api-backend-adlone/src/notifications/renderer.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full notifications test suite**

Run: `node --test api-backend-adlone/src/notifications`
Expected: PASS (all tests across all 4 files)

- [ ] **Step 6: Commit**

```bash
cd "api-backend-adlone"
git add src/notifications/renderer.js src/notifications/renderer.test.js
git commit -m "feat(notifications): add renderEmail() combining config, layout and blocks"
```

---

### Task 7: Wire the new renderer into `notification.service.js`

**Files:**
- Modify: `api-backend-adlone/src/services/notification.service.js:1-13` (imports)
- Modify: `api-backend-adlone/src/services/notification.service.js:111-145` (compile step)

This task makes `send()` try the new renderer first for any event code that
has a config (currently only the 12 `FICHA_*` events). For every other event
code, behavior is unchanged — the existing `_compileTemplate`/DB-driven path
still runs exactly as before.

- [ ] **Step 1: Add the import**

In `api-backend-adlone/src/services/notification.service.js`, add this import
near the top of the file, alongside the existing imports (after the
`fileURLToPath`/`__dirname` setup, e.g. right before `class NotificationService`):

```js
import { renderEmail } from '../notifications/renderer.js';
```

- [ ] **Step 2: Replace the "Compilar Asunto y Cuerpo" block**

Locate this block in `send()` (currently lines 111-145):

```js
            // 4. Compilar Asunto y Cuerpo
            let baseTemplate = '';
            try {
                baseTemplate = fs.readFileSync(path.resolve(__dirname, '../templates/base_email.html'), 'utf8');
            } catch (e) {
                logger.warn('No se pudo cargar base_email.html, usando fallback');
            }

            let rawHtml = event.cuerpo_template_html || '<p>Notificación del Sistema ADL One</p>';
            
            // Determine theme color
            context.THEME_COLOR = eventCode.includes('RECH') || eventCode.includes('CANCEL') ? '#e11d48' : (eventCode.includes('APR') ? '#0d9488' : '#0062a8');
            context.THEME_BG = eventCode.includes('RECH') || eventCode.includes('CANCEL') ? '#ffe4e6' : (eventCode.includes('APR') ? '#f0fdf4' : '#f0f9ff');
            context.THEME_BORDER = eventCode.includes('RECH') || eventCode.includes('CANCEL') ? '#fda4af' : (eventCode.includes('APR') ? '#bbf7d0' : '#bae6fd');
            context.TITLE = this._compileTemplate(event.asunto_template, context, false).html;

            let htmlBody = '';
            let attachments = [];
            // If it's a modern standard template (no <html> tag), wrap it
            if (baseTemplate && !rawHtml.includes('<!DOCTYPE html>')) {
                // Pre-compile the inner content first
                const innerHtmlResult = this._compileTemplate(rawHtml, context, true);
                context.EMAIL_CONTENT = innerHtmlResult.html;
                // Then compile the outer template
                const compileResultOuter = this._compileTemplate(baseTemplate, context, true);
                htmlBody = compileResultOuter.html;
                attachments = [...innerHtmlResult.attachments, ...compileResultOuter.attachments];
            } else {
                // Legacy
                const compileResultLegacy = this._compileTemplate(rawHtml, context, true);
                htmlBody = compileResultLegacy.html;
                attachments = compileResultLegacy.attachments;
            }
            
            const subject = context.TITLE;
```

Replace it with:

```js
            // 4. Compilar Asunto y Cuerpo
            // Fase 1: motor declarativo nuevo (Notion-style). Si el evento no
            // tiene configuración migrada, renderEmail() devuelve null y se
            // usa el motor legado (HTML desde mae_evento_notificacion).
            const rendered = renderEmail(eventCode, context);

            let subject;
            let htmlBody;
            let attachments;

            if (rendered) {
                subject = rendered.asunto;
                htmlBody = rendered.html;
                attachments = this.logoBuffer
                    ? [{ filename: 'logo-adlone.png', content: this.logoBuffer, cid: 'logo_adlone' }]
                    : [];
            } else {
                let baseTemplate = '';
                try {
                    baseTemplate = fs.readFileSync(path.resolve(__dirname, '../templates/base_email.html'), 'utf8');
                } catch (e) {
                    logger.warn('No se pudo cargar base_email.html, usando fallback');
                }

                let rawHtml = event.cuerpo_template_html || '<p>Notificación del Sistema ADL One</p>';

                // Determine theme color
                context.THEME_COLOR = eventCode.includes('RECH') || eventCode.includes('CANCEL') ? '#e11d48' : (eventCode.includes('APR') ? '#0d9488' : '#0062a8');
                context.THEME_BG = eventCode.includes('RECH') || eventCode.includes('CANCEL') ? '#ffe4e6' : (eventCode.includes('APR') ? '#f0fdf4' : '#f0f9ff');
                context.THEME_BORDER = eventCode.includes('RECH') || eventCode.includes('CANCEL') ? '#fda4af' : (eventCode.includes('APR') ? '#bbf7d0' : '#bae6fd');
                context.TITLE = this._compileTemplate(event.asunto_template, context, false).html;

                // If it's a modern standard template (no <html> tag), wrap it
                if (baseTemplate && !rawHtml.includes('<!DOCTYPE html>')) {
                    // Pre-compile the inner content first
                    const innerHtmlResult = this._compileTemplate(rawHtml, context, true);
                    context.EMAIL_CONTENT = innerHtmlResult.html;
                    // Then compile the outer template
                    const compileResultOuter = this._compileTemplate(baseTemplate, context, true);
                    htmlBody = compileResultOuter.html;
                    attachments = [...innerHtmlResult.attachments, ...compileResultOuter.attachments];
                } else {
                    // Legacy
                    const compileResultLegacy = this._compileTemplate(rawHtml, context, true);
                    htmlBody = compileResultLegacy.html;
                    attachments = compileResultLegacy.attachments;
                }

                subject = context.TITLE;
            }
```

- [ ] **Step 3: Verify the rest of `send()` still references `subject`, `htmlBody`, `attachments` only**

Run:
```bash
cd "api-backend-adlone"
node -e "
const fs = require('fs');
const src = fs.readFileSync('src/services/notification.service.js', 'utf8');
const m = src.match(/const mailOptions = \{[\s\S]*?\};/);
console.log(m[0]);
"
```
Expected output includes `subject: subject`, `html: htmlBody`, `attachments: attachments || []` — unchanged from before, confirming the variable names still line up.

- [ ] **Step 4: Run the full notifications test suite again (no regressions)**

Run: `node --test api-backend-adlone/src/notifications`
Expected: PASS (all tests)

- [ ] **Step 5: Sanity-check the file still parses correctly**

Run: `node --check api-backend-adlone/src/services/notification.service.js`
Expected: no output (exit code 0)

- [ ] **Step 6: Commit**

```bash
cd "api-backend-adlone"
git add src/services/notification.service.js
git commit -m "feat(notifications): use new renderer for migrated events, fall back to legacy"
```

---

### Task 8: Visual preview script for manual review

**Files:**
- Create: `api-backend-adlone/src/scripts/preview-ficha-emails.js`

This script renders sample HTML for the two most visually distinct FICHA
events (`FICHA_CREADA` — plain detail list with CTA, and
`FICHA_ASIGNADA` — includes the services special block plus a reprogramación
example with old→new diffs) and writes them to disk so they can be opened in
a browser for visual review before wider rollout. It does **not** require a
database connection.

- [ ] **Step 1: Write the script**

```js
// api-backend-adlone/src/scripts/preview-ficha-emails.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderEmail } from '../notifications/renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '../../.preview-emails');

const BASE_CONTEXT = {
    CORRELATIVO: '1245',
    TIPO_FICHA_INFO: 'Monitoreo Agua/Ril - Terreno',
    BASE_OPERACIONES: 'Puerto Montt',
    EMPRESA_FACTURAR: 'Empresa XYZ SpA',
    EMPRESA_SERVICIO: 'Servicios Ambientales ABC',
    FUENTE_EMISORA: 'Planta Norte',
    OBJETIVO_MUESTREO: 'Cumplimiento Normativo DS90',
    USUARIO: 'J. Pérez',
    FECHA: '10 de junio de 2026',
    HORA: '16:18',
    OBSERVACION: 'Sin observaciones',
};

const samples = {
    'ficha-creada.html': renderEmail('FICHA_CREADA', BASE_CONTEXT),
    'ficha-rechazada-tecnica.html': renderEmail('FICHA_RECHAZADA_TECNICA', {
        ...BASE_CONTEXT,
        OBSERVACION: 'Faltan datos de muestreo en el sector norte.',
    }),
    'ficha-asignada.html': renderEmail('FICHA_ASIGNADA', {
        ...BASE_CONTEXT,
        servicios: [
            {
                numero: '1',
                muestreador_instalacion: 'Juan Pérez',
                muestreador_retiro: 'No asignado',
                fecha_muestreo: '12-06-2026',
                fecha_retiro: 'No asignada',
                old_fecha: null,
                old_fecha_retiro: null,
                old_muestreador_instalacion: null,
                old_muestreador_retiro: null,
                isModified: false,
            },
        ],
    }),
    'ficha-muestreo-reagendado.html': renderEmail('FICHA_MUESTREO_REAGENDADO', {
        ...BASE_CONTEXT,
        OBSERVACION: 'Cliente solicitó cambio de fecha por mantención de planta.',
        servicios: [
            {
                numero: '2',
                muestreador_instalacion: 'María Soto',
                muestreador_retiro: 'No asignado',
                fecha_muestreo: '15-06-2026',
                fecha_retiro: 'No asignada',
                old_fecha: '12-06-2026',
                old_fecha_retiro: null,
                old_muestreador_instalacion: null,
                old_muestreador_retiro: null,
                isModified: true,
            },
        ],
    }),
};

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [filename, result] of Object.entries(samples)) {
    if (!result) {
        console.warn(`No config found, skipping ${filename}`);
        continue;
    }
    const outPath = path.join(OUT_DIR, filename);
    // Replace the cid: logo reference with a placeholder so the HTML
    // renders standalone in a browser (no email attachment available here).
    const html = result.html.replace('cid:logo_adlone', 'https://dummyimage.com/120x28/0062a8/ffffff.png&text=ADL+ONE');
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Asunto: ${result.asunto}`);
    console.log(`Wrote ${outPath}`);
}
```

- [ ] **Step 2: Run it**

Run: `node api-backend-adlone/src/scripts/preview-ficha-emails.js`
Expected: prints 4 "Asunto: ..." lines and 4 "Wrote ..." lines, creating
`api-backend-adlone/.preview-emails/*.html`.

- [ ] **Step 3: Open the generated files in a browser and review visually**

Open each of:
- `api-backend-adlone/.preview-emails/ficha-creada.html`
- `api-backend-adlone/.preview-emails/ficha-rechazada-tecnica.html`
- `api-backend-adlone/.preview-emails/ficha-asignada.html`
- `api-backend-adlone/.preview-emails/ficha-muestreo-reagendado.html`

Confirm: logo placeholder + title + badge render correctly, detail rows show
icons/labels/values, observation block shows the right accent color
(amber for real text, gray for "Sin observaciones"), the services block
shows old→new diffs in `ficha-muestreo-reagendado.html`, and the CTA button
appears where configured.

- [ ] **Step 4: Add `.preview-emails/` to `.gitignore`**

Append to `api-backend-adlone/.gitignore`:
```
.preview-emails/
```

- [ ] **Step 5: Commit**

```bash
cd "api-backend-adlone"
git add src/scripts/preview-ficha-emails.js .gitignore
git commit -m "chore(notifications): add visual preview script for FICHA emails"
```

---

## Out of scope (tracked in the design spec)

- Migrating `SOLICITUD_EQUIPO`, `URS`, `AVISO_MOVIL`, `ENVIO_CLIENTE`,
  `SEGURIDAD` and `CHAT` categories — separate follow-up plans, one per
  category, once this pilot is validated in production.
- CTA deep-linking into the SPA (currently links to `APP_URL` + path; the
  frontend has no router to consume that path yet).
- Removing `asunto_template`/`cuerpo_template_html` columns from
  `mae_evento_notificacion`.
