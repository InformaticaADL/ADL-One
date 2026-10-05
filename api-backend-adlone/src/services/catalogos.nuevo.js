// Lectura de catálogos desde el ESQUEMA NUEVO, con la MISMA forma que devuelven hoy los procedimientos/consultas del legado
// (nombres de columna, 'S'/'N', y los ids LEGADOS: mientras las escrituras sigan yendo al legado, los formularios deben seguir
// enviando ids legados; por eso cada fila nueva se traduce con mig_id_map).
// Piloto de la Fase 1 del plan de migración de las apps. Se activa con CATALOGOS_DB=nuevo (ver catalogos.service.js); por omisión sigue el legado.
import { getConnectionNueva } from '../config/databaseNueva.js';

const SN = (b) => (b ? 'S' : 'N');
// Fila nueva + su id legado (si varias filas legadas se fusionaron en una nueva, se usa el menor: es la que "sobrevivió")
const conIdLegado = (tabla, tablaLegado) => `SELECT t.*, m.id_leg FROM ${tabla} t JOIN (SELECT id_nuevo, MIN(id_legado) id_leg FROM mig_id_map WHERE tabla_legado='${tablaLegado}' AND id_nuevo > 0 GROUP BY id_nuevo) m ON m.id_nuevo = t.id`;
const consulta = async (sqlText, params = {}) => { const pool = await getConnectionNueva(); const r = pool.request(); for (const [k, v] of Object.entries(params)) r.input(k, v); return (await r.query(sqlText)).recordset; };

// Catálogo simple { <nombre>, <id>, habilitado } (misma forma que sus procedimientos)
const simple = ({ tabla, tl, nombre, id, hab = 'habilitado', extra = '', orden = 'nombre' }) => async () =>
  (await consulta(`${conIdLegado(tabla, tl)} ${extra} WHERE t.habilitado = 1 ORDER BY ${orden}, id_leg`)).map((r) => ({ [nombre]: r.nombre, [id]: r.id_leg, [hab]: SN(r.habilitado) }));

export const catalogosNuevo = {
  getLugaresAnalisis: async () => (await consulta(`${conIdLegado('fic_lugar_analisis', 'mae_lugaranalisis')} WHERE t.habilitado = 1 ORDER BY t.nombre`)).map((r) => ({ id_lugaranalisis: r.id_leg, nombre_lugaranalisis: r.nombre, sigla: r.sigla })),
  getComponentesAmbientales: async () => (await consulta(`${conIdLegado('fic_componente', 'mae_tipomuestra')} ORDER BY id_leg`)).map((r) => ({ nombre_tipomuestra: r.nombre, activo: SN(r.habilitado), guia: 'N', aplicado_a: 'Medio ambiente', id_tipomuestra: r.id_leg })),
  async getSubAreas(idComponente) {
    if (!idComponente) return [];
    const rows = await consulta(`SELECT s.*, ms.id_leg, mc.id_leg AS id_leg_comp FROM fic_subarea s
      JOIN (SELECT id_nuevo, MIN(id_legado) id_leg FROM mig_id_map WHERE tabla_legado='mae_subarea' AND id_nuevo > 0 GROUP BY id_nuevo) ms ON ms.id_nuevo = s.id
      JOIN (SELECT id_nuevo, MIN(id_legado) id_leg FROM mig_id_map WHERE tabla_legado='mae_tipomuestra' AND id_nuevo > 0 GROUP BY id_nuevo) mc ON mc.id_nuevo = s.id_componente
      WHERE mc.id_leg = @c AND s.habilitado = 1 ORDER BY s.nombre`, { c: Number(idComponente) });
    return rows.map((r) => ({ nombre_subarea: r.nombre, id_subarea: r.id_leg, activo: SN(r.habilitado), id_tipomuestra: r.id_leg_comp }));
  },
  getTiposMuestreo: async () => (await consulta(`${conIdLegado('fic_tipo_muestreo', 'mae_tipomuestreo')} WHERE t.aplicado_a = N'Medio ambiente' AND t.habilitado = 1 ORDER BY t.nombre`)).map((r) => ({ nombre_tipomuestreo: r.nombre, aplicado_a: r.aplicado_a, id_tipomuestreo: r.id_leg })),
  getTiposMuestra: simple({ tabla: 'fic_tipo_muestra', tl: 'mae_tipomuestra_ma', nombre: 'nombre_tipomuestra_ma', id: 'id_tipomuestra_ma' }),
  getActividadesMuestreo: simple({ tabla: 'fic_actividad_muestreo', tl: 'mae_actividadmuestreo', nombre: 'nombre_actividadmuestreo', id: 'id_actividadmuestreo', hab: 'activo' }),
  getTiposDescarga: simple({ tabla: 'fic_tipo_descarga', tl: 'mae_tipodescarga', nombre: 'nombre_tipodescarga', id: 'id_tipodescarga' }),
  getModalidades: simple({ tabla: 'fic_modalidad_caudal', tl: 'mae_modalidad', nombre: 'nombre_modalidad', id: 'id_modalidad' }),
  getFormasCanal: simple({ tabla: 'fic_forma_canal', tl: 'mae_formacanal', nombre: 'nombre_formacanal', id: 'id_formacanal' }),
  getDispositivosHidraulicos: simple({ tabla: 'fic_dispositivo_hidraulico', tl: 'mae_dispositivohidraulico', nombre: 'nombre_dispositivohidraulico', id: 'id_dispositivohidraulico' }),
  getInstrumentosAmbientales: async () => (await consulta(`${conIdLegado('fic_instrumento_ambiental', 'mae_instrumentoambiental')} WHERE t.habilitado = 1 ORDER BY id_leg`)).map((r) => ({ id: r.id_leg, nombre: r.nombre })),
  // La fila id 0 ("NA") es un relleno del legado que no se migró; el desplegable de hoy la ofrece, así que se repone.
  getUnidadesMedida: async () => (await consulta(`SELECT id_leg, nombre FROM (${conIdLegado('geo_unidad_medida', 'mae_umedida')}) u UNION ALL SELECT 0, N'NA' ORDER BY nombre`)).map((r) => ({ id_umedida: r.id_leg, nombre_umedida: r.nombre })),
  // "No aplica" (id 0) es el relleno del legado; el resto sale de fic_frecuencia (requiere el parche 16: columna cantidad)
  getFrecuenciasPeriodo: async () => [{ nombre_frecuencia: 'No aplica', id_frecuencia: 0, habilitado: 'S', orden: 0, multiplicadopor: 0, cantidad: 1 },
    ...(await consulta(`${conIdLegado('fic_frecuencia', 'mae_frecuencia')} WHERE t.habilitado = 1 ORDER BY t.orden`)).map((r) => ({ nombre_frecuencia: r.nombre, id_frecuencia: r.id_leg, habilitado: SN(r.habilitado), orden: r.orden, multiplicadopor: r.multiplicador_anual, cantidad: r.cantidad }))],
};

// ── Clientes, centros, contactos y personal ─────────────────────────────────────────────────────
// id legado de una fila nueva: subconsulta reutilizable (si varias filas legadas se fusionaron en una, el menor)
const leg = (tl) => `(SELECT id_nuevo, MIN(id_legado) id_leg FROM mig_id_map WHERE tabla_legado='${tl}' AND id_nuevo > 0 GROUP BY id_nuevo)`;
Object.assign(catalogosNuevo, {
  getEmpresasServicio: async () => (await consulta(`SELECT s.*, m.id_leg FROM cli_empresa_servicio s JOIN ${leg('mae_empresaservicios')} m ON m.id_nuevo = s.id WHERE s.habilitado = 1 ORDER BY m.id_leg`))
    .map((r) => ({ id_empresaservicio: r.id_leg, nombre_empresaservicios: r.nombre, contacto_empresaservicios: r.contacto_nombre ?? '', email_contacto: r.contacto_email ?? '', email_empresaservicios: r.email ?? '' })),
  // Cliente = empresa. El legado guarda en la empresa su "empresa de servicio"; en el esquema nuevo el servicio cuelga de la empresa.
  async getClientes(idEmpresaServicio) {
    const filas = await consulta(`SELECT e.*, me.id_leg, ms.id_leg AS id_leg_serv FROM cli_empresa e JOIN ${leg('mae_empresa')} me ON me.id_nuevo = e.id
      LEFT JOIN (SELECT s.id_empresa, MIN(m.id_leg) id_leg FROM cli_empresa_servicio s JOIN ${leg('mae_empresaservicios')} m ON m.id_nuevo = s.id GROUP BY s.id_empresa) ms ON ms.id_empresa = e.id
      WHERE e.habilitado = 1 ${idEmpresaServicio ? 'AND ms.id_leg = @s' : ''} ORDER BY me.id_leg`, idEmpresaServicio ? { s: Number(idEmpresaServicio) } : {});
    return filas.map((r) => ({ id_empresa: r.id_leg, nombre_empresa: r.razon_social, id_empresaservicio: r.id_leg_serv, email_empresa: r.email ?? '' }));
  },
  async getCentros(idCliente, idEmpresaServicio) {
    const filas = await consulta(`SELECT c.*, mc.id_leg, me.id_leg AS id_leg_emp, e.razon_social, cm.id_leg AS id_leg_com, cm2.nombre AS nombre_comuna, rg.id_leg AS id_leg_reg, rg2.nombre AS nombre_region, ta.id_leg AS id_leg_ag, ta2.nombre AS nombre_agua
      FROM cli_centro c JOIN ${leg('mae_centro')} mc ON mc.id_nuevo = c.id
      LEFT JOIN (SELECT ec.id_centro, MIN(s.id_empresa) id_empresa FROM cli_empresa_centro ec JOIN cli_empresa_servicio s ON s.id = ec.id_empresa_servicio GROUP BY ec.id_centro) ce ON ce.id_centro = c.id
      LEFT JOIN cli_empresa e ON e.id = ce.id_empresa LEFT JOIN ${leg('mae_empresa')} me ON me.id_nuevo = e.id
      LEFT JOIN ${leg('mae_comuna')} cm ON cm.id_nuevo = c.id_comuna LEFT JOIN geo_comuna cm2 ON cm2.id = c.id_comuna
      LEFT JOIN ${leg('mae_region')} rg ON rg.id_nuevo = c.id_region LEFT JOIN geo_region rg2 ON rg2.id = c.id_region
      LEFT JOIN ${leg('mae_tipoagua')} ta ON ta.id_nuevo = c.id_tipo_agua LEFT JOIN geo_tipo_agua ta2 ON ta2.id = c.id_tipo_agua
      WHERE c.habilitado = 1${idCliente ? ' AND me.id_leg = @c' : ''} ORDER BY c.nombre`, idCliente ? { c: Number(idCliente) } : {});
    return filas.map((r) => ({ id_centro: r.id_leg, codigo_centro: r.codigo, nombre_centro: r.nombre, ubicacion: r.ubicacion ?? '', id_empresa: r.id_leg_emp, nombre_empresa: r.razon_social, id_comuna: r.id_leg_com ?? 0, nombre_comuna: r.nombre_comuna ?? 'No aplica',
      id_region: r.id_leg_reg ?? 0, nombre_region: r.nombre_region ?? 'No aplica', id_tipoagua: r.id_leg_ag ?? 0, nombre_tipoagua: r.nombre_agua ?? 'No aplica' }));
  },
  async getContactos(idCliente, idEmpresaServicio) {
    const filas = await consulta(`SELECT k.*, mk.id_leg, me.id_leg AS id_leg_emp, ms.id_leg AS id_leg_serv, mg.id_leg AS id_leg_cargo FROM cli_contacto k JOIN ${leg('mae_contacto')} mk ON mk.id_nuevo = k.id
      JOIN cli_empresa_servicio s ON s.id = k.id_empresa_servicio LEFT JOIN ${leg('mae_empresaservicios')} ms ON ms.id_nuevo = s.id LEFT JOIN ${leg('mae_empresa')} me ON me.id_nuevo = s.id_empresa
      LEFT JOIN ${leg('mae_cargo')} mg ON mg.id_nuevo = k.id_cargo WHERE k.habilitado = 1 ${idCliente ? 'AND me.id_leg = @c' : idEmpresaServicio ? 'AND ms.id_leg = @s' : ''} ORDER BY mk.id_leg`,
      idCliente ? { c: Number(idCliente) } : idEmpresaServicio ? { s: Number(idEmpresaServicio) } : {});
    return filas.map((r) => ({ id_contacto: r.id_leg, nombre_contacto: r.nombre, email_contacto: r.email, fono_contacto: r.telefono ?? '', id_cargo: r.id_leg_cargo ?? 0, habilitado: 'S', id_empresa: r.id_leg_emp, id_empresaservicio: r.id_leg_serv }));
  },
  getObjetivosMuestreo: async () => (await consulta(`${conIdLegado('fic_objetivo_muestreo', 'mae_objetivomuestreo_ma')} WHERE t.habilitado = 1 AND (t.tipo_informe = N'Informe Otros' OR m.id_leg = 1) ORDER BY t.nombre`)).map((r) => ({ nombre_objetivomuestreo_ma: r.nombre, informe: r.tipo_informe, id_objetivomuestreo_ma: r.id_leg, habilitado: SN(r.habilitado) })),
  getInspectores: async () => [{ nombre_inspector: 'No aplica', rut_inspector: 'No aplica', habilitado: 'S', firma_ruta: '', id_inspectorambiental: 1 }, ...(await consulta(`SELECT p.*, m.id_leg FROM per_persona p JOIN ${leg('mae_inspectorambiental')} m ON m.id_nuevo = p.id JOIN per_persona_rol r ON r.id_persona = p.id AND r.rol = 'INSPECTOR' AND r.habilitado = 1 WHERE p.habilitado = 1 ORDER BY m.id_leg`))
    .map((r) => ({ nombre_inspector: r.nombre, rut_inspector: r.rut, habilitado: 'S', firma_ruta: r.firma_ruta, id_inspectorambiental: r.id_leg }))],
  // Este desplegable sirve también para asignar la custodia de un equipo: además de las personas ofrece las sedes (lugares fijos donde el equipo
  // queda guardado, sin responsable). En el legado las sedes son "muestreadores" 1023–1026; en el esquema nuevo son eqp_lugar_guardado.
  getMuestreadores: async () => (await consulta(`SELECT m.id_leg, p.nombre FROM per_persona p JOIN ${leg('mae_muestreador')} m ON m.id_nuevo = p.id JOIN per_persona_rol r ON r.id_persona = p.id AND r.rol = 'MUESTREADOR' AND r.habilitado = 1 WHERE p.habilitado = 1
      UNION ALL SELECT m.id_leg, l.nombre FROM eqp_lugar_guardado l JOIN ${leg('mae_muestreador#sede')} m ON m.id_nuevo = l.id ORDER BY nombre`)).map((r) => ({ id_muestreador: r.id_leg, nombre_muestreador: r.nombre })),
  getCargos: async () => [{ id_cargo: 0, nombre_cargo: '', lab: 'S', mam: 'N', obsterreno: 'N', cliente: 'N', id_observadorterreno: '0' }, ...(await consulta(`SELECT c.*, m.id_leg,
      MAX(CASE WHEN k.nombre = 'LABORATORIO' THEN 1 ELSE 0 END) lab, MAX(CASE WHEN k.nombre = 'MEDIO_AMBIENTE' THEN 1 ELSE 0 END) mam, MAX(CASE WHEN k.nombre = 'OBSERVADOR_TERRENO' THEN 1 ELSE 0 END) obs, MAX(CASE WHEN k.nombre = 'CLIENTE' THEN 1 ELSE 0 END) cliente, COUNT(cc.id_categoria) n_cat
    FROM per_cargo c JOIN ${leg('mae_cargo')} m ON m.id_nuevo = c.id LEFT JOIN per_cargo_categoria cc ON cc.id_cargo = c.id LEFT JOIN per_categoria_cargo k ON k.id = cc.id_categoria
    GROUP BY c.id, c.nombre, c.habilitado, m.id_leg ORDER BY c.nombre`)).map((r) => ({ id_cargo: r.id_leg, nombre_cargo: r.nombre, lab: r.n_cat ? SN(r.lab) : null, mam: r.n_cat ? SN(r.mam) : null, obsterreno: r.n_cat ? SN(r.obs) : null, cliente: r.n_cat ? SN(r.cliente) : null, id_observadorterreno: r.n_cat ? String(r.id_leg) : null }))],
});

// ── Estados ─────────────────────────────────────────────────────────────────────────────────────
// El id legado del estado de muestreo coincide con fic_estado_visita.orden; el desplegable de ADL ONE omite los que se asignan solos (1 y 3)
// y los que no son visibles para ningún perfil (0 "Por asignar").
// Los estados de equipo son la lista cerrada del CHECK de eqp_equipo.estado (en el legado, mae_estado_equipo con ids 1..5).
const ESTADOS_EQUIPO = ['Operativo', 'Dado de Baja', 'En Mantención', 'En Calibración', 'Fuera de Servicio'];
Object.assign(catalogosNuevo, {
  getEstadosMuestreo: async () => (await consulta(`SELECT orden, nombre FROM fic_estado_visita WHERE habilitado = 1 AND (visible_muestreador = 1 OR visible_coordinador = 1) AND orden NOT IN (1, 3) ORDER BY orden`))
    .map((r) => ({ id_estadomuestreo: r.orden, nombre_estadomuestreo: r.nombre })),
  getEstadosEquipo: async () => ESTADOS_EQUIPO.map((nombre, i) => ({ id_estado_equipo: i + 1, nombre, activo: true })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
});
