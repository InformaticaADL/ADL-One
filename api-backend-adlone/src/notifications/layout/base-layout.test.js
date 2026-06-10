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
