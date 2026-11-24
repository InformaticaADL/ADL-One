import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redirigirCorreo, soloDominiosPermitidos, destinoRedireccion, REDIRECCION_POR_DEFECTO } from './redireccionCorreo.js';

const original = { to: 'cliente@empresa.cl, otro@empresa.cl', cc: 'jefe@adl.cl', bcc: 'oculto@adl.cl', subject: 'Ficha 123', html: '<p>Hola</p>' };

test('con la redirección explícitamente vacía el correo sale igual (así se declara producción)', () => {
    assert.equal(redirigirCorreo(original, ''), original);
});

test('por defecto todo va a la dirección de pruebas, aunque la variable falte o esté vacía', () => {
    assert.equal(destinoRedireccion({}), REDIRECCION_POR_DEFECTO);
    assert.equal(destinoRedireccion({ EMAIL_REDIRECT_TO: '' }), REDIRECCION_POR_DEFECTO);
    assert.equal(destinoRedireccion({ EMAIL_REDIRECT_TO: '  ' }), REDIRECCION_POR_DEFECTO);
    assert.equal(destinoRedireccion({ EMAIL_REDIRECT_TO: 'otra@adldiagnostic.cl' }), 'otra@adldiagnostic.cl');
});

test('solo EMAIL_PRODUCCION=1 apaga la redirección', () => {
    assert.equal(destinoRedireccion({ EMAIL_PRODUCCION: '1' }), '');
    assert.equal(destinoRedireccion({ EMAIL_PRODUCCION: '1', EMAIL_REDIRECT_TO: 'x@adl.cl' }), '');
    assert.equal(destinoRedireccion({ EMAIL_PRODUCCION: '0' }), REDIRECCION_POR_DEFECTO);
});

test('con redirección, solo llega a la dirección de pruebas y no queda ni Cc ni Cco reales', () => {
    const r = redirigirCorreo(original, 'vremolcoy@adldiagnostic.cl');
    assert.equal(r.to, 'vremolcoy@adldiagnostic.cl');
    assert.equal(r.cc, undefined);
    assert.equal(r.bcc, undefined);
});

test('el asunto lleva [PRUEBA] y el cuerpo anota a quién habría llegado', () => {
    const r = redirigirCorreo(original, 'vremolcoy@adldiagnostic.cl');
    assert.equal(r.subject, '[PRUEBA] Ficha 123');
    assert.ok(r.html.includes('MODO PRUEBAS'));
    assert.ok(r.html.includes('cliente@empresa.cl, otro@empresa.cl'));
    assert.ok(r.html.includes('jefe@adl.cl'));
    assert.ok(r.html.includes('oculto@adl.cl'));
    assert.ok(r.html.endsWith('<p>Hola</p>'));
});

test('acepta varias direcciones de prueba, destinatarios en lista y objetos { address }', () => {
    const r = redirigirCorreo({ to: ['a@x.cl', 'b@x.cl'], subject: 'S', html: '<i>x</i>' }, 'uno@adl.cl, dos@adl.cl');
    assert.equal(r.to, 'uno@adl.cl, dos@adl.cl');
    assert.ok(r.html.includes('a@x.cl, b@x.cl'));
    const r2 = redirigirCorreo({ to: { address: 'z@x.cl' }, subject: 'S', html: '<i>x</i>' }, 'uno@adl.cl');
    assert.ok(r2.html.includes('z@x.cl'));
});

test('no deja pasar HTML en las direcciones anotadas y conserva adjuntos', () => {
    const adj = [{ filename: 'a.pdf' }];
    const r = redirigirCorreo({ to: '<script>x</script>@x.cl', subject: 'S', html: '<p>h</p>', attachments: adj }, 'uno@adl.cl');
    assert.ok(!r.html.includes('<script>'));
    assert.equal(r.attachments, adj);
});

test('correo solo de texto: lo reales van al inicio del texto', () => {
    const r = redirigirCorreo({ to: 'c@x.cl', subject: 'S', text: 'Hola' }, 'uno@adl.cl');
    assert.ok(r.text.startsWith('MODO PRUEBAS'));
    assert.ok(r.text.includes('c@x.cl'));
    assert.ok(r.text.endsWith('Hola'));
});

// ── Solo correos de ADL ──
test('deja pasar solo direcciones de adldiagnostic.cl y avisa cuáles quitó', () => {
    const r = soloDominiosPermitidos({ to: 'ana@adldiagnostic.cl, cliente@empresa.cl', cc: 'Jefe Empresa <jefe@otraempresa.cl>', subject: 'S' }, 'adldiagnostic.cl');
    assert.equal(r.opciones.to, 'ana@adldiagnostic.cl');
    assert.equal(r.opciones.cc, undefined);
    assert.deepEqual(r.bloqueados, ['cliente@empresa.cl', 'jefe@otraempresa.cl']);
    assert.equal(r.vacio, false);
});

test('si no queda nadie de ADL, el correo queda vacío (no se envía)', () => {
    const r = soloDominiosPermitidos({ to: 'cliente@empresa.cl', bcc: 'x@gmail.com', subject: 'S' }, 'adldiagnostic.cl');
    assert.equal(r.vacio, true);
    assert.equal(r.bloqueados.length, 2);
});

test('el dominio se compara sin importar mayúsculas y no se deja engañar por subdominios parecidos', () => {
    const r = soloDominiosPermitidos({ to: 'Ana@ADLDIAGNOSTIC.CL, falso@adldiagnostic.cl.evil.com, x@noadldiagnostic.cl' }, 'adldiagnostic.cl');
    assert.equal(r.opciones.to, 'Ana@ADLDIAGNOSTIC.CL');
    assert.deepEqual(r.bloqueados, ['falso@adldiagnostic.cl.evil.com', 'x@noadldiagnostic.cl']);
});

test('con * el filtro se desactiva, y si todos son de ADL el correo no cambia', () => {
    const o = { to: 'cliente@empresa.cl' };
    assert.equal(soloDominiosPermitidos(o, '*').opciones, o);
    const o2 = { to: 'a@adldiagnostic.cl', cc: 'b@adldiagnostic.cl' };
    const r = soloDominiosPermitidos(o2, 'adldiagnostic.cl');
    assert.equal(r.opciones, o2);
    assert.equal(r.bloqueados.length, 0);
});

test('si solo queda una copia de ADL, pasa a ser el destinatario', () => {
    const r = soloDominiosPermitidos({ to: 'cliente@empresa.cl', cc: 'jefe@adldiagnostic.cl' }, 'adldiagnostic.cl');
    assert.equal(r.opciones.to, 'jefe@adldiagnostic.cl');
    assert.equal(r.opciones.cc, undefined);
    assert.equal(r.vacio, false);
});

test('sin variable de entorno, el valor por defecto es solo adldiagnostic.cl', () => {
    const previo = process.env.EMAIL_ALLOWED_DOMAINS;
    delete process.env.EMAIL_ALLOWED_DOMAINS;
    try {
        assert.equal(soloDominiosPermitidos({ to: 'cliente@empresa.cl' }).vacio, true);
        assert.equal(soloDominiosPermitidos({ to: 'ana@adldiagnostic.cl' }).vacio, false);
    } finally {
        if (previo !== undefined) process.env.EMAIL_ALLOWED_DOMAINS = previo;
    }
});
