import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roundVfp, montosFacturaCasos, aFilaDte, filasDteFacturaCasos, csvFoxPro, aBufferAnsi, nombreArchivoCasos, COLUMNAS_DTE,
  filtrarLista, exportarFacturasCasos, armarGlosa, glosaConMes, grabarFechaFacturacion, grabarMes, grabarNota, agregarOcHes,
  modificarOcHes, eliminarOcHes, buscarOcEnOtrasFacturas
} from './facturacion-salud.exportacion.js';

function fakeDb(respuestas = []) {
  const log = [];
  return {
    log,
    request() {
      const params = {};
      const req = {
        input(n, _t, v) { params[n] = v; return req; },
        async query(texto) {
          log.push({ texto: texto.replace(/\s+/g, ' ').trim(), params: { ...params } });
          const r = respuestas.find(([patron]) => texto.includes(patron));
          return { recordset: r ? r[1] : [], rowsAffected: [1] };
        }
      };
      return req;
    }
  };
}

const doc = {
  id_facturacion: 73718, id_empresaservicio: 363, rut_empresaservicios: '77431760-0', nombre_empresaservicios: 'Lago Sofía SpA',
  fecha_facturacion: '31/08/2026', uf_totalfac: 46.57, uf: 39000, nombre_anegocio: 'Medio Ambiente', glosa: 'Servicio Muestreo y Análisis',
  id_direccion: 140, id_giro: 168, id_formapago: 1, nombre_formapago: '30 días', direccion_comercial: 'Chinquihue Km 12', id_ciudad: 15,
  nombre_ciudad: 'Puerto Montt', id_comunaef: 6, nombre_comunaef: 'Puerto Montt', nombre_giro: 'Cultivo y crianza de peces marinos', nota: ''
};

test('ROUND de FoxPro: la mitad se redondea hacia afuera', () => {
  assert.equal(roundVfp(2.5, 0), 3);
  assert.equal(roundVfp(-2.5, 0), -3);
  assert.equal(roundVfp(1.005, 2), 1.01);
  assert.equal(roundVfp(12.45, 1), 12.5);
});

test('montos sin OC: un decimal y luego entero (doble redondeo)', () => {
  // 12,45 → ROUND(,1) = 12,5 → al guardar en campo entero = 13 (con un solo redondeo habría sido 12)
  const m = montosFacturaCasos({ uf_totalfac: 12.45, uf: 1 }, false);
  assert.equal(m.principal.neto, 13);
  assert.equal(m.filaOc, null);
});

test('montos con OC: la fila principal y las de OC pueden diferir en 1 peso', () => {
  const m = montosFacturaCasos({ uf_totalfac: 1000.45, uf: 1 }, true);
  assert.equal(m.principal.neto, 1000);
  assert.equal(m.principal.totaldoc, 1190); // sobre el neto ya redondeado
  assert.equal(m.filaOc.totaldoc, 1191); // sobre el total sin redondear: 1190,5355 → 1190,5 → 1191
  assert.equal(m.filaOc.neto, 0);
});

test('los textos se cortan al largo del campo y los números quedan enteros', () => {
  const f = aFilaDte({ rut_cli: '76.123.456-7', claseserv: 'x'.repeat(40), totaldoc: 100.5, fecha_ref: '2026-08-01' });
  assert.equal(f.rut_cli, '76.123.45'.concat('6'));
  assert.equal(f.rut_cli.length, 10);
  assert.equal(f.claseserv.length, 30);
  assert.equal(f.totaldoc, 101);
  assert.equal(f.fecha_ref, '01/08/2026');
  assert.equal(Object.keys(f).length, 35);
});

test('factura sin OC genera una fila; con OC y HES, la principal más una por cada referencia', () => {
  assert.equal(filasDteFacturaCasos(doc, []).length, 1);
  const filas = filasDteFacturaCasos(doc, [
    { tipo: 'OC', ocompra: '9613', ocompra_fecha: '01/08/2026', referencia: 'Ref 1' },
    { tipo: 'HES', ocompra: '77', ocompra_fecha: '02/08/2026', referencia: '' }
  ]);
  assert.equal(filas.length, 3);
  assert.deepEqual([filas[0].cantidad, filas[0].tiposerv, filas[0].n_td], [1, 'ADL', 'FE']);
  assert.deepEqual([filas[1].cantidad, filas[1].neto, filas[1].tipo_ref, filas[1].num_ref, filas[1].motivo], [0, 0, 'OC', '9613', 'Ref 1']);
  assert.equal(filas[2].tipo_ref, 'HES');
  assert.equal(filas[0].nota, '');
  assert.equal(filasDteFacturaCasos({ ...doc, nota: 'Pago anticipado' }, [])[0].nota, 'Nota: Pago anticipado');
});

test('el forma de pago del archivo mezcla código de la empresa y nombre de la factura', () => {
  const f = filasDteFacturaCasos({ ...doc, id_formapago: 4, nombre_formapago: '30 días' }, [])[0];
  assert.deepEqual([f.id_formapago, f.nom_fp], [4, '30 días']);
});

test('CSV: encabezado, textos entre comillas, fechas sin comillas y fecha vacía como "/  /"', () => {
  const csv = csvFoxPro(filasDteFacturaCasos(doc, [{ tipo: 'OC', ocompra: '9613', ocompra_fecha: '01/08/2026', referencia: '' }]));
  const lineas = csv.split('\r\n');
  assert.equal(lineas[0], COLUMNAS_DTE.join(','));
  assert.equal(COLUMNAS_DTE.length, 35);
  assert.match(lineas[1], /^73718,"FE",31\/08\/2026,"Casa Matriz",363,140,168,1,"Banco","Documento","",\d+,1,"Medio Ambiente","ADL","Servicio Muestreo y Análisis",\d+,/);
  assert.match(lineas[1], /"30 días","","",\/ {2}\/,0,"",""$/);
  assert.match(lineas[2], /"30 días","OC","9613",01\/08\/2026,0,"",""$/);
  assert.equal(lineas[3], '');
  assert.equal(aBufferAnsi('días')[1], 0xed); // í en Windows-1252, no en UTF-8
});

test('CSV: una comilla dentro de un texto se duplica y un salto de línea se vuelve espacio', () => {
  const csv = csvFoxPro([aFilaDte({ ...comunesMinimos(), detalle: 'Muestra "A"\nlote 2' })]);
  assert.match(csv, /"Muestra ""A"" lote 2"/);
});
const comunesMinimos = () => ({ prefactura: 1, n_td: 'FE' });

test('nombre del archivo y filtro de la lista', () => {
  assert.equal(nombreArchivoCasos([73718, 73716]), 'FE_CASOS_73718_73716.TXT');
  const filas = [{ emitido: 'S ' }, { emitido: '' }, { emitido: 'N' }, { emitido: null, eliminado: 'S' }];
  assert.equal(filtrarLista(filas).length, 3);
  assert.equal(filtrarLista(filas, 'Emitidos').length, 1);
  assert.equal(filtrarLista(filas, 'Eliminado').length, 1);
  assert.equal(filtrarLista(filas, 'Todos').length, 4);
});

test('exportar: arma el archivo, marca emitido cada factura una vez y rechaza las que no están en el listado', async () => {
  const db = fakeDb([
    ['fac_consulta_facturaelectronica_exporta', [doc, { ...doc, nombre_anegocio: 'Otra área' }, { ...doc, id_facturacion: 73716 }]],
    ['consulta_facturacion_ocompra', []]
  ]);
  const r = await exportarFacturasCasos(db, { ids_facturacion: [73718, 73716, 73718] });
  assert.equal(r.documentos, 2); // la factura repetida (dos áreas de negocio) entra una sola vez
  assert.equal(r.nombreArchivo, 'FE_CASOS_73718_73716.TXT');
  assert.equal(db.log.filter((x) => x.texto.startsWith("UPDATE dbo.facturacion_enc SET emitido = 'S'")).length, 2);
  await assert.rejects(() => exportarFacturasCasos(fakeDb([['fac_consulta_facturaelectronica_exporta', [doc]]]), { ids_facturacion: [999] }), /no están disponibles/);
  await assert.rejects(() => exportarFacturasCasos(fakeDb(), { ids_facturacion: [] }), /al menos una/);
});

test('glosa: "<glosa>, <mes>" aunque el mes esté vacío; con observaciones se agrega al final', () => {
  assert.equal(glosaConMes('Servicios de Asistencia Diagnóstica', 'AGOSTO 2026'), 'Servicios de Asistencia Diagnóstica, AGOSTO 2026');
  assert.equal(glosaConMes('Servicios', ''), 'Servicios, ');
  assert.equal(armarGlosa({ nombreGlosa: 'G', mes: 'M', observaciones: 'obs' }), 'G, M, obs');
  assert.equal(armarGlosa({ nombreGlosa: 'G', mes: 'M', observaciones: '' }), 'G, M');
});

test('datos previos: validaciones y sentencias', async () => {
  const db = fakeDb();
  await assert.rejects(() => grabarFechaFacturacion(db, { id_facturacion: 1, fecha: '' }), /Fecha de Facturación/);
  await assert.rejects(() => grabarNota(db, { id_facturacion: 1, nota: ' ' }), /Nota/);
  await assert.rejects(() => grabarMes(db, { id_facturacion: 1, mes: '', nombreGlosa: 'G' }), /Mes/);
  const r = await grabarMes(db, { id_facturacion: 5, mes: 'AGOSTO 2026', nombreGlosa: 'G' });
  assert.equal(r.glosa, 'G, AGOSTO 2026');
  assert.match(db.log[0].texto, /UPDATE dbo\.facturacion_enc SET mes = @m, glosa = @g WHERE id_facturacion = @id/);
  await grabarFechaFacturacion(db, { id_facturacion: 5, fecha: '2026-08-31' });
  assert.equal(db.log[1].params.f, '31/08/2026');
});

test('OC y HES libres: agrega solo lo que trae número, con orden 1 y 2; modifica y elimina por número', async () => {
  const db = fakeDb();
  const r = await agregarOcHes(db, { id_facturacion: 8, oc: { ocompra: '4500', fecha: '2026-08-01', referencia: 'r' }, hes: { ocompra: '' } });
  assert.equal(r.agregadas, 1);
  assert.deepEqual([db.log[0].params.t, db.log[0].params.ord], ['OC', 1]);
  await agregarOcHes(db, { id_facturacion: 8, hes: { ocompra: '88' } });
  assert.deepEqual([db.log[1].params.t, db.log[1].params.ord, db.log[1].params.f], ['HES', 2, '  /  /    ']);
  await modificarOcHes(db, { id_facturacion: 8, ocompra: '88', tipo: 'HES', fecha: '03/08/2026', referencia: 'x' });
  assert.match(db.log[2].texto, /UPDATE dbo\.facturacion_ocompra SET ocompra_fecha = @f, referencia = @r, orden = @ord WHERE id_facturacion = @id AND ocompra = @o AND tipo = @t/);
  await assert.rejects(() => modificarOcHes(db, { id_facturacion: 8, ocompra: '1', tipo: 'XX' }), /OC o HES/);
  await eliminarOcHes(db, { id_facturacion: 8, ocompra: '88' });
  assert.match(db.log[3].texto, /DELETE dbo\.facturacion_ocompra WHERE ocompra = @o AND id_facturacion = @id/);
  await buscarOcEnOtrasFacturas(db, { ocompra: '1234567890123456' });
  assert.equal(db.log[4].params.o, '123456789012'); // el procedimiento mira solo 12 caracteres
});

test('listar OC y HES de un documento', async () => {
  const { listarOcHes } = await import('./facturacion-salud.exportacion.js');
  const db = fakeDb([['consulta_facturacion_ocompra', [{ ocompra: '9', tipo: 'OC' }]]]);
  assert.equal((await listarOcHes(db, { id_facturacion: 5 })).length, 1);
  await assert.rejects(() => listarOcHes(db, { id_facturacion: 0 }), /elegir una factura/);
});

test('el N° de OC/HES se escribe recortado: el campo de la base viene relleno de espacios y ADLSOFT los quita (comparado con un archivo real)', async () => {
  const { filasDteFacturaCasos } = await import('./facturacion-salud.exportacion.js');
  const doc = { id_facturacion: 1, uf_totalfac: 10, uf: 40000, nombre_empresaservicios: 'X' };
  const filas = filasDteFacturaCasos(doc, [{ tipo: 'OC', ocompra: '9613                ', ocompra_fecha: '01/08/2026', referencia: '' }]);
  assert.equal(filas[1].num_ref, '9613');
});
