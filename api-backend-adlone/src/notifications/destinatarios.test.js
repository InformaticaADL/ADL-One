import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirDestinatarios, explicarDestinatarios, MOTIVOS } from './destinatarios.js';

const dest = (...ids) => new Map(ids.map((id) => [id, { id_usuario: id, web: true, email: true }]));
const ids = (r) => [...r.aceptados.keys()].sort((a, b) => a - b);
const motivo = (r, id) => r.descartados.find((d) => d.id_usuario === id)?.motivo;

test('sin ninguna regla especial todos los destinatarios se quedan igual', () => {
    const r = decidirDestinatarios({ destinatarios: dest(1, 2, 3) });
    assert.deepEqual(ids(r), [1, 2, 3]);
    assert.equal(r.descartados.length, 0);
});

test('1) el acceso es el techo: quien no tiene acceso a la solicitud no recibe nada', () => {
    const r = decidirDestinatarios({ destinatarios: dest(1, 2, 3), acceso: new Set([1, 3]) });
    assert.deepEqual(ids(r), [1, 3]);
    assert.equal(motivo(r, 2), MOTIVOS.SIN_ACCESO);
});

test('1) el techo también alcanza a quien fue nombrado directamente', () => {
    const r = decidirDestinatarios({ destinatarios: dest(5), directos: new Set([5]), acceso: new Set([1]) });
    assert.equal(r.aceptados.size, 0);
    assert.equal(motivo(r, 5), MOTIVOS.SIN_ACCESO);
});

test('sin techo (acceso null) no se descarta por acceso: el evento no es de una solicitud', () => {
    const r = decidirDestinatarios({ destinatarios: dest(1, 2), acceso: null });
    assert.deepEqual(ids(r), [1, 2]);
});

test('2) un rol de 10 personas limitado a 3: solo esas 3 reciben', () => {
    const roles = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, [7]]));
    const r = decidirDestinatarios({
        destinatarios: dest(...Array.from({ length: 10 }, (_, i) => i + 1)),
        rolesDe: roles, rolesDelEvento: new Set([7]), limites: new Map([[7, new Set([2, 4, 9])]]),
    });
    assert.deepEqual(ids(r), [2, 4, 9]);
    assert.equal(r.descartados.length, 7);
    assert.ok(r.descartados.every((d) => d.motivo === MOTIVOS.FUERA_DE_LA_SELECCION));
});

test('2) un rol sin limitar entra completo', () => {
    const r = decidirDestinatarios({ destinatarios: dest(1, 2), rolesDe: new Map([[1, [7]], [2, [7]]]), rolesDelEvento: new Set([7]), limites: new Map() });
    assert.deepEqual(ids(r), [1, 2]);
});

test('2) quien está nombrado directamente o es la propietaria se queda aunque su rol esté limitado', () => {
    const r = decidirDestinatarios({
        destinatarios: dest(1, 2, 3), rolesDe: new Map([[1, [7]], [2, [7]], [3, [7]]]), rolesDelEvento: new Set([7]),
        limites: new Map([[7, new Set([1])]]), directos: new Set([3]),
    });
    assert.deepEqual(ids(r), [1, 3]);
    assert.equal(motivo(r, 2), MOTIVOS.FUERA_DE_LA_SELECCION);
});

test('2) si llega por otro rol sin limitar, la limitación del primero no la deja fuera', () => {
    const r = decidirDestinatarios({
        destinatarios: dest(1), rolesDe: new Map([[1, [7, 8]]]), rolesDelEvento: new Set([7, 8]), limites: new Map([[7, new Set([99])]]),
    });
    assert.deepEqual(ids(r), [1]);
});

test('2) si todos sus roles del evento están limitados y la dejan fuera, sale; si alguno la incluye, se queda', () => {
    const base = { destinatarios: dest(1), rolesDe: new Map([[1, [7, 8]]]), rolesDelEvento: new Set([7, 8]) };
    assert.equal(decidirDestinatarios({ ...base, limites: new Map([[7, new Set([99])], [8, new Set([98])]]) }).aceptados.size, 0);
    assert.equal(decidirDestinatarios({ ...base, limites: new Map([[7, new Set([99])], [8, new Set([1])]]) }).aceptados.size, 1);
});

test('2) un rol limitado que NO es del evento no afecta (la limitación es por evento y rol)', () => {
    const r = decidirDestinatarios({ destinatarios: dest(1), rolesDe: new Map([[1, [7]]]), rolesDelEvento: new Set([8]), limites: new Map([[7, new Set([99])]]) });
    assert.deepEqual(ids(r), [1]);
});

test('3) silenciar solo el correo deja el aviso web (tiene acceso pero no quiere correos)', () => {
    const r = decidirDestinatarios({ destinatarios: dest(1, 2), silencios: [{ id_usuario: 2, canal: 'EMAIL' }] });
    assert.deepEqual(r.aceptados.get(2), { id_usuario: 2, web: true, email: false });
    assert.equal(r.aceptados.get(1).email, true);
});

test('3) silenciar solo el aviso web deja el correo', () => {
    const r = decidirDestinatarios({ destinatarios: dest(1), silencios: [{ id_usuario: 1, canal: 'WEB' }] });
    assert.deepEqual(r.aceptados.get(1), { id_usuario: 1, web: false, email: true });
});

test('3) silenciar todo, o los dos canales por separado, saca a la persona', () => {
    assert.equal(motivo(decidirDestinatarios({ destinatarios: dest(1), silencios: [{ id_usuario: 1, canal: 'TODOS' }] }), 1), MOTIVOS.SILENCIADO);
    assert.equal(decidirDestinatarios({ destinatarios: dest(1), silencios: [{ id_usuario: 1, canal: 'EMAIL' }, { id_usuario: 1, canal: 'WEB' }] }).aceptados.size, 0);
});

test('3) silenciar no puede agregar un canal que el aviso no traía', () => {
    const d = new Map([[1, { id_usuario: 1, web: true, email: false }]]);
    const r = decidirDestinatarios({ destinatarios: d, silencios: [{ id_usuario: 1, canal: 'EMAIL' }] });
    assert.deepEqual(r.aceptados.get(1), { id_usuario: 1, web: true, email: false });
});

test('un silencio de otra persona no afecta', () => {
    const r = decidirDestinatarios({ destinatarios: dest(1), silencios: [{ id_usuario: 2, canal: 'TODOS' }] });
    assert.deepEqual(ids(r), [1]);
});

test('las tres reglas juntas, en orden: el caso de la persona de Calidad que ve solicitudes pero no quiere correos', () => {
    // 10 personas en el rol 5. Todas tienen acceso salvo la 10. El rol se limita a 1, 2, 3. La 2 pidió no recibir correos.
    const roles = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, [5]]));
    const r = decidirDestinatarios({
        destinatarios: dest(...Array.from({ length: 10 }, (_, i) => i + 1)),
        rolesDe: roles, rolesDelEvento: new Set([5]), limites: new Map([[5, new Set([1, 2, 3, 10])]]),
        acceso: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]), silencios: [{ id_usuario: 2, canal: 'EMAIL' }],
    });
    assert.deepEqual(ids(r), [1, 2, 3]);
    assert.equal(r.aceptados.get(2).email, false);   // ve la solicitud y recibe el aviso web, sin correo
    assert.equal(r.aceptados.get(2).web, true);
    assert.equal(motivo(r, 10), MOTIVOS.SIN_ACCESO); // estaba elegida pero no tiene acceso
    assert.equal(motivo(r, 5), MOTIVOS.FUERA_DE_LA_SELECCION);
});

test('explicarDestinatarios ordena primero a quien recibe y trae el motivo de quien no', () => {
    const filas = explicarDestinatarios({ destinatarios: dest(1, 2), acceso: new Set([2]) }, new Map([[1, 'Ana'], [2, 'Beto']]));
    assert.deepEqual(filas.map((f) => [f.nombre, f.recibe, f.motivo]), [['Beto', true, null], ['Ana', false, MOTIVOS.SIN_ACCESO]]);
});

import { combinarAcceso } from './destinatarios.js';

test('combinarAcceso: sin ningún techo no hay techo; con uno, ese; con dos, se cumplen ambos', () => {
    assert.equal(combinarAcceso(null, null), null);
    assert.deepEqual([...combinarAcceso(new Set([1, 2]), null)], [1, 2]);
    assert.deepEqual([...combinarAcceso(null, new Set([2, 3]))], [2, 3]);
    assert.deepEqual([...combinarAcceso(new Set([1, 2, 3]), new Set([2, 3, 4]))].sort(), [2, 3]);
    assert.equal(combinarAcceso(new Set([1]), new Set([2])).size, 0);
});

test('el techo por permiso saca a quien no tiene el permiso del aviso de una ficha', () => {
    // Aviso de ficha: solo 1 y 2 tienen un permiso para verla. La 3 estaba en la lista.
    const r = decidirDestinatarios({ destinatarios: dest(1, 2, 3), acceso: combinarAcceso(null, new Set([1, 2])) });
    assert.deepEqual(ids(r), [1, 2]);
    assert.equal(motivo(r, 3), MOTIVOS.SIN_ACCESO);
});

import { silencioAlcanza } from './destinatarios.js';

test('un silencio por familia alcanza a todos los avisos que empiezan igual, también a los futuros', () => {
    assert.equal(silencioAlcanza('SOL_*', 'SOL_EQUIPO_BAJA_NUEVA'), true);
    assert.equal(silencioAlcanza('SOL_*', 'SOL_UN_AVISO_QUE_AUN_NO_EXISTE'), true);
    assert.equal(silencioAlcanza('SOL_*', 'SOLICITUD_NUEVA'), false);   // «SOL_» no es «SOLI…»
    assert.equal(silencioAlcanza('SOLICITUD_*', 'SOLICITUD_NUEVA'), true);
    assert.equal(silencioAlcanza('FICHA_*', 'AVISO_PERDIDO_NUEVO'), false);
    assert.equal(silencioAlcanza('GCHAT_NUEVO_MENSAJE', 'GCHAT_NUEVO_MENSAJE'), true);
    assert.equal(silencioAlcanza('GCHAT_NUEVO_MENSAJE', 'GCHAT_GRUPO_CREADO'), false);
    assert.equal(silencioAlcanza(null, 'CUALQUIERA'), true);
});
