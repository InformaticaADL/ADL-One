import test from 'node:test';
import assert from 'node:assert/strict';
import { armarCorreo, formatoDuracion, servicioDe } from './correos.js';

const MIN = 60000;
const base = { desde: Date.UTC(2026, 10, 23, 17, 30), duracionMs: 5 * MIN, fallos: 3, motivo: 'no respondió en 10 s' };

test('formatoDuracion', () => {
    assert.equal(formatoDuracion(20 * 1000), 'menos de 1 min');
    assert.equal(formatoDuracion(4 * MIN), '4 min');
    assert.equal(formatoDuracion(60 * MIN), '1 h');
    assert.equal(formatoDuracion(135 * MIN), '2 h 15 min');
});

test('aviso de caída del frontend: asunto, motivo y pasos solo para ese proceso', () => {
    const c = armarCorreo({ tipo: 'CAIDO', ...base }, 'frontend');
    assert.match(c.subject, /^\[ADL ONE\] La pantalla web de ADL ONE no responde$/);
    assert.match(c.text, /no respondió en 10 s/);
    assert.match(c.text, /pm2 stop adl-one-frontend/);
    assert.match(c.text, /pm2 start adl-one-frontend/);
    assert.match(c.text, /":5174"/);
    assert.match(c.text, /nunca "pm2 restart" ni "pm2 restart all"/);
    assert.doesNotMatch(c.text, /adl-one-backend/); // no mezcla el otro proceso
});

test('aviso de caída del backend usa su propio proceso y puerto', () => {
    const c = armarCorreo({ tipo: 'CAIDO', ...base }, 'backend');
    assert.match(c.text, /pm2 stop adl-one-backend/);
    assert.match(c.text, /":8002"/);
    assert.doesNotMatch(c.text, /adl-one-frontend/);
});

test('el recordatorio dice que SIGUE caído y hace cuánto', () => {
    const c = armarCorreo({ tipo: 'RECORDATORIO', ...base, duracionMs: 135 * MIN }, 'frontend');
    assert.match(c.subject, /SIGUE SIN RESPONDER/);
    assert.match(c.subject, /2 h 15 min/);
});

test('el aviso de recuperación dice cuánto duró y no pide hacer nada', () => {
    const c = armarCorreo({ tipo: 'RECUPERADO', ...base, duracionMs: 7 * MIN }, 'backend');
    assert.match(c.subject, /volvió a responder/);
    assert.match(c.text, /7 min/);
    assert.match(c.text, /No hace falta hacer nada más/);
    assert.doesNotMatch(c.text, /pm2 stop/);
});

test('la hora se muestra en horario de Chile', () => {
    // 17:30 UTC del 23-nov-2026 = 14:30 en Chile (UTC-3 en verano)
    const c = armarCorreo({ tipo: 'CAIDO', ...base }, 'frontend');
    assert.match(c.text, /desde el 23-11-2026 a las 14:30\./);
});

test('el html escapa el motivo (no inyecta etiquetas)', () => {
    const c = armarCorreo({ tipo: 'CAIDO', ...base, motivo: '<script>x</script>' }, 'frontend');
    assert.doesNotMatch(c.html, /<script>/);
    assert.match(c.html, /&lt;script&gt;/);
});

test('servicio desconocido no rompe', () => {
    assert.equal(servicioDe('otro').proceso, 'otro');
});

// ── Diseño: mismo layout que el resto de los correos de ADL ONE ──────────────────────────────────────────────────────────────────────────────
test('el HTML usa el layout común: logo incrustado, insignia roja y pie de ADL', () => {
    const c = armarCorreo({ tipo: 'CAIDO', ...base }, 'frontend');
    assert.equal(c.logoCid, 'logo_adlone');
    assert.match(c.html, /src="cid:logo_adlone"/);
    assert.match(c.html, /SIN RESPUESTA/);
    assert.match(c.html, /#fdecea/); // fondo rojo suave de la insignia
    assert.match(c.html, /ADL Diagnostic Chile SpA/);
    assert.match(c.html, /<h2[^>]*>La pantalla web de ADL ONE no responde<\/h2>/);
});

test('el HTML trae la lista de datos y los pasos con los comandos en recuadro de código', () => {
    const c = armarCorreo({ tipo: 'CAIDO', ...base }, 'frontend');
    for (const etiqueta of ['Servicio', 'Sin respuesta desde', 'Duración', 'Motivo', 'Fallos seguidos', 'Proceso y puerto']) assert.match(c.html, new RegExp(etiqueta), etiqueta);
    assert.match(c.html, /23-11-2026 14:30/);
    assert.match(c.html, /Cómo arreglarlo \(solo ese proceso\)/);
    assert.match(c.html, /Consolas[^>]*>pm2 stop adl-one-frontend</);
    assert.match(c.html, /adl-one-frontend · 5174/);
    assert.doesNotMatch(c.html, /adl-one-backend/);
});

test('el HTML de recuperación es verde, no trae pasos y dice cuándo volvió', () => {
    const c = armarCorreo({ tipo: 'RECUPERADO', ...base, duracionMs: 7 * MIN }, 'backend');
    assert.match(c.html, /RECUPERADO/);
    assert.match(c.html, /#e3f6e8/);
    assert.match(c.html, /Volvió a responder/);
    assert.match(c.html, /23-11-2026 14:37/); // 14:30 + 7 min, horario de Chile
    assert.doesNotMatch(c.html, /Cómo arreglarlo/);
    assert.doesNotMatch(c.html, /pm2 stop/);
});

test('compatible con Outlook de escritorio: sin flexbox ni grid', () => {
    for (const tipo of ['CAIDO', 'RECORDATORIO', 'RECUPERADO']) {
        const c = armarCorreo({ tipo, ...base }, 'frontend');
        assert.doesNotMatch(c.html, /display\s*:\s*(flex|grid)/, tipo);
    }
});

test('el recordatorio usa el mismo diseño con título «sigue sin responder»', () => {
    const c = armarCorreo({ tipo: 'RECORDATORIO', ...base, duracionMs: 135 * MIN }, 'frontend');
    assert.match(c.html, /sigue sin responder<\/h2>/);
    assert.match(c.html, /Lleva 2 h 15 min sin responder/);
});
