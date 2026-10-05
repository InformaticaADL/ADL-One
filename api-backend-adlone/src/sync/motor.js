// Motor de sincronización legado → esquema nuevo. Solo lee el legado; solo escribe en la base nueva.
//
// Una pasada:
//   1. por cada tabla del registro calcula las huellas del legado y las compara con las ya sincronizadas;
//   2. aplica altas y cambios en orden de dependencia (padres primero), cada uno en su propia transacción;
//   3. aplica los borrados en orden inverso (hijos primero);
//   4. un cambio que falla no detiene la pasada: queda en mig_sync_error y se reintenta en la siguiente.
import sql from 'mssql';
import { getConnection } from '../config/database.js';
import { getConnectionNueva } from '../config/databaseNueva.js';
import { REGISTRO } from './registro.js';
import { huellasLegado, comparar } from './detector.js';
import { ejecutor, cargarHuellas, guardarHuella, borrarHuella, tablasDeshabilitadas, registrarError, registrarAviso, resolverErrores, actualizarEstado } from './estado.js';
import { manejadores as sol } from './handlers/sol.js';
import { manejadores as geo } from './handlers/geo.js';
import { manejadores as cat } from './handlers/cat.js';
import { manejadores as per } from './handlers/per.js';
import { manejadores as usr } from './handlers/usr.js';
import { manejadores as eqp } from './handlers/eqp.js';
import { manejadores as cli } from './handlers/cli.js';
import { manejadores as fac } from './handlers/fac.js';
import { manejadores as fic } from './handlers/fic.js';
import { manejadores as ficcat } from './handlers/ficcat.js';
import { manejadores as ficdocs } from './handlers/ficdocs.js';
import { manejadores as perhijos } from './handlers/perhijos.js';
import { manejadores as solhijos } from './handlers/solhijos.js';
import { manejadores as rut } from './handlers/rut.js';

const MANEJADORES = { ...geo, ...cat, ...per, ...usr, ...eqp, ...cli, ...fac, ...fic, ...ficcat, ...ficdocs, ...sol, ...perhijos, ...solhijos, ...rut };

export async function ejecutarPasada({ modulo, tabla, simular = false, log = () => {} } = {}) {
  const leg = await getConnection(), nuevo = await getConnectionNueva();
  const apagadas = await tablasDeshabilitadas(nuevo);
  const cfgs = REGISTRO.filter((c) => (!modulo || c.modulo === modulo) && (!tabla || c.tabla === tabla) && !apagadas.has(c.tabla)).sort((a, b) => a.orden - b.orden);
  const plan = [];
  for (const cfg of cfgs) {
    const legado = await huellasLegado(leg, cfg), guardado = await cargarHuellas(nuevo, cfg.tabla);
    const { upserts, borrados } = comparar(legado, guardado);
    plan.push({ cfg, upserts, borrados, total: legado.length, sinManejador: !MANEJADORES[cfg.tabla] });
  }
  const resumen = plan.map((p) => ({ tabla: p.cfg.tabla, filas_legado: p.total, por_copiar: p.upserts.length, por_borrar: p.borrados.length, manejador: p.sinManejador ? 'NO' : 'sí' }));
  if (simular) return { resumen, aplicados: 0, borrados: 0, errores: 0 };

  const ctx = {}; const c = new Map(plan.map((p) => [p.cfg.tabla, { aplicados: 0, borrados: 0, errores: 0, avisos: 0, ultimoError: null }]));
  const unidad = async (cfg, clave, operacion, fn, h) => {
    const tx = new sql.Transaction(nuevo); await tx.begin(); const cont = c.get(cfg.tabla);
    try {
      const run = ejecutor(tx);
      const r = await fn({ ctx, run, leg, clave, cfg });
      if (r !== 'SIN_FILA') { if (operacion === 'UPSERT') await guardarHuella(run, cfg.tabla, clave, h); else await borrarHuella(run, cfg.tabla, clave); }
      await tx.commit(); await resolverErrores(nuevo, cfg.tabla, clave);
      if (typeof r === 'string' && r.startsWith('AVISO:')) { await registrarAviso(nuevo, cfg.tabla, clave, r.slice(6).trim()); cont.avisos++; log(`  ! ${cfg.tabla} ${clave}: ${r.slice(6).trim()}`); }
      else if (r !== 'SIN_FILA') cont[operacion === 'UPSERT' ? 'aplicados' : 'borrados']++;
    } catch (e) {
      try { await tx.rollback(); } catch { /* ya cerrada */ }
      cont.errores++; cont.ultimoError = `${clave}: ${e.message}`; await registrarError(nuevo, cfg.tabla, clave, operacion, e.message); log(`  ✗ ${cfg.tabla} ${clave} (${operacion}): ${e.message}`);
    }
  };
  for (const p of plan) { const m = MANEJADORES[p.cfg.tabla]; if (!m) continue; for (const u of p.upserts) await unidad(p.cfg, u.clave, 'UPSERT', m.upsert, u); }
  for (const p of [...plan].reverse()) { const m = MANEJADORES[p.cfg.tabla]; if (!m) continue; for (const k of p.borrados) await unidad(p.cfg, k, 'DELETE', m.borrar); }
  for (const [tb, v] of c) await actualizarEstado(nuevo, tb, v);
  const suma = (k) => [...c.values()].reduce((a, v) => a + v[k], 0);
  return { resumen, aplicados: suma('aplicados'), borrados: suma('borrados'), errores: suma('errores'), avisos: suma('avisos') };
}
