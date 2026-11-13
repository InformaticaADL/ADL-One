// PRUEBA DE VALORIZACION CONTRA FACTURAS YA EMITIDAS POR ADLSOFT — SOLO EN LA COPIA LOCAL (NTDMora\ADLLOCAL).
// Cada argumento es una factura o un grupo que se procesa junto ("73840+73838"): se eliminan todas, se valoriza UNA vez (como una corrida de
// ADLSOFT) y se crea la prefactura de cada una. Se compara solo contra las lineas que tenia la factura original.
process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
import fs from 'fs';
const base = 'file:///C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/src/';
const db0 = await import(base + 'config/databaseSalud.js'); // candado: solo este equipo
const { facturacionSaludService: s } = await import(base + 'services/facturacion-salud.service.js');
const pool = await db0.getConnectionSalud();
const q = async (t) => (await pool.request().query(t)).recordset;
const quien = (await q("SELECT @@SERVERNAME s, CAST(SERVERPROPERTY('MachineName') AS nvarchar(100)) m"))[0];
if (!/ADLLOCAL/i.test(quien.s)) { console.log('ABORTO: el servidor no es ADLLOCAL:', quien.s); process.exit(2); }
console.log('Servidor de la prueba:', quien.s, '(maquina', quien.m + ')');

const ELIGE = { 1: 1, 2: 2, 3: 4, 4: 5, 5: 3, 10: 3, 18: 8, 6: 3, 8: 4, 7: 6, 19: 9 };
const num = (v) => Number(v) || 0; const txt = (x) => String(x ?? '').trim();
const salida = [];

for (const grupo of process.argv.slice(2)) {
  const ids = grupo.split('+').map(Number);
  const G = { grupo, facturas: [], errores: [] };
  try {
    const orig = [];
    for (const id of ids) {
      const enc = (await q(`SELECT * FROM dbo.facturacion_enc WHERE id_facturacion = ${id}`))[0];
      const det = await q(`SELECT id_caso, item, vtatotal FROM dbo.facturacion_det WHERE id_facturacion = ${id}`);
      if (!enc || !det.length) throw new Error(`la factura ${id} no tiene datos (¿ya fue procesada antes?)`);
      orig.push({ id, enc, det, casos: [...new Set(det.map((d) => num(d.id_caso)))], llaves: new Map(det.map((d) => [`${num(d.id_caso)}|${num(d.item)}`, num(d.vtatotal)])) });
    }
    const todosCasos = [...new Set(orig.flatMap((o) => o.casos))];
    const prog = num((await q(`SELECT TOP 1 id_programa FROM dbo.muestras WHERE id_caso = ${todosCasos[0]}`))[0].id_programa);
    const elige = ELIGE[prog];
    const e0 = orig[0].enc;
    // eliminar todas (local) -> los casos quedan pendientes
    for (const o of orig) await s.eliminarPrefacturaSalud(o.id);
    // rango: de la fecha de informe mas antigua a la mas reciente de TODOS los casos
    const fi = (await q(`SET DATEFORMAT dmy; SELECT CONVERT(varchar(10), MIN(CONVERT(datetime, fecha_informe, 103)), 103) a, CONVERT(varchar(10), MAX(CONVERT(datetime, fecha_informe, 103)), 103) b FROM dbo.muestras WHERE id_caso IN (${todosCasos.join(',')}) AND ISDATE(fecha_informe) = 1`))[0];
    const rango = { fecha_proceso_ini: fi.a, fecha_proceso_fin: fi.b };
    const v = await s.valorizarCasosSalud({ id_empresaservicio: num(e0.id_empresaservicio), eligeprograma: elige, ...rango, valor_uf: Number(process.env.UF_OVERRIDE) || num(e0.uf), valor_usd: num(e0.usd) });
    G.valorizados = { casos: v.casosValorizados, lineas: v.lineasValorizadas, reglas: v.reglasAplicadas };
    for (const o of orig) {
      const F = { id: o.id, folio: num(o.enc.factura), programa: prog, casos: o.casos.length, lineas: o.llaves.size, por: txt(o.enc.facturado_por), uf_adlsoft: num(o.enc.uf_totalcaso) };
      const vals = await q(`SELECT id_caso, item, id_tecnica, n_analisis, vtaunitario, vtatotal FROM dbo.muestras_detalle WHERE id_caso IN (${o.casos.join(',')})`);
      const dv = new Map(vals.map((d) => [`${num(d.id_caso)}|${num(d.item)}`, d]));
      let ok = 0; const dif = [];
      for (const [k, vt] of o.llaves) { const d = dv.get(k); if (d && Math.abs(num(d.vtatotal) - vt) < 0.0006) ok++; else dif.push({ caso_item: k, tecnica: d?.id_tecnica, n: d?.n_analisis, adlsoft: vt, adlone: d ? num(d.vtatotal) : null }); }
      F.valorizacion = { iguales: ok, de: o.llaves.size, diferentes: dif.slice(0, 6) };
      // SAMIC y otros: los valores que la persona escribio a mano en la pantalla se pierden al eliminar la factura (tambien en ADLSOFT); aqui se vuelven a escribir con los valores originales
      if (process.env.REPLAY_MANUAL) {
        const manuales = await q(`SELECT o.id_caso, o.item, o.id_tecnica, o.n_analisis, o.vtaunitario FROM LaboratorioADL_antes_prueba.dbo.muestras_detalle o JOIN dbo.muestras_detalle h ON h.id_caso=o.id_caso AND h.item=o.item WHERE o.id_caso IN (${o.casos.join(',')}) AND o.id_facturacion = ${o.id} AND o.valorizado='N' AND o.vtaunitario > 0 AND ISNULL(h.vtatotal,0) = 0`);
        for (const m of manuales) await s.actualizarLineaCasoManual({ id_caso: num(m.id_caso), item: num(m.item), id_tecnica: num(m.id_tecnica), n_analisis: num(m.n_analisis), vtaunitario: num(m.vtaunitario) });
        F.manuales_reescritas = manuales.length;
      }
      try {
        const c = await s.crearPrefacturasSalud({
          id_empresaservicio: num(o.enc.id_empresaservicio), eligeprograma: elige, criterio_agrupacion: txt(o.enc.facturado_por) || 'Na', casos_ids: o.casos,
          fecha_facturacion: txt(o.enc.fecha_facturacion), id_formapago: num(o.enc.id_formapago), id_glosa: num(o.enc.id_glosa), glosa: txt(o.enc.glosa), observaciones: txt(o.enc.observaciones),
          nota: txt(o.enc.nota), mes: txt(o.enc.mes), ano: txt(o.enc.ano), ...rango, fecha_informe_ini: txt(o.enc.fecha_informe_ini), fecha_informe_fin: txt(o.enc.fecha_informe_fin)
        });
        const nuevos = c.prefacturas.map((p) => num(p.id_facturacion));
        const detN = await q(`SELECT d.id_caso, d.item, d.vtatotal FROM dbo.facturacion_det d WHERE d.id_facturacion IN (${nuevos.join(',')})`);
        const nm = new Map(detN.map((d) => [`${num(d.id_caso)}|${num(d.item)}`, num(d.vtatotal)]));
        let ig = 0; const dd = []; let sumaMismas = 0;
        for (const [k, vt] of o.llaves) { if (nm.has(k)) { sumaMismas += nm.get(k); if (Math.abs(nm.get(k) - vt) < 0.0006) ig++; else dd.push({ caso_item: k, adlsoft: vt, adlone: nm.get(k) }); } else dd.push({ caso_item: k, adlsoft: vt, adlone: 'FALTA' }); }
        const extras = detN.filter((d) => !o.llaves.has(`${num(d.id_caso)}|${num(d.item)}`)).map((d) => ({ caso_item: `${num(d.id_caso)}|${num(d.item)}`, vt: num(d.vtatotal) }));
        F.prefactura = { creadas: nuevos.length, lineas_iguales: ig, de: o.llaves.size, distintas: dd.slice(0, 6), uf_misma_lineas_adlone: Math.round(sumaMismas * 1000) / 1000, uf_adlsoft: num(o.enc.uf_totalcaso), extras_no_estaban_en_la_original: extras.slice(0, 6) };
      } catch (e) { F.prefactura = { error: e.message }; }
      G.facturas.push(F);
    }
  } catch (e) { G.errores.push(e.message); }
  salida.push(G);
  console.log(JSON.stringify(G, null, 1));
}
fs.writeFileSync((process.env.SALIDA || '.') + '/resultados-valorizacion-' + process.argv.slice(2).join('_').replace(/\+/g, '-') + '.json', JSON.stringify(salida, null, 1));
await db0.closeConnectionSalud(); process.exit(0);
