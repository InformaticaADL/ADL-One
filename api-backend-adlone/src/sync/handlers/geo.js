// Manejadores del módulo geo_. Mismas reglas que scripts/migracion-geo.mjs:
//   - se omiten las filas "No aplica" / "No informado" / vacías (en el esquema nuevo eso es NULL);
//   - los nombres repetidos se FUSIONAN: varias filas del legado apuntan a un mismo id nuevo (mig_id_map);
//   - la fila del legado con el id menor que creó la fila nueva es su "dueña": solo ella actualiza los atributos.
import { norm, si, placeholder, insertar, actualizar, fijarMapa } from '../comun.js';
import { mapa, filaLegado } from './contexto.js';
import { REGION_DE_COMUNA } from '../datos/regionDeComuna.js';

const NOTA_FUSION = 'fusionado por nombre con otro id legado';
const esFusion = (nota) => String(nota ?? '').startsWith('fusionado');

function catalogo(def) {
  const nomCol = def.nombreCol || 'nombre';
  const buscar = def.buscar || (async (run, nom) => (await run(`SELECT TOP 1 id FROM ${def.nueva} WHERE [${nomCol}]=@n ORDER BY id`, { n: nom }))[0]?.id);
  return {
    async upsert({ ctx, run, leg, clave }) {
      const r = await filaLegado(leg, def.legado, def.idCol, clave); if (!r) return 'SIN_FILA';
      const idL = Number(r[def.idCol]); const nom = norm(def.nombre(r));
      const previo = (await run(`SELECT id_nuevo, nota FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: def.legado, l: idL }))[0];
      if (def.excluir(r, nom)) { if (previo) await run(`DELETE FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: def.legado, l: idL }); return; }
      if (def.maxLen && nom.length > def.maxLen) throw new Error(`el nombre de ${idL} excede ${def.maxLen} caracteres`);
      const extra = def.extra ? await def.extra(r, { ctx, run }) : {};
      const cols = { [nomCol]: nom, ...extra };
      const objetivo = await buscar(run, nom, extra);
      if (!previo) {
        if (objetivo != null) await fijarMapa(run, def.legado, idL, def.nueva, objetivo, NOTA_FUSION);
        else await fijarMapa(run, def.legado, idL, def.nueva, await insertar(run, def.nueva, cols), null);
        return;
      }
      const dueña = !esFusion(previo.nota);
      if (objetivo == null) {
        if (dueña) await actualizar(run, def.nueva, previo.id_nuevo, cols);                       // la fila dueña cambió de nombre
        else await fijarMapa(run, def.legado, idL, def.nueva, await insertar(run, def.nueva, cols), null);   // un miembro fusionado ya no coincide: fila propia
      } else if (objetivo === previo.id_nuevo) {
        if (dueña) await actualizar(run, def.nueva, previo.id_nuevo, cols);                       // mismo nombre: se refrescan los atributos
      } else await fijarMapa(run, def.legado, idL, def.nueva, objetivo, NOTA_FUSION);            // ahora coincide con otra fila: se fusiona
    },
    async borrar({ run, clave }) {
      const previo = (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: def.legado, l: Number(clave) }))[0]; if (!previo) return;
      await run(`DELETE FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: def.legado, l: Number(clave) });
      // la fila nueva solo se elimina si ningún otro id legado apunta a ella; si algo la referencia, el error queda en la cola
      const otros = (await run(`SELECT COUNT(*) n FROM mig_id_map WHERE tabla_nueva=@n AND id_nuevo=@i`, { n: def.nueva, i: previo.id_nuevo }))[0].n;
      if (!otros) await run(`DELETE FROM ${def.nueva} WHERE id=@i`, { i: previo.id_nuevo });
    },
  };
}

const D = {
  mae_region: { legado: 'mae_region', nueva: 'geo_region', idCol: 'id_region', nombre: (r) => r.nombre_region, maxLen: 100,
    extra: (r) => ({ numero_romano: norm(r.numero) && norm(r.numero) !== '0' ? norm(r.numero).slice(0, 10) : null, habilitado: si(r.habilitado, true) }),
    excluir: (r, n) => placeholder(n) },
  mae_comuna: { legado: 'mae_comuna', nueva: 'geo_comuna', idCol: 'id_comuna', nombre: (r) => r.nombre_comuna,
    // la región no viene en mae_comuna: sale del mapeo explícito; una comuna nueva sin mapeo se rechaza (cola de errores)
    async extra(r, { ctx, run }) {
      const regLeg = REGION_DE_COMUNA.get(Number(r.id_comuna)); if (!regLeg) throw new Error(`la comuna ${r.id_comuna} "${norm(r.nombre_comuna)}" no tiene región asignada: agrégala a src/sync/datos/regionDeComuna.js`);
      const reg = (await mapa(ctx, run, 'mae_region')).get(regLeg); if (!reg) throw new Error(`la región ${regLeg} aún no está en geo_region`);
      return { id_region: reg, habilitado: si(r.habilitado, true) };
    },
    buscar: async (run, nom, extra) => (await run(`SELECT TOP 1 id FROM geo_comuna WHERE id_region=@r AND nombre=@n ORDER BY id`, { r: extra.id_region, n: nom }))[0]?.id,
    excluir: (r, n) => placeholder(n) },
  mae_zonas: { legado: 'mae_zonas', nueva: 'geo_zona', idCol: 'id_zona', nombre: (r) => r.nombre_zona, maxLen: 150, excluir: (r, n) => placeholder(n) },
  mae_zonageografica: { legado: 'mae_zonageografica', nueva: 'geo_sector', idCol: 'id_zonageografica', nombre: (r) => r.nombre_zonageografica, maxLen: 250, excluir: (r, n) => placeholder(n) },
  mae_tipoagua: { legado: 'mae_tipoagua', nueva: 'geo_tipo_agua', idCol: 'id_tipoagua', nombre: (r) => r.nombre_tipoagua, maxLen: 80,
    extra: (r) => ({ grupo: ['AD', 'AM', 'AE'].includes(norm(r.agrupa)) ? norm(r.agrupa) : null }),
    excluir: (r, n) => placeholder(n) || /sin nombre\/barrio/i.test(n) },
  mae_zonautm: { legado: 'mae_zonautm', nueva: 'geo_zona_utm', idCol: 'id_zonautm', nombre: (r) => r.nombre_zonautm, maxLen: 10, extra: (r) => ({ habilitado: si(r.habilitado, true) }), excluir: (r, n) => placeholder(n) },
  mae_umedida: { legado: 'mae_umedida', nueva: 'geo_unidad_medida', idCol: 'id_umedida', nombre: (r) => r.nombre_umedida, maxLen: 40, excluir: (r, n) => n.toUpperCase() === 'NA' || placeholder(n) },
  // barrio: el dato útil es el CÓDIGO (el nombre casi siempre está en blanco)
  mae_barrio: { legado: 'mae_barrio', nueva: 'geo_barrio', idCol: 'id_barrio', nombre: (r) => r.codigo_barrio, nombreCol: 'codigo', maxLen: 10,
    extra: (r) => ({ nombre: norm(r.nombre_barrio) || null }), excluir: (r, n) => n === '' || /^(NA|NI)$/i.test(n) },
};

export const manejadores = Object.fromEntries(Object.entries(D).map(([k, def]) => [k, catalogo(def)]));
