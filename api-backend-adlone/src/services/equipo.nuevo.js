// Lectura de equipos desde el ESQUEMA NUEVO con la misma respuesta que equipo.service.js (legado). Ids legados (mig_id_map).
// Piloto de la Fase 1: solo lecturas (catálogo y listado). Se activa con EQUIPOS_DB=nuevo (ver equipo.service.js).
import sql from 'mssql';
import { getConnectionNueva } from '../config/databaseNueva.js';

const leg = (tl) => `(SELECT id_nuevo, MIN(id_legado) id_leg FROM mig_id_map WHERE tabla_legado='${tl}' AND id_nuevo > 0 GROUP BY id_nuevo)`;
const consulta = async (texto, params = {}) => { const pool = await getConnectionNueva(); const r = pool.request(); for (const [k, v] of Object.entries(params)) r.input(k, ...(Array.isArray(v) ? v : [v])); return (await r.query(texto)).recordset; };
const SN = (b) => (b ? 'S' : 'N');
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const dmy = (d) => (d ? `${iso(d).slice(8, 10)}/${iso(d).slice(5, 7)}/${iso(d).slice(0, 4)}` : null);

// Un equipo con todo lo que el listado del legado devuelve, ya con ids legados.
// La custodia es una persona O una sede; en el legado ambas eran "muestreadores" (id_muestreador).
const BASE = `SELECT e.*, me.id_leg, c.tipo_equipo, c.que_mide, c.unidad_medida_texto, c.unidad_medida_sigla,
    COALESCE(mp.id_leg, ml.id_leg) AS id_muestreador_leg, COALESCE(p.nombre, l.nombre) AS nombre_asignado,
    CASE WHEN p.id IS NOT NULL THEN p.habilitado WHEN l.id IS NOT NULL THEN l.habilitado END AS hab_asignado
  FROM eqp_equipo e JOIN ${leg('mae_equipo')} me ON me.id_nuevo = e.id JOIN eqp_catalogo c ON c.id = e.id_equipo_catalogo
  LEFT JOIN per_persona p ON p.id = e.id_persona_responsable LEFT JOIN ${leg('mae_muestreador')} mp ON mp.id_nuevo = p.id
  LEFT JOIN eqp_lugar_guardado l ON l.id = e.id_lugar_guardado LEFT JOIN ${leg('mae_muestreador#sede')} ml ON ml.id_nuevo = l.id`;

const aFila = (r) => ({
  id_equipo: r.id_leg, codigo: r.codigo, nombre: r.nombre, tipo: r.tipo_equipo, ubicacion: r.sede, vigencia: dmy(r.siguiente_verificacion), id_muestreador: r.id_muestreador_leg,
  estado: r.habilitado ? 'Activo' : 'Inactivo', nombre_asignado: r.nombre_asignado, habilitado_muestreador: r.hab_asignado == null ? null : SN(r.hab_asignado), sigla: r.sigla, correlativo: r.correlativo,
  tiene_fc: r.tiene_factor_correccion ? 'Si' : 'No', error0: r.error_0, error15: r.error_15, error30: r.error_30, equipo_asociado: r.equipo_asociado, observacion: r.observacion, visible_muestreador: SN(r.visible_muestreador),
  que_mide: r.que_mide, unidad_medida_textual: r.unidad_medida_texto, unidad_medida_sigla: r.unidad_medida_sigla, informe: SN(r.aparece_en_informe), version: r.version,
  ultima_verificacion: iso(r.ultima_verificacion), siguiente_verificacion: iso(r.siguiente_verificacion), plazo_vigencia: r.plazo_vigencia, estado_equipo: r.estado });

export const equipoNuevo = {
  getEquipoCatalogo: async () => (await consulta(`SELECT c.*, m.id_leg FROM eqp_catalogo c JOIN ${leg('mae_equipo_catalogo')} m ON m.id_nuevo = c.id ORDER BY c.nombre`))
    .map((r) => ({ id_equipocatalogo: r.id_leg, nombre: r.nombre, que_mide: r.que_mide, unidad_medida_textual: r.unidad_medida_texto, unidad_medida_sigla: r.unidad_medida_sigla, tipo_equipo: r.tipo_equipo })),

  async getEquipoById(id) { const f = await consulta(`SELECT x.* FROM (${BASE}) x WHERE x.id_leg = @id`, { id: [sql.Int, Number(id)] }); return f[0] ? aFila(f[0]) : undefined; },

  async getNextCorrelativo(tipo) {
    const r = (await consulta(`SELECT MAX(e.correlativo) AS ultimo FROM eqp_equipo e JOIN eqp_catalogo c ON c.id = e.id_equipo_catalogo WHERE c.tipo_equipo = @tipo`, { tipo: [sql.VarChar, tipo] }))[0].ultimo;
    return { nextCorrelativo: (r !== null && r !== undefined && !Number.isNaN(Number(r)) ? Number(r) : 0) + 1 };
  },

  // Misma lógica que el legado: sigla más frecuente por nombre/tipo (o la de un mapa fijo), luego el último correlativo de esa sigla.
  async suggestNextCode(tipo, ubicacion, nombre = '') {
    const sg = await consulta(`SELECT TOP 1 x.sigla FROM (${BASE}) x WHERE (x.nombre LIKE @nombre OR x.tipo_equipo LIKE @tipo) AND x.sigla IS NOT NULL AND x.sigla != ''
      GROUP BY x.sigla ORDER BY MAX(CASE WHEN x.nombre LIKE @nombre THEN 1 ELSE 0 END) DESC, COUNT(*) DESC`, { tipo: [sql.VarChar, `%${tipo}%`], nombre: [sql.VarChar, `%${nombre}%`] });
    let sigla = 'EQ';
    if (sg.length && sg[0].sigla) sigla = sg[0].sigla;
    else {
      const comunes = { 'Analizador': 'ANA', 'Balanza': 'BAL', 'Cámara': 'CAM', 'Centrífuga': 'CEN', 'GPS': 'GPS', 'Sistema de Posicionamiento Global': 'GPS', 'Molinete': 'MOL', 'Instrumento': 'INS', 'Medidor': 'MED', 'Multiparámetro': 'MPA', 'Phmetro': 'PHM', 'Sonda Caudal': 'MCA', 'Sonda': 'SON' };
      const buscada = (nombre + ' ' + tipo).toLowerCase();
      for (const [k, v] of Object.entries(comunes)) if (buscada.includes(k.toLowerCase())) { sigla = v; break; }
    }
    const previo = await consulta(`SELECT TOP 1 x.correlativo AS ultimo, x.codigo AS previousCode, CASE WHEN x.habilitado = 1 THEN 'Activo' ELSE 'Inactivo' END AS previousStatus FROM (${BASE}) x WHERE x.sigla = @sigla ORDER BY x.correlativo DESC`, { sigla: [sql.VarChar, sigla] });
    const ultimo = previo.length ? Number(previo[0].ultimo) || 0 : 0; const siguiente = ultimo + 1;
    return { sigla, correlativo: siguiente, suggestedCode: `${sigla}.${String(siguiente).padStart(2, '0')}/MA.${ubicacion}`, previousCode: previo.length ? previo[0].previousCode : null, previousStatus: previo.length ? previo[0].previousStatus : null };
  },

  // Solo las versiones anteriores REALES del legado (la "línea base" de la versión vigente que crea la migración no existe en el legado).
  async getEquipoHistorial(id) {
    const parsed = Number(id); if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('ID de equipo inválido');
    const filas = await consulta(`SELECT TOP 7 h.*, mh.id_leg AS id_hist_leg, me.id_leg AS id_equipo_leg, COALESCE(mp.id_leg, ml.id_leg) AS id_muestreador_leg, COALESCE(u.nombre, 'NA') AS nombre_usuario_cambio
      FROM eqp_historial h JOIN ${leg('mae_equipo_historial')} mh ON mh.id_nuevo = h.id JOIN ${leg('mae_equipo')} me ON me.id_nuevo = h.id_equipo
      LEFT JOIN per_persona p ON p.id = h.id_persona_responsable LEFT JOIN ${leg('mae_muestreador')} mp ON mp.id_nuevo = p.id
      LEFT JOIN eqp_lugar_guardado l ON l.id = h.id_lugar_guardado LEFT JOIN ${leg('mae_muestreador#sede')} ml ON ml.id_nuevo = l.id
      LEFT JOIN usr_usuario u ON u.id = h.id_usuario_cambio
      WHERE me.id_leg = @id ORDER BY h.fecha_cambio DESC`, { id: [sql.Int, parsed] });
    return filas.map((r) => ({ id_historial: r.id_hist_leg, id_equipo: r.id_equipo_leg, nombre: r.nombre, tipo: r.tipo_equipo, ubicacion: r.sede, vigencia: dmy(r.fecha_vigencia), ultima_verificacion: r.ultima_verificacion, siguiente_verificacion: r.siguiente_verificacion,
      plazo_vigencia: r.plazo_vigencia, estado_equipo: r.estado, id_muestreador: r.id_muestreador_leg, estado: r.habilitado ? 'Activo' : 'Inactivo', sigla: r.sigla, correlativo: r.correlativo,
      tiene_fc: r.tiene_factor_correccion ? 'Si' : 'No', error0: r.error_0, error15: r.error_15, error30: r.error_30, equipo_asociado: r.equipo_asociado, observacion: r.observacion, visible_muestreador: SN(r.visible_muestreador),
      que_mide: r.que_mide, unidad_medida_textual: r.unidad_medida_texto, unidad_medida_sigla: r.unidad_medida_sigla, informe: SN(r.aparece_en_informe), fecha_cambio: r.fecha_cambio, version: r.version, nombre_usuario_cambio: r.nombre_usuario_cambio }));
  },

  async getEquipos(params = {}) {
    const { search, tipo, sede, estado, fechaDesde, fechaHasta, id_muestreador, expiredOnly, inactiveSamplerOnly, sortBy, page = 1, limit = 10 } = params;
    const p = {}; let where = ' WHERE 1=1';
    if (search) { p.search = [sql.VarChar, `%${search}%`]; where += ' AND (x.codigo LIKE @search OR x.nombre LIKE @search OR x.tipo_equipo LIKE @search OR x.sede LIKE @search OR x.nombre_asignado LIKE @search)'; }
    if (tipo && tipo !== 'Todos') { p.tipo = [sql.VarChar, tipo]; where += ' AND x.tipo_equipo = @tipo'; }
    if (sede && sede !== 'Todos') { p.sede = [sql.VarChar, sede]; where += ' AND x.sede = @sede'; }
    if (estado && estado !== 'Todos') { p.habilitado = [sql.Bit, estado === 'Activo']; where += ' AND x.habilitado = @habilitado'; }
    if (id_muestreador && id_muestreador !== 'Todos') { p.idm = [sql.Int, Number(id_muestreador)]; where += ' AND x.id_muestreador_leg = @idm'; }
    if (fechaDesde) { p.fd = [sql.Date, new Date(fechaDesde)]; where += ' AND x.siguiente_verificacion >= @fd'; }
    if (fechaHasta) { p.fh = [sql.Date, new Date(fechaHasta)]; where += ' AND x.siguiente_verificacion <= @fh'; }
    if (expiredOnly === 'true' || expiredOnly === true) where += ' AND x.habilitado = 1 AND x.siguiente_verificacion IS NOT NULL AND x.siguiente_verificacion < CAST(GETDATE() AS DATE)';
    if (inactiveSamplerOnly === 'true' || inactiveSamplerOnly === true) where += ' AND x.hab_asignado = 0';
    const total = (await consulta(`SELECT COUNT(*) total FROM (${BASE}) x ${where}`, p))[0].total;
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const filas = await consulta(`SELECT x.* FROM (${BASE}) x ${where}
      ORDER BY (CASE WHEN EXISTS (SELECT 1 FROM sol_solicitud s JOIN sol_tipo t ON s.id_tipo = t.id WHERE s.estado IN ('PENDIENTE','ACEPTADA','EN_REVISION') AND t.modulo_destino = 'EQUIPOS'
                   AND JSON_VALUE(s.datos_json, '$.id_equipo') = CAST(x.id_leg AS NVARCHAR(20))) THEN 0 ELSE 1 END) ASC,
        ${sortBy === 'vigencia' ? 'CASE WHEN x.siguiente_verificacion IS NULL THEN 1 ELSE 0 END ASC, x.siguiente_verificacion ASC,' : ''} x.id_leg ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`, { ...p, offset: [sql.Int, offset], limit: [sql.Int, Number(limit)] });
    const data = filas.map(aFila);

    // catálogos para los filtros (dependen solo de la sede elegida)
    const sd = sede && sede !== 'Todos' ? { sedeFilter: [sql.VarChar(100), sede] } : {}; const conSede = sede && sede !== 'Todos' ? ' AND x.sede = @sedeFilter' : '';
    const [tipos, estados, sedes, nombres, queMide, unidades, expiring, expired, inactivos] = await Promise.all([
      consulta(sede && sede !== 'Todos' ? `SELECT DISTINCT tipo_equipo AS v FROM (${BASE}) x WHERE tipo_equipo IS NOT NULL${conSede}` : 'SELECT DISTINCT tipo_equipo AS v FROM eqp_catalogo WHERE tipo_equipo IS NOT NULL', sd),
      consulta(`SELECT DISTINCT CASE WHEN habilitado = 1 THEN 'Activo' ELSE 'Inactivo' END AS v FROM eqp_equipo x WHERE 1=1${conSede}`, sd),
      consulta(`SELECT DISTINCT sede AS v FROM eqp_equipo WHERE sede IS NOT NULL AND LEN(TRIM(sede)) > 0`),
      equipoNuevo.getEquipoCatalogo(),
      consulta(sede && sede !== 'Todos' ? `SELECT DISTINCT que_mide AS v FROM (${BASE}) x WHERE que_mide IS NOT NULL AND LEN(TRIM(que_mide)) > 0${conSede}` : 'SELECT DISTINCT que_mide AS v FROM eqp_catalogo WHERE que_mide IS NOT NULL AND LEN(TRIM(que_mide)) > 0', sd),
      consulta(sede && sede !== 'Todos' ? `SELECT DISTINCT unidad_medida_texto AS v FROM (${BASE}) x WHERE unidad_medida_texto IS NOT NULL AND LEN(TRIM(unidad_medida_texto)) > 0${conSede}` : 'SELECT DISTINCT unidad_medida_texto AS v FROM eqp_catalogo WHERE unidad_medida_texto IS NOT NULL AND LEN(TRIM(unidad_medida_texto)) > 0', sd),
      consulta(`SELECT COUNT(*) cnt FROM eqp_equipo WHERE habilitado = 1 AND siguiente_verificacion IS NOT NULL AND siguiente_verificacion <= DATEADD(day, 30, CAST(GETDATE() AS DATE)) AND siguiente_verificacion >= CAST(GETDATE() AS DATE)`),
      consulta(`SELECT COUNT(*) cnt FROM eqp_equipo WHERE habilitado = 1 AND siguiente_verificacion IS NOT NULL AND siguiente_verificacion < CAST(GETDATE() AS DATE)`),
      consulta(`SELECT COUNT(*) cnt FROM (${BASE}) x WHERE x.hab_asignado = 0`),
    ]);
    const ord = (a) => a.map((r) => r.v).sort();
    return { data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit), expiringCount: expiring[0].cnt, expiredCount: expired[0].cnt, inactiveSamplerCount: inactivos[0].cnt,
      catalogs: { tipos: ord(tipos), estados: ord(estados), sedes: ord(sedes), nombres, que_mide: ord(queMide), unidades: ord(unidades) } };
  },
};
