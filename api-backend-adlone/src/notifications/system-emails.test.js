import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRecuperacionClave } from './system-emails.js';

const URL = 'http://app.test/reset-password?token=abc%2B123';

test('recuperación de clave: asunto, botón con el enlace, enlace en texto y vencimiento', () => {
    const c = renderRecuperacionClave({ nombreUsuario: 'Fernando', resetUrl: URL, expiresInMinutes: 30 });
    assert.equal(c.subject, 'ADL ONE — Recuperación de contraseña');
    assert.match(c.html, /Restablecer contraseña/);
    assert.match(c.html, /href="http:\/\/app\.test\/reset-password\?token=abc%2B123"/);
    assert.match(c.html, /Fernando/);
    assert.match(c.html, /30 minutos/);
    assert.match(c.html, /ignora este correo/);
    assert.match(c.text, /http:\/\/app\.test\/reset-password\?token=abc%2B123/);
    assert.match(c.text, /30 minutos/);
});

test('recuperación de clave: escapa el nombre y los caracteres del enlace', () => {
    const c = renderRecuperacionClave({ nombreUsuario: '<img src=x onerror=1>', resetUrl: 'http://app.test/r?a=1&b=2', expiresInMinutes: 60 });
    assert.doesNotMatch(c.html, /<img src=x/);
    assert.match(c.html, /&lt;img src=x onerror=1&gt;/);
    assert.match(c.html, /href="http:\/\/app\.test\/r\?a=1&amp;b=2"/);
});

test('recuperación de clave: sin nombre saluda a «usuario» y sin minutos usa 60', () => {
    const c = renderRecuperacionClave({ resetUrl: URL });
    assert.match(c.html, /Hola <strong[^>]*>usuario<\/strong>/);
    assert.match(c.html, /60 minutos/);
    assert.doesNotMatch(c.html + c.text, /undefined|null/);
});

import { plantillaDocumentoCliente, renderPreFacturaCliente } from './system-emails.js';

test('documentos al cliente: mismos marcadores que ya reemplazan ADL ONE y ADL SAMPLING', () => {
    const cadena = plantillaDocumentoCliente('CADENA');
    assert.equal(cadena.codigo, 'ENV_CADENA_MAM');
    assert.match(cadena.asunto, /\{CORRELATIVO\}/);
    assert.match(cadena.html, /\{CASO_ADLAB\}/);
    assert.match(cadena.html, /\{LABORATORIO_ASIGNADO\}/);
    assert.match(cadena.html, /cid:logo_adl"/);
    assert.match(cadena.html, /alt="ADL Diagnostic"/);
    const foma = plantillaDocumentoCliente('FOMA');
    assert.equal(foma.codigo, 'ENV_FOMA_MAM');
    assert.match(foma.html, /\{CASO_ADLAB\}/);
    assert.doesNotMatch(foma.html, /LABORATORIO_ASIGNADO/); // la FoMa no trae laboratorio
    assert.throws(() => plantillaDocumentoCliente('OTRO'), /desconocido/i);
});

test('pre-factura: datos, próximo paso según corresponda a la OC y texto plano', () => {
    const base = { numero: 123, empresa: 'Salmones <X>', totalUf: '15,00', totalClp: '580.000' };
    const conOc = renderPreFacturaCliente(base);
    assert.match(conOc.html, /Pre-factura N° 123/);
    assert.match(conOc.html, /15,00 U\.F\./);
    assert.match(conOc.html, /580\.000/);
    assert.match(conOc.html, /Salmones &lt;X&gt;/);
    assert.match(conOc.html, /Orden de Compra/);
    assert.match(conOc.html, /en respuesta a este correo/);
    assert.match(conOc.text, /pre-factura N° 123 de Salmones <X> por un total de 15,00 U\.F\./);
    assert.match(renderPreFacturaCliente({ ...base, portalPublicado: true }).html, /portal ADL WEB GO/);
    const directa = renderPreFacturaCliente({ ...base, requiereOc: 'N' });
    assert.match(directa.html, /se procesará directamente/);
    assert.doesNotMatch(directa.html, /Orden de Compra/);
});

import { renderClaveCambiada } from './system-emails.js';

test('contraseña cambiada: dice cómo y cuándo, y qué hacer si no fue la persona', () => {
    const c = renderClaveCambiada({ nombreUsuario: 'Fernando', motivo: 'recuperacion', cuando: new Date('2026-11-24T15:30:00Z') });
    assert.equal(c.subject, 'ADL ONE — Tu contraseña cambió');
    assert.match(c.html, /con el enlace de recuperación/);
    assert.match(c.html, /24 de noviembre de 2026/);
    assert.match(c.html, /avisa de inmediato al área de Informática/);
    assert.match(renderClaveCambiada({ nombreUsuario: '<b>x</b>' }).html, /&lt;b&gt;x&lt;\/b&gt;/);
    assert.match(renderClaveCambiada({}).html, /desde tu cuenta/);
});

import { renderEquiposPorVencer } from './system-emails.js';

test('equipos por vencer: asunto con el código o la cantidad, fechas legibles y urgencia', () => {
    const uno = renderEquiposPorVencer({ tramo: 7, equipos: [{ codigo: 'MAU.11', nombre: 'Termómetro <x>', sede: 'Puerto Montt', siguiente: '2026-11-25', dias: 1 }], appUrl: 'http://app.test' });
    assert.equal(uno.subject, 'Equipos por vencer (7 días): MAU.11');
    assert.match(uno.html, /25-11-2026/);
    assert.match(uno.html, /mañana/);
    assert.match(uno.html, /Termómetro &lt;x&gt;/);
    assert.match(uno.html, /EN REVISIÓN/); // 7 días = urgente
    assert.match(uno.html, /http:\/\/app\.test\//);
    const varios = renderEquiposPorVencer({ tramo: 30, equipos: [{ codigo: 'A', siguiente: new Date('2026-12-10T00:00:00Z'), dias: 16 }, { codigo: 'B', siguiente: '2026-12-20', dias: 26 }] });
    assert.equal(varios.subject, 'Equipos por vencer (30 días): 2 equipos');
    assert.doesNotMatch(varios.html, /EN REVISIÓN/);
    assert.match(varios.text, /A · vence 10-12-2026 \(en 16 días\)/);
});

test('equipos por vencer: con muchos equipos avisa cuántos faltan', () => {
    const equipos = Array.from({ length: 45 }, (_, i) => ({ codigo: `E${i}`, siguiente: '2026-12-01', dias: 10 }));
    const r = renderEquiposPorVencer({ tramo: 30, equipos });
    assert.match(r.html, /y 5 más/);
    assert.doesNotMatch(r.html, />E44</);
});
