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

test('omits "Muestreador Ret." and "Fecha Retiro" rows for Puntual fichas even when retiro values are set', () => {
    const html = renderFichaServicios({
        servicios: [
            {
                numero: '1',
                muestreador_instalacion: 'Juan Pérez',
                muestreador_retiro: 'Juan Pérez',
                fecha_muestreo: '12-06-2026',
                fecha_retiro: '12-06-2026',
                old_fecha: null,
                old_fecha_retiro: null,
                old_muestreador_instalacion: null,
                old_muestreador_retiro: null,
                isModified: false,
                esPuntual: true,
            },
        ],
    });

    assert.match(html, /Servicio 1/);
    assert.match(html, /📥 Muestreador<\/div>/);
    assert.match(html, /Fecha Muestreo/);
    assert.doesNotMatch(html, /Muestreador Inst\./);
    assert.doesNotMatch(html, /Fecha Instalación/);
    assert.doesNotMatch(html, /Muestreador Ret\./);
    assert.doesNotMatch(html, /Fecha Retiro/);
});
