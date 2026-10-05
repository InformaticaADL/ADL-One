// Foto del equipo que guarda cada fila de eqp_historial (patch 18). Compartido por el cargador (scripts/migracion-eqp.mjs) y el motor de
// sincronización: recibe una fila del legado (mae_equipo o mae_equipo_historial, que comparten nombres de columna) y los mapas de custodia.
import { norm, t, si, soloFecha } from '../comun.js';

const corto = (s, n) => { const x = t(s); return x ? x.slice(0, n) : null; };

// personas / sedes: Map(id_muestreador legado → id nuevo). El custodio es una persona O una sede.
export function fotoEquipo(x, personas, sedes) {
  const idMue = Number(x.id_muestreador); const persona = personas.get(idMue) ?? null; const lugar = persona ? null : (sedes.get(idMue) ?? null);
  return {
    tipo_equipo: corto(x.tipoequipo, 80), habilitado: si(x.habilitado, true), id_persona_responsable: persona, id_lugar_guardado: lugar, fecha_vigencia: soloFecha(x.fecha_vigencia),
    equipo_asociado: corto(x.equipo_asociado, 200), observacion: corto(x.observacion, 1000), visible_muestreador: si(x.visible_muestreador, true), aparece_en_informe: si(x.informe),
    que_mide: corto(x.que_mide, 250), unidad_medida_texto: corto(x.unidad_medida_textual, 250), unidad_medida_sigla: corto(x.unidad_medida_sigla, 100), plazo_vigencia: corto(x.Plazo_Vigencia, 500),
  };
}
void norm;

// El uso de un equipo (App_Ma_Equipos_MUESTREOS) guarda la versión del equipo con la que se muestreó y los valores de corrección de esa versión
// (tienefc, error0/15/30). A veces esa versión no existe en el historial del equipo (6 visitas del equipo 18 citan "v15" y el equipo va en "v1"):
// para no perder esos valores se crea una fila de historial de esa versión, con la foto ACTUAL del equipo y los valores del uso.
// Devuelve el id de esa fila (la crea solo si no existía).
export async function versionCitada(run, idEquipo, uso) {
  const v = (t(uso.version) || 'v1').slice(0, 10);
  const ya = (await run(`SELECT TOP 1 id FROM eqp_historial WHERE id_equipo=@e AND version=@v`, { e: idEquipo, v }))[0]?.id; if (ya) return ya;
  const num = (x) => { const n = Number(String(x ?? '').replace(',', '.')); return x == null || String(x).trim() === '' || !Number.isFinite(n) ? null : n; };
  return (await run(`DECLARE @o TABLE (id INT);
    INSERT INTO eqp_historial (id_equipo, version, codigo, sigla, correlativo, nombre, sede, tiene_factor_correccion, error_0, error_15, error_30, ultima_verificacion, siguiente_verificacion, estado, motivo,
        tipo_equipo, habilitado, id_persona_responsable, id_lugar_guardado, fecha_vigencia, equipo_asociado, observacion, visible_muestreador, aparece_en_informe, que_mide, unidad_medida_texto, unidad_medida_sigla, plazo_vigencia)
    OUTPUT INSERTED.id INTO @o
    SELECT e.id, @v, e.codigo, e.sigla, e.correlativo, e.nombre, e.sede, @fc, @e0, @e15, @e30, e.ultima_verificacion, e.siguiente_verificacion, e.estado, N'Versión citada por un uso de equipo; no existía en el historial del legado (foto actual del equipo, valores de corrección del uso)',
        c.tipo_equipo, e.habilitado, e.id_persona_responsable, e.id_lugar_guardado, e.fecha_vigencia, e.equipo_asociado, e.observacion, e.visible_muestreador, e.aparece_en_informe, c.que_mide, c.unidad_medida_texto, c.unidad_medida_sigla, e.plazo_vigencia
    FROM eqp_equipo e JOIN eqp_catalogo c ON c.id = e.id_equipo_catalogo WHERE e.id = @eq;
    SELECT id FROM @o;`, { v, fc: si(uso.tienefc), e0: num(uso.error0), e15: num(uso.error15), e30: num(uso.error30), eq: idEquipo }))[0].id;
}
