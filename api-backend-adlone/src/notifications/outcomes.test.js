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
