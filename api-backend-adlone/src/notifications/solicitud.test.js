import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderEmail, getEventConfig } from './renderer.js';
import { resultadoDe } from './config/solicitud.config.js';
import { renderDetalleSolicitud, formatoFecha } from './blocks/solicitud-detalle.js';

const CTX = {
    CORRELATIVO: '245', TIPO_SOLICITUD: 'Baja de equipo', USUARIO: 'Calidad', FECHA: '24-11-2026', HORA: '10:20',
    SOLICITANTE: 'Fernando Cárdenas', RESPONSABLE: 'Fernando Cárdenas', OBSERVACION: 'Aprobado correctamente', APP_URL: 'http://app.test',
    equipos: [{ id: 5, nombre: 'Termómetro digital', codigo: 'MAU.11', tipo: 'Termómetro', ubicacion: 'Puerto Montt' }],
};

test('todos los códigos de la familia tienen configuración y los demás no', () => {
    ['SOL_EQUIPO_BAJA_APR', 'SOL_EQUIPO_ALTA_NUEVA', 'SOL_EQUIPO_REAC_RECH', 'SOL_EQUIPO_BAJA_REV', 'SOL_TRASPASO_SEDE_NUEVA',
        'SOL_DESHABILITAR_MUESTREADOR_NUEVA', 'SOL_EXTENSION_VIGENCIA_NUEVA', 'SOLICITUD_NUEVA', 'SOLICITUD_ESTADO_CAMBIO',
        'SOLICITUD_COMENTARIO_NUEVO', 'SOLICITUD_DERIVACION'].forEach((c) => assert.ok(getEventConfig(c), c));
    ['PASSWORD_RESET_REQUESTED', 'GCHAT_NUEVO_MENSAJE', 'ENV_CADENA_MAM', 'SOL_ALGO'].forEach((c) => assert.equal(getEventConfig(c), null, c));
});

test('el resultado sale del sufijo del código y, en el cambio de estado, del estado del evento', () => {
    assert.equal(resultadoDe('SOL_EQUIPO_BAJA_APR'), 'APROBADA');
    assert.equal(resultadoDe('SOL_EQUIPO_TRASPASO_RECH'), 'RECHAZADA');
    assert.equal(resultadoDe('SOL_EQUIPO_REVISION_NUEVA'), 'NUEVA');
    assert.equal(resultadoDe('SOL_EQUIPO_BAJA_REV'), 'EN_REVISION');
    assert.equal(resultadoDe('SOL_EQUIPO_NUEVA'), 'EN_REVISION');
    assert.equal(resultadoDe('SOLICITUD_ESTADO_CAMBIO', { estado: 'ACEPTADA' }), 'APROBADA');
    assert.equal(resultadoDe('SOLICITUD_ESTADO_CAMBIO', { estado: 'REALIZADA' }), 'REALIZADA');
    assert.equal(resultadoDe('SOLICITUD_ESTADO_CAMBIO', { estado: 'RECHAZADA' }), 'RECHAZADA');
    assert.equal(resultadoDe('SOLICITUD_ESTADO_CAMBIO', {}), 'INFORMATIVA');
    assert.equal(resultadoDe('SOLICITUD_DERIVACION'), 'DERIVADA');
});

test('aprobada: título, asunto, insignia, datos, equipo y botón', () => {
    const r = renderEmail('SOL_EQUIPO_BAJA_APR', CTX);
    assert.equal(r.asunto, 'Solicitud aprobada: Baja de equipo #245');
    assert.match(r.html, /Solicitud aprobada: Baja de equipo/);
    assert.match(r.html, /APROBADA/);
    assert.match(r.html, /La solicitud #245 fue aprobada\./);
    assert.match(r.html, /N° 245/);
    assert.match(r.html, /Fernando Cárdenas/);
    assert.match(r.html, /Termómetro digital \[MAU\.11\]/);
    assert.match(r.html, /Aprobado correctamente/);
    assert.match(r.html, /http:\/\/app\.test\//);
    assert.doesNotMatch(r.html, /\{[A-Z_]+\}/); // ninguna variable sin reemplazar
});

test('usa TITULO_CORREO y ETIQUETA_OBSERVACION cuando el evento los trae', () => {
    const r = renderEmail('SOLICITUD_ESTADO_CAMBIO', { ...CTX, estado: 'RECHAZADA', TITULO_CORREO: 'Solicitud Rechazada — Baja', ETIQUETA_OBSERVACION: 'Comentarios (Rechazada)', OBSERVACION: 'Falta el motivo' });
    assert.equal(r.asunto, 'Solicitud Rechazada — Baja #245');
    assert.match(r.html, /RECHAZADA/);
    assert.match(r.html, /Comentarios \(Rechazada\)/);
});

test('nueva: sin solicitante ni responsable no deja filas vacías ni textos sueltos', () => {
    const r = renderEmail('SOL_TRASPASO_SEDE_NUEVA', { CORRELATIVO: '9', TIPO_SOLICITUD: 'Traspaso de sede', APP_URL: 'http://app.test' });
    assert.match(r.html, /NUEVA/);
    assert.doesNotMatch(r.html, /Solicitante|Responsable|undefined|null/);
});

test('el detalle escapa el HTML de los datos', () => {
    const html = renderDetalleSolicitud({ equipos: [{ nombre: '<b>x</b>', codigo: 'A&B', tipo: '"t"' }] });
    assert.doesNotMatch(html, /<b>x<\/b>/);
    assert.match(html, /&lt;b&gt;x&lt;\/b&gt; \[A&amp;B\]/);
});

test('traspaso: muestra lo que cambia con el valor anterior tachado', () => {
    const html = renderDetalleSolicitud({ equipos: [{ nombre: 'GPS', codigo: 'G1', tipo: 'GPS', isTransfer: true, datos_antiguos: { ubicacion: 'Puerto Montt', responsable: 'Ana' }, datos_nuevos: { ubicacion: 'Castro', responsable: 'Ana' } }] });
    assert.match(html, /line-through[^>]*>Puerto Montt/);
    assert.match(html, /Castro/);
    assert.doesNotMatch(html, /line-through[^>]*>Ana/); // el responsable no cambió
});

test('deshabilitar muestreador: reasignación manual en tabla', () => {
    const html = renderDetalleSolicitud({ datos_json: { muestreador_origen_nombre: 'Luis', tipo_traspaso: 'MANUAL', reasignacion_manual: [{ nombre_equipo: 'Termómetro', codigo_equipo: 'M1', nombre_muestreador_nuevo: 'Pedro' }] } });
    assert.match(html, /Deshabilitación de muestreador/);
    assert.match(html, /Reasignación manual/);
    assert.match(html, /Pedro/);
});

test('datos del formulario: etiquetas legibles, fechas DD-MM-AAAA y sin campos internos', () => {
    const html = renderDetalleSolicitud({ TIPO_SOLICITUD: 'Baja de equipo', datos_json: { nombre_equipo: 'GPS', codigo_equipo: 'G1', motivo: 'VIDA_UTIL', fecha_baja: '2026-11-18', fecha_suceso: '2026-11-18', id_equipo: 77, descripcion: 'Ya no enciende' } });
    assert.match(html, /Plan de desvinculación de equipo/);
    assert.match(html, /Vida útil/);
    assert.match(html, /18-11-2026/);
    assert.doesNotMatch(html, /77|Fecha del suceso|id_equipo/);
    assert.equal((html.match(/18-11-2026/g) || []).length, 1);
});

test('formatoFecha solo toca fechas ISO', () => {
    assert.equal(formatoFecha('2026-11-18T00:00:00.000Z'), '18-11-2026');
    assert.equal(formatoFecha('Puerto Montt'), 'Puerto Montt');
});
