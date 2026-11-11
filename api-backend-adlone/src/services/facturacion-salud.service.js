import sql, { getConnectionSalud, getSaludConnectionInfo } from '../config/databaseSalud.js';
import ExcelJS from 'exceljs';
import logger from '../utils/logger.js';
import {
  nombreSpPrever,
  agruparLineasPrefactura,
  textoMesFacturacion,
  redondea,
  enTrozos,
  nombreSpEmpresas,
  nombreSpCasos,
  ID_TECNICA_ATBPLEX,
  aplicaAtbplex,
  tramoDePrecioPorRango,
  mapConLimite
} from './facturacion-salud.prefactura.js';
import {
  columnaDeLista,
  esCasoDeProyecto,
  esLineaDerivada,
  tieneValorPrevio,
  cantidadYTotal,
  aplicaExcepcionViabilidad,
  resolverPrecioLinea,
  resolverPrecioProyecto,
  modalidadScreening
} from './facturacion-salud.valorizacion.js';
import * as mantencion from './facturacion-salud.mantencion.js';
import * as exportacion from './facturacion-salud.exportacion.js';
import * as consulta from './facturacion-salud.consulta.js';
import * as otrasVentas from './facturacion-salud.otrasventas.js';
import * as pdfSalud from './facturacion-salud.pdf.js';

/**
 * Catálogo oficial de los 8 Programas del Área de Salud en LaboratorioADL
 * (según fac_prefacturacion_new_v6.scx Optiongroup1, excluyendo opción 7 = Medio Ambiente)
 */
export const PROGRAMAS_SALUD = [
  {
    eligeprograma: 1,
    codigo: 'PVA',
    nombre: 'PVA (Programa Vigilancia Activa)',
    ids_programa: [1],
    es_oficial: true,
    glosa_default: 'Servicio Análisis Programa Vigilancia Activa (PVA)'
  },
  {
    eligeprograma: 2,
    codigo: 'SCREENING',
    nombre: 'Screening (Reproductores)',
    ids_programa: [2],
    es_oficial: true,
    glosa_default: 'Servicio Análisis Programa Screening Reproductores'
  },
  {
    eligeprograma: 3,
    codigo: 'CISA_PVS_SRS',
    nombre: 'Contingencia ISA - PVSalmon Chile - SRS',
    ids_programa: [5, 6, 10],
    es_oficial: true,
    glosa_default: 'Servicio Análisis Programa Vigilancia Epidemiológica (CISA / PVS / SRS)'
  },
  {
    eligeprograma: 4,
    codigo: 'SDIAG_ATV',
    nombre: 'Servicio Diagnóstico - ATV',
    ids_programa: [3, 8],
    es_oficial: false,
    soporta_ensilaje_proa: true,
    glosa_default: 'Servicio de Diagnóstico y Asistencia Técnica Veterinaria'
  },
  {
    eligeprograma: 5,
    codigo: 'ID',
    nombre: 'Investigación I+D',
    ids_programa: [4],
    es_oficial: false,
    glosa_default: 'Servicio de Análisis Investigación y Desarrollo (I+D)'
  },
  {
    eligeprograma: 6,
    codigo: 'ILAB',
    nombre: 'Investigación Laboratorio',
    ids_programa: [7],
    es_oficial: false,
    glosa_default: 'Servicio de Análisis Investigación Laboratorio'
  },
  {
    eligeprograma: 8,
    codigo: 'SAMIC',
    nombre: 'Susceptibilidad Antimicrobiano - SAMIC',
    ids_programa: [18],
    es_oficial: true,
    glosa_default: 'Servicio de Análisis Susceptibilidad Antimicrobiana (SAMIC)'
  },
  {
    eligeprograma: 9,
    codigo: 'CALIGUS',
    nombre: 'Susceptibilidad Caligus',
    ids_programa: [19],
    es_oficial: true,
    glosa_default: 'Servicio de Análisis Susceptibilidad Caligus'
  }
];

function getProgramaConfig(eligeprograma) {
  return PROGRAMAS_SALUD.find((p) => p.eligeprograma === Number(eligeprograma)) || PROGRAMAS_SALUD[3];
}

/**
 * Convierte fechas ISO (YYYY-MM-DD) o DD/MM/YYYY al formato DD/MM/YYYY usado en LaboratorioADL
 */
function toDmyString(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [y, m, d] = str.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    return str.slice(0, 10);
  }
  return str;
}

/**
 * Convierte fechas DD/MM/YYYY o ISO a YYYY-MM-DD para comparación segura en SQL
 */
function toIsoDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.slice(0, 10).split('/');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function round0(n) {
  return Math.round(Number(n) || 0);
}

class FacturacionSaludService {
  /**
   * 0. Dashboard y Maestros de Facturación Salud (Conexión Localhost)
   */
  async getDashboardSalud() {
    const pool = await getConnectionSalud();
    const connInfo = getSaludConnectionInfo();

    const query = `
      SET DATEFORMAT dmy;

      -- 1. Resumen de casos pendientes de facturar en Salud (excluyendo id_programa = 16 Medio Ambiente)
      SELECT 
        m.id_programa,
        ISNULL(mp.nombre_programa, 'Sin Programa') AS nombre_programa,
        COUNT(DISTINCT m.id_caso) AS total_casos,
        COUNT(md.item) AS total_lineas,
        SUM(ISNULL(md.vtatotal, 0)) AS uf_acumulado,
        MIN(m.FechaRecepcion) AS min_fecha_recepcion,
        MAX(m.FechaRecepcion) AS max_fecha_recepcion
      FROM dbo.muestras m
      INNER JOIN dbo.muestras_detalle md ON m.id_caso = md.id_caso
      LEFT JOIN dbo.mae_programa mp ON m.id_programa = mp.id_programa
      WHERE md.estado = 'ENVIADO'
        AND ISNULL(md.id_facturacion, 0) = 0
        AND md.clasifica IN ('CLIENTE', 'COMPLEMENT')
        AND md.id_tecnica <> 647
        AND m.id_programa IN (1, 2, 3, 4, 5, 6, 7, 8, 10, 18, 19)
      GROUP BY m.id_programa, mp.nombre_programa
      ORDER BY total_casos DESC;

      -- 2. Métricas de facturacion_enc (Pre-facturas de Casos)
      SELECT
        COUNT(*) AS total_prefacturas,
        SUM(CASE WHEN ISNULL(emitido, 'N') <> 'S' THEN 1 ELSE 0 END) AS pendientes_emision,
        SUM(CASE WHEN ISNULL(emitido, 'N') = 'S' THEN 1 ELSE 0 END) AS emitidas_dte,
        SUM(CASE WHEN ISNULL(emitido, 'N') <> 'S' THEN ISNULL(uf_totalfac, 0) ELSE 0 END) AS uf_pendiente_emision,
        MAX(uf) AS ultima_uf
      FROM dbo.facturacion_enc
      WHERE ISNULL(eliminado, 'N') <> 'S';

      -- 3. Métricas de facturacion_otro (Otras Ventas, Exentas, NC, ND)
      SELECT
        id_tipodocumento,
        COUNT(*) AS total_docs,
        SUM(CASE WHEN ISNULL(emitido, 'N') <> 'S' THEN 1 ELSE 0 END) AS pendientes_dte,
        SUM(ISNULL(monto, 0)) AS monto_total_clp,
        SUM(ISNULL(monto_uf, 0)) AS monto_total_uf
      FROM dbo.facturacion_otro
      GROUP BY id_tipodocumento;
    `;

    const result = await pool.request().query(query);
    const pendientesPorPrograma = result.recordsets[0] || [];
    const resumenPrefacturas = result.recordsets[1]?.[0] || {};
    const resumenOtros = result.recordsets[2] || [];

    const totalCasosPendientes = pendientesPorPrograma.reduce((acc, r) => acc + Number(r.total_casos || 0), 0);
    const totalLineasPendientes = pendientesPorPrograma.reduce((acc, r) => acc + Number(r.total_lineas || 0), 0);

    return {
      connection: connInfo,
      kpis: {
        totalCasosPendientes,
        totalLineasPendientes,
        prefacturasPendientesDte: Number(resumenPrefacturas.pendientes_emision || 0),
        prefacturasEmitidasDte: Number(resumenPrefacturas.emitidas_dte || 0),
        ufPendienteEmision: round2(resumenPrefacturas.uf_pendiente_emision || 0),
        ultimaUf: Number(resumenPrefacturas.ultima_uf || 38500),
      },
      pendientesPorPrograma,
      resumenOtros,
      programasSalud: PROGRAMAS_SALUD
    };
  }

  async getMaestrosSalud() {
    const pool = await getConnectionSalud();
    const result = await pool.request().query(`
      SELECT id_formapago, LTRIM(RTRIM(nombre_formapago)) AS nombre_formapago
      FROM dbo.mae_formapago
      WHERE ISNULL(habilitado, 'S') = 'S'
      ORDER BY nombre_formapago;

      SELECT id_glosa, LTRIM(RTRIM(nombre_glosa)) AS nombre_glosa
      FROM dbo.mae_glosa
      ORDER BY nombre_glosa;

      SELECT id_otrosingresos, LTRIM(RTRIM(nombre_otrosingresos)) AS nombre_otrosingresos
      FROM dbo.mae_otrosingresos
      ORDER BY nombre_otrosingresos;

      SELECT id_otrosdescuentos, LTRIM(RTRIM(nombre_otrosdescuentos)) AS nombre_otrosdescuentos
      FROM dbo.mae_otrosdescuentos
      ORDER BY nombre_otrosdescuentos;

      SELECT 
        id_empresaservicio,
        LTRIM(RTRIM(nombre_empresaservicios)) AS nombre_empresaservicios,
        LTRIM(RTRIM(rut_empresaservicios)) AS rut_empresaservicios,
        LTRIM(RTRIM(ISNULL(precio_lista, 'Precio lista'))) AS precio_lista,
        LTRIM(RTRIM(ISNULL(precio_especial, 'N'))) AS precio_especial,
        ISNULL(factor_km, 0) AS factor_km,
        LTRIM(RTRIM(ISNULL(costo_op, 'N'))) AS costo_op,
        ISNULL(id_formapago, 1) AS id_formapago,
        LTRIM(RTRIM(ISNULL(direccion_comercial, direccion_empresaservicios))) AS direccion
      FROM dbo.mae_empresaservicios
      WHERE ISNULL(habilitado, 'S') = 'S'
      ORDER BY nombre_empresaservicios;
    `);

    return {
      programas: PROGRAMAS_SALUD,
      formasPago: result.recordsets[0] || [],
      glosas: result.recordsets[1] || [],
      otrosIngresos: result.recordsets[2] || [],
      otrosDescuentos: result.recordsets[3] || [],
      empresasServicio: result.recordsets[4] || []
    };
  }

  // ==========================================================================
  // 1. PRE-FACTURACIÓN Y MOTOR DE VALORIZACIÓN DE CASOS DE SALUD
  // ==========================================================================

  /** Conexión del módulo (aislada en un método para poder probar las lecturas con otra conexión). */
  async _pool() {
    return getConnectionSalud();
  }

  /**
   * Rango de "Fecha datos a procesar" de fac_prefacturacion_new_v6. ADLSOFT lo pasa a los procedimientos de elegibilidad, que lo
   * comparan contra muestras.fecha_informe, y exige que esté (el mensaje de ADLSOFT es "Debe elegir un rango de Fechas").
   */
  _rangoSpElegibilidad({ fecha_proceso_ini, fecha_proceso_fin } = {}) {
    const ini = toDmyString(fecha_proceso_ini);
    const fin = toDmyString(fecha_proceso_fin);
    if (!ini || !fin) throw new Error('Debe elegir un rango de fechas (fecha de los datos a procesar).');
    return { ini, fin };
  }

  /**
   * Botón "Procesar" (fac_prefacturacion_new_v6.scx): empresas con datos por facturar para el programa y el rango elegidos.
   * Lo resuelve el mismo procedimiento que usa ADLSOFT. Igual que allá, la lista trae solo la empresa (una vez cada una); los
   * conteos y totales no se calculan aquí porque ADLSOFT no los muestra y obligarían a repetir la consulta por empresa.
   */
  async getEmpresasConCasosElegibles(filters = {}) {
    const { ini, fin } = this._rangoSpElegibilidad(filters);
    const sp = nombreSpEmpresas(filters.eligeprograma ?? 4, filters);
    const pool = await this._pool();

    const res = await pool.request()
      .input('fi', sql.VarChar(10), ini)
      .input('ff', sql.VarChar(10), fin)
      .query(`SET DATEFORMAT dmy; EXEC dbo.${sp} @xfechaini = @fi, @xfechafin = @ff;`);

    // El procedimiento devuelve una fila por combinación (fecha de informe, técnica…): ADLSOFT se queda con cada empresa una vez.
    const ids = [];
    const vistos = new Set();
    const soloEmpresa = filters.id_empresaservicio ? Number(filters.id_empresaservicio) : null;
    for (const r of res.recordset || []) {
      const id = Number(r.id_empresaservicio);
      if (!Number.isFinite(id) || vistos.has(id)) continue;
      if (soloEmpresa && id !== soloEmpresa) continue;
      vistos.add(id);
      ids.push(id);
    }
    if (ids.length === 0) return [];

    const empresas = [];
    for (const trozo of enTrozos(ids, 500)) {
      const r = await pool.request().query(`
        SELECT
          es.id_empresaservicio,
          LTRIM(RTRIM(ISNULL(es.rut_empresaservicios, ''))) AS rut_empresaservicios,
          LTRIM(RTRIM(es.nombre_empresaservicios)) AS nombre_empresaservicios,
          LTRIM(RTRIM(ISNULL(es.precio_lista, 'Precio lista'))) AS precio_lista,
          LTRIM(RTRIM(ISNULL(es.precio_especial, 'N'))) AS precio_especial,
          ISNULL(es.factor_km, 0) AS factor_km,
          LTRIM(RTRIM(ISNULL(es.costo_op, 'N'))) AS costo_op
        FROM dbo.mae_empresaservicios es
        WHERE es.id_empresaservicio IN (${trozo.join(',')});
      `);
      empresas.push(...(r.recordset || []));
    }
    return empresas
      .map((e) => ({ ...e, total_casos: null, total_lineas: null, uf_total_actual: null, lineas_valorizadas: null }))
      .sort((a, b) => String(a.nombre_empresaservicios).localeCompare(String(b.nombre_empresaservicios), 'es'));
  }

  /**
   * Doble clic en la empresa (fac_prefacturacion_new_v6.scx): sus casos por facturar y, por cada caso, las líneas que ADLSOFT
   * valoriza. Los casos salen del procedimiento del programa y las líneas de fac_agrupaempresacasos_uno (las mismas dos
   * consultas de ADLSOFT). Las líneas de ATBPlex (técnica 647) quedan fuera: ADLSOFT las valoriza en un paso previo aparte.
   * Lo demás (nombres, tarifas de la técnica, etc.) se agrega con lecturas simples por id.
   */
  async getCasosElegiblesPorEmpresa(filters = {}) {
    const idEmpresa = Number(filters.id_empresaservicio);
    if (!idEmpresa) throw new Error('Falta la empresa a facturar.');
    const { ini, fin } = this._rangoSpElegibilidad(filters);
    const sp = nombreSpCasos(filters.eligeprograma ?? 4, filters);
    const pool = await this._pool();

    const res = await pool.request()
      .input('es', sql.Numeric(10, 0), idEmpresa)
      .input('fi', sql.VarChar(10), ini)
      .input('ff', sql.VarChar(10), fin)
      .query(`SET DATEFORMAT dmy; EXEC dbo.${sp} @xid_empresaservicio = @es, @xfechaini = @fi, @xfechafin = @ff;`);

    const idsCasos = [];
    const casosSp = new Map();
    for (const r of res.recordset || []) {
      const id = Number(r.id_caso);
      if (!Number.isFinite(id) || casosSp.has(id)) continue;
      casosSp.set(id, r);
      idsCasos.push(id);
    }
    if (idsCasos.length === 0) return [];

    // Líneas de cada caso: el mismo procedimiento que ADLSOFT ejecuta por caso (con un máximo de consultas en paralelo).
    const lineasPorCaso = new Map();
    await mapConLimite(idsCasos, 5, async (idCaso) => {
      const r = await pool.request()
        .input('c', sql.Numeric(10, 0), idCaso)
        .query('EXEC dbo.fac_agrupaempresacasos_uno @xid_caso = @c;');
      lineasPorCaso.set(idCaso, (r.recordset || []).filter((l) => Number(l.id_tecnica) !== ID_TECNICA_ATBPLEX));
    });

    // Datos del caso que el procedimiento no trae.
    const datosCaso = new Map();
    for (const trozo of enTrozos(idsCasos, 400)) {
      const r = await pool.request().query(`
        SELECT
          m.id_caso,
          LTRIM(RTRIM(ISNULL(es.rut_empresaservicios, ''))) AS rut_empresaservicios,
          LTRIM(RTRIM(ISNULL(es.precio_lista, 'Precio lista'))) AS precio_lista,
          LTRIM(RTRIM(ISNULL(es.precio_especial, 'N'))) AS precio_especial,
          ISNULL(es.factor_km, 0) AS factor_km,
          LTRIM(RTRIM(ISNULL(es.costo_op, 'N'))) AS costo_op,
          LTRIM(RTRIM(ISNULL(emp.nombre_empresa, ''))) AS nombre_empresa,
          LTRIM(RTRIM(ISNULL(mc.nombre_centro, m.nombre_centro))) AS nombre_centro,
          ISNULL(mc.id_tipoagua, 0) AS id_tipoagua,
          LTRIM(RTRIM(ISNULL(ta.nombre_tipoagua, 'N/A'))) AS nombre_tipoagua,
          ISNULL(mc.co_fijo, 0) AS co_fijo,
          LTRIM(RTRIM(ISNULL(mc.pm_ingreso, 'N'))) AS pm_ingreso,
          LTRIM(RTRIM(ISNULL(mp.nombre_programa, m.nombre_programa))) AS nombre_programa,
          LTRIM(RTRIM(ISNULL(esp.nombre_especie, ''))) AS nombre_especie,
          LTRIM(RTRIM(ISNULL(m.cliente_entrega, 'Sin Veterinario'))) AS cliente_entrega,
          LTRIM(RTRIM(ISNULL(m.n_recepcion, ''))) AS n_recepcion,
          LTRIM(RTRIM(ISNULL(m.fecha_muestreo, ''))) AS fecha_muestreo,
          ISNULL(m.sc_ncrotaltot, 0) AS sc_ncrotaltot
        FROM dbo.muestras m
        INNER JOIN dbo.mae_empresaservicios es ON m.id_empresaservicio = es.id_empresaservicio
        LEFT JOIN dbo.mae_empresa emp ON m.id_empresa = emp.id_empresa
        LEFT JOIN dbo.mae_centro mc ON m.id_centro = mc.id_centro
        LEFT JOIN dbo.mae_tipoagua ta ON mc.id_tipoagua = ta.id_tipoagua
        LEFT JOIN dbo.mae_programa mp ON m.id_programa = mp.id_programa
        LEFT JOIN dbo.mae_especie esp ON m.id_especie = esp.id_especie
        WHERE m.id_caso IN (${trozo.join(',')});
      `);
      for (const d of r.recordset || []) datosCaso.set(Number(d.id_caso), d);
    }

    // Datos de cada línea que el procedimiento no trae: tipo de cobro, tarifas de la técnica, placas del medio y valores ya guardados.
    const datosLinea = new Map();
    for (const trozo of enTrozos(idsCasos, 400)) {
      const r = await pool.request().query(`
        SELECT
          md.id_caso,
          md.item,
          ISNULL(tec.id_tipocobro, 2) AS id_tipocobro,
          LTRIM(RTRIM(ISNULL(tc.nombre_tipocobro, 'Muestra'))) AS nombre_tipocobro,
          ISNULL(med.muestrasxplaca, 1) AS muestrasxplaca,
          ISNULL(md.uf, 0) AS uf,
          ISNULL(md.usd, 0) AS usd,
          ISNULL(md.mf, 0) AS mf,
          ISNULL(tec.precio_lista, 0) AS tec_precio_lista,
          ISNULL(tec.precio_lista_menos, 0) AS tec_precio_convenio,
          ISNULL(tec.precio_lista_mas, 0) AS tec_precio_recargo,
          ISNULL(tec.precio_lista_adl, 0) AS tec_precio_adl,
          ISNULL(tec.precio_lista_us, 0) AS tec_precio_usd,
          ISNULL(tec.vta_cal, 0) AS tec_vta_cal
        FROM dbo.muestras_detalle md
        LEFT JOIN dbo.mae_tecnica tec ON md.id_tecnica = tec.id_tecnica
        LEFT JOIN dbo.mae_tipocobro tc ON tec.id_tipocobro = tc.id_tipocobro
        LEFT JOIN dbo.mae_medios med ON md.id_medios = med.id_medios
        WHERE md.id_caso IN (${trozo.join(',')}) AND md.estado = 'ENVIADO' AND ISNULL(md.id_facturacion, 0) = 0;
      `);
      for (const d of r.recordset || []) datosLinea.set(`${Number(d.id_caso)}|${Number(d.item)}`, d);
    }

    const txt = (v) => String(v ?? '').trim();
    const casos = [];
    for (const idCaso of idsCasos) {
      const sp0 = casosSp.get(idCaso);
      const dc = datosCaso.get(idCaso) || {};
      const lineasSp = lineasPorCaso.get(idCaso) || [];
      const base = lineasSp[0] || {};
      const caso = {
        id_caso: idCaso,
        caso_adlab: txt(sp0.caso_adlab),
        id_empresaservicio: Number(sp0.id_empresaservicio ?? idEmpresa),
        nombre_empresaservicios: txt(sp0.nombre_empresaservicios),
        rut_empresaservicios: dc.rut_empresaservicios || '',
        precio_lista: dc.precio_lista || txt(sp0.precio_lista) || 'Precio lista',
        precio_especial: dc.precio_especial || txt(sp0.precio_especial) || 'N',
        factor_km: dc.factor_km ?? sp0.factor_km ?? 0,
        costo_op: dc.costo_op || txt(sp0.costo_op) || 'N',
        id_empresa: sp0.id_empresa ?? base.id_empresa,
        nombre_empresa: dc.nombre_empresa || '',
        id_centro: sp0.id_centro ?? base.id_centro,
        nombre_centro: dc.nombre_centro || '',
        id_tipoagua: dc.id_tipoagua ?? base.id_tipoagua ?? 0,
        nombre_tipoagua: dc.nombre_tipoagua || 'N/A',
        co_fijo: dc.co_fijo ?? 0,
        pm_ingreso: dc.pm_ingreso || 'N',
        id_programa: sp0.id_programa ?? base.id_programa,
        nombre_programa: dc.nombre_programa || txt(sp0.nombre_programa),
        id_especie: sp0.id_especie ?? base.id_especie,
        nombre_especie: dc.nombre_especie || '',
        id_lugaranalisis: sp0.id_lugaranalisis ?? base.id_lugaranalisis,
        id_veterinario: base.id_veterinario,
        cliente_entrega: dc.cliente_entrega || 'Sin Veterinario',
        n_recepcion: dc.n_recepcion || '',
        fecha_muestreo: dc.fecha_muestreo || txt(sp0.fecha_muestreo),
        fecha_recepcion: txt(sp0.fecha_recepcion),
        fecha_informe: txt(sp0.fecha_informe),
        estado_caso: txt(sp0.estado_caso),
        id_proyecto: base.id_proyecto ?? 0,
        ensilaje: txt(base.ensilaje) || 'N',
        proa: txt(base.proa) || 'N',
        multiplex: txt(base.multiplex) || 'N',
        apertura: txt(base.apertura) || 'N',
        sc_ncrotaltot: dc.sc_ncrotaltot ?? 0,
        ocompra: txt(base.ocompra),
        ocompra_fecha: txt(base.ocompra_fecha),
        uf_totalfac: 0,
        lineas: []
      };
      for (const l of lineasSp) {
        const dl = datosLinea.get(`${idCaso}|${Number(l.item)}`) || {};
        caso.lineas.push({
          item: l.item,
          id_tecnica: l.id_tecnica,
          nombre_tecnica: txt(l.nombre_tecnica),
          id_tipocobro: dl.id_tipocobro ?? 2,
          nombre_tipocobro: dl.nombre_tipocobro || 'Muestra',
          id_organo: l.id_organo,
          nombre_organo: txt(l.nombre_organo),
          id_medios: l.id_medios,
          nombre_medios: txt(l.nombre_medios),
          muestrasxplaca: dl.muestrasxplaca ?? 1,
          id_seccion: l.id_seccion,
          tipoingreso: txt(l.tipoingreso) || 'INDIVIDUAL',
          ind_nmuestras: Number(l.ind_nmuestras) || 0,
          pol_npooles: Number(l.pol_npooles) || 0,
          pol_npeces: Number(l.pol_npeces) || 0,
          n_analisis: Number(l.n_analisis) || 0,
          vtaunitario: Number(l.vtaunitario) || 0,
          vtatotal: Number(l.vtatotal) || 0,
          uf: dl.uf ?? 0,
          usd: dl.usd ?? 0,
          mf: dl.mf ?? 0,
          sederiva: txt(l.sederiva) || 'N',
          pack: txt(l.pack) || 'N',
          id_pack: Number(l.id_pack) || 0,
          tec_precio_lista: dl.tec_precio_lista ?? 0,
          tec_precio_convenio: dl.tec_precio_convenio ?? 0,
          tec_precio_recargo: dl.tec_precio_recargo ?? 0,
          tec_precio_adl: dl.tec_precio_adl ?? 0,
          tec_precio_usd: dl.tec_precio_usd ?? 0,
          tec_vta_cal: dl.tec_vta_cal ?? 0
        });
        caso.uf_totalfac = round2(caso.uf_totalfac + (Number(l.vtatotal) || 0));
      }
      casos.push(caso);
    }
    return casos;
  }

  /**
   * Paso previo de ATBPlex en SDiag-ATV normal (doble clic de fac_prefacturacion_new_v6.scx). Se valoriza por tramos según el total de
   * pools de la RECEPCIÓN (no del rango de fechas): fac_agrupaempresacasos_entrefechas_sd_atbplex_agrupa suma los pools por
   * recepción y técnica, consulta_listaprecio_tecnicas_porrangomuestras da los tramos y ..._sd_atbplex_detalle entrega los casos
   * de esa recepción, a cada uno de los cuales se le guarda el precio del tramo por sus pools. Escribe en muestras_detalle.
   */
  async _valorizarAtbplexPorRango(pool, { id_empresaservicio, valorUf, valorUsd }) {
    const grupos = (await pool.request()
      .input('es', sql.Numeric(10, 0), Number(id_empresaservicio))
      .query('EXEC dbo.fac_agrupaempresacasos_entrefechas_sd_atbplex_agrupa @xid_empresaservicio = @es;')).recordset || [];
    let lineas = 0;
    for (const g of grupos) {
      const tramos = (await pool.request()
        .input('es', sql.Numeric(10, 0), Number(id_empresaservicio))
        .input('tec', sql.Numeric(10, 0), Number(g.id_tecnica))
        .query('EXEC dbo.consulta_listaprecio_tecnicas_porrangomuestras @xid_empresaservicio = @es, @xid_tecnica = @tec;')).recordset || [];
      const tramo = tramoDePrecioPorRango(tramos, g.pol_npooles);
      // Si ningún tramo calza, ADLSOFT queda parado en el fin de la tabla y guarda precio 0.
      const precio = tramo ? Number(tramo.valor) || 0 : 0;
      if (!tramo) logger.warn(`[Facturación Salud] ATBPlex recepción ${g.n_recepcion}: ${g.pol_npooles} pools no calzan con ningún tramo de precio; se guarda 0.`);

      const casos = (await pool.request()
        .input('es', sql.Numeric(10, 0), Number(id_empresaservicio))
        .input('tec', sql.Numeric(10, 0), Number(g.id_tecnica))
        .input('rec', sql.VarChar(10), String(g.n_recepcion ?? ''))
        .query('EXEC dbo.fac_agrupaempresacasos_entrefechas_sd_atbplex_detalle @xid_empresaservicio = @es, @xid_tecnica = @tec, @xn_recepcion = @rec;')).recordset || [];
      for (const c of casos) {
        const pools = Number(c.pol_npooles) || 0;
        await pool.request()
          .input('precio', sql.Numeric(12, 4), precio)
          .input('n', sql.Numeric(12, 2), pools)
          .input('total', sql.Numeric(12, 3), redondea(precio * pools, 3))
          .input('uf', sql.Numeric(12, 2), valorUf)
          .input('usd', sql.Numeric(12, 2), valorUsd)
          .input('caso', sql.Numeric(10, 0), Number(c.id_caso))
          .input('tec', sql.Numeric(10, 0), Number(c.id_tecnica))
          .query(`
            UPDATE dbo.muestras_detalle
            SET vtaunitario = @precio, n_analisis = @n, vtatotal = @total, uf = @uf, usd = @usd, mf = 1
            WHERE id_caso = @caso AND estado = 'ENVIADO' AND id_tecnica = @tec AND id_facturacion = 0;
          `);
        lineas++;
      }
    }
    return { recepciones: grupos.length, lineas };
  }

  /**
   * Calcula la cantidad a cobrar (xn_analisis) según la tabla de reglas 2.6 de fac_prefacturacion_new_v6.scx
   */
  async _calcularCantidadAnalisis(pool, caso, linea) {
    const idTec = Number(linea.id_tecnica);
    const idTipoCobro = Number(linea.id_tipocobro);
    const tipoIngreso = String(linea.tipoingreso || '').trim().toUpperCase();
    const indMuestras = Number(linea.ind_nmuestras || 0);
    const polPooles = Number(linea.pol_npooles || 0);

    // Excepción Viabilidad ADLMag: siempre fuerza 1
    if (idTec === 316 || idTec === 317) {
      return 1;
    }

    switch (idTipoCobro) {
      case 0: // No Aplica (NA)
        return 0;
      case 1: // Pez
        return tipoIngreso === 'INDIVIDUAL' ? indMuestras : polPooles;
      case 2: // Muestra
      case 3: // Cada uno (C/U)
      case 5: // Tejido
      case 7: // Aislado
        return indMuestras > 0 ? indMuestras : polPooles;
      case 4: // Pool
        if (caso.multiplex === 'S' && (idTec === 958 || idTec === 959)) {
          const mpRes = await pool.request()
            .input('id_caso', sql.Numeric(10, 0), caso.id_caso)
            .query(`EXEC dbo.fac_agrupaempresacasos_uno_TotalPoolesMultiplex @xid_caso = @id_caso`);
          const maxPools = (mpRes.recordset || []).reduce((acc, r) => acc + Number(r.pol_npooles || 0), 0);
          return maxPools > 0 ? maxPools : polPooles;
        }
        return polPooles > 0 ? polPooles : indMuestras;
      case 6: { // Placa y Medio
        const mxp = Number(linea.muestrasxplaca || 1) || 1;
        const ratio = indMuestras / mxp;
        if (indMuestras <= 0) return 0;
        return ratio < 0.4 ? 1 : Math.ceil(ratio);
      }
      case 8: { // Identificación
        const idRes = await pool.request()
          .input('id_caso', sql.Numeric(10, 0), caso.id_caso)
          .query(`EXEC dbo.consulta_cuantas_identificaciones @xid_caso = @id_caso`);
        return (idRes.recordset || []).length;
      }
      default:
        return tipoIngreso === 'POOLES' ? polPooles : indMuestras;
    }
  }

  /**
   * Obtiene el precio de lista estándar o especial para una técnica según la configuración de la empresa
   */
  async _resolverPrecioBaseOLista(pool, caso, linea, valorUf, valorUsd) {
    const idEmpServ = Number(caso.id_empresaservicio);
    const idTec = Number(linea.id_tecnica);

    // Cliente en USD (ej. id_empresaservicio = 500 Benchmark Genetics)
    if (idEmpServ === 500 && Number(linea.tec_precio_usd) > 0 && valorUsd > 0 && valorUf > 0) {
      const ufEquiv = (Number(linea.tec_precio_usd) * Number(valorUsd)) / Number(valorUf);
      return { unitarioUf: round2(ufEquiv), regla: 'Lista USD (Conversión Tipo de Cambio)' };
    }

    // Regla 4: Precios Especiales / Preferenciales (lp_preferencial)
    if (String(caso.precio_especial).toUpperCase() === 'S') {
      const espRes = await pool.request()
        .input('es', sql.Numeric(10, 0), idEmpServ)
        .input('tec', sql.Numeric(10, 0), idTec)
        .query(`EXEC dbo.consulta_listaprecio_unatecnica_especial @xid_empresaservicio = @es, @xid_tecnica = @tec`);
      if (espRes.recordset?.length > 0 && Number(espRes.recordset[0].precio_especial) > 0) {
        return {
          unitarioUf: Number(espRes.recordset[0].precio_especial),
          regla: 'Precio Especial / Preferencial Cliente'
        };
      }
    }

    // Las 4 listas tarifarias base en mae_tecnica
    const tipoLista = String(caso.precio_lista || 'Precio lista').trim().toLowerCase();
    if (tipoLista.includes('convenio') || tipoLista.includes('menos')) {
      return { unitarioUf: Number(linea.tec_precio_convenio || linea.tec_precio_lista || 0), regla: 'Precio Convenio' };
    }
    if (tipoLista.includes('recargo') || tipoLista.includes('mas')) {
      return { unitarioUf: Number(linea.tec_precio_recargo || linea.tec_precio_lista || 0), regla: 'Precio Recargo' };
    }
    if (tipoLista.includes('adl')) {
      return { unitarioUf: Number(linea.tec_precio_adl || linea.tec_precio_lista || 0), regla: 'Precio ADL' };
    }
    return { unitarioUf: Number(linea.tec_precio_lista || 0), regla: 'Precio Lista Estándar' };
  }

  /**
   * Costos operacionales y de jornada que ADLSOFT agrega DESPUÉS de valorizar todos los casos (fac_prefacturacion_new_v6,
   * Command4.Click): costo operativo (técnica 282) por caso, jornada AquaGen (técnica 955) y costo fijo por centro de Mowi.
   * Cada paso actualiza solo la línea correspondiente de los casos procesados, y solo si aún no está facturada.
   */
  async _aplicarCostosOperacionales(pool, { casos, eligeprograma, id_empresaservicio, ensilaje, proa, numUf, numUsd, rango }) {
    const progNum = Number(eligeprograma);
    const vacia = (f) => !f || /^[\s/]*$/.test(String(f));
    const fx = (v) => Number(v) || 0;
    const N = sql.Numeric(10, 0);
    const resumen = { costoOperativo: 0, jornadas: 0, mowi: 0 };

    // La marca de costo operativo se reinicia en cada caso y la deja apagada un caso de Servicio Diagnóstico con PROA; la que cuenta
    // es la del último caso. Con ensilaje marcado nunca se agrega costo operativo.
    const ultimo = casos[casos.length - 1];
    const costoOperativo = !ensilaje && !(Number(ultimo.id_programa) === 3 && proa);

    const guardar282 = async (idCaso, unitario, cantidad) => {
      await pool.request()
        .input('c', N, idCaso)
        .input('v', sql.Float, unitario)
        .input('n', N, cantidad)
        .input('uf', sql.Numeric(10, 2), numUf)
        .input('usd', sql.Numeric(10, 2), numUsd)
        .query('UPDATE dbo.muestras_detalle SET vtaunitario = @v, n_analisis = @n, uf = @uf, usd = @usd, mf = 1 WHERE id_caso = @c AND id_tecnica = 282 AND id_facturacion = 0;');
    };
    const spCasosDeLaVisita = async (sp, params) => {
      const req = pool.request();
      for (const [nombre, tipo, valor] of params) req.input(nombre, tipo, valor);
      const r = await req.query(`EXEC dbo.${sp} ${params.map(([nombre]) => `@${nombre} = @${nombre}`).join(', ')};`);
      return r.recordset || [];
    };
    const F10 = sql.VarChar(10);
    const montoCo = (pl, factorKm) =>
      fx(pl.co_km) * fx(factorKm) + fx(pl.co_peaje) / numUf + fx(pl.co_transbordador) / numUf + fx(pl.co_taxi) / numUf +
      fx(pl.co_pasaje) / numUf + fx(pl.co_extra) + fx(pl.co_colacion) / numUf + fx(pl.co_alojamiento) / numUf + fx(pl.co_veterinario);

    if (costoOperativo && progNum === 2) {
      // Screening: costo operativo = crotales del caso x tarifa de la técnica 282 (pool; si es 0, individual). Con apertura no se agrega.
      for (const caso of casos) {
        if (String(caso.apertura ?? '').trim() === 'S') continue;
        const precio = await (String(caso.multiplex ?? '').trim() === 'S'
          ? this._crearRepoPrecios(pool).precioScreeningMultiplex
          : this._crearRepoPrecios(pool).precioScreening)(caso.id_empresaservicio, caso.id_empresa, caso.id_centro, caso.id_especie, 282);
        const r = precio[0] || {};
        const unitario = fx(r.uf_pool) || fx(r.uf_individual);
        const n = fx(caso.sc_ncrotaltot);
        await pool.request()
          .input('c', N, caso.id_caso)
          .input('n', N, n)
          .input('v', sql.Float, unitario)
          .input('t', sql.Float, n * unitario)
          .input('uf', sql.Numeric(10, 2), numUf)
          .input('usd', sql.Numeric(10, 2), numUsd)
          .query('UPDATE dbo.muestras_detalle SET n_analisis = @n, vtaunitario = @v, vtatotal = @t, uf = @uf, usd = @usd, mf = 1 WHERE id_caso = @c AND id_tecnica = 282 AND id_facturacion = 0;');
        resumen.costoOperativo++;
      }
    } else if (costoOperativo) {
      // Resto de programas (menos Caligus): costo de la planilla de terreno ATV repartido entre los casos de la misma visita.
      for (const caso of casos) {
        if (Number(caso.id_programa) === 9) continue;
        const sinFecha = vacia(caso.fecha_muestreo);
        const fechaPlanilla = sinFecha ? caso.fecha_recepcion : caso.fecha_muestreo;
        const planilla = await spCasosDeLaVisita(sinFecha ? 'consulta_atv_planilla_sinfacturarxcaso_cope' : 'consulta_atv_planilla_sinfacturarxcaso', [
          ['xid_empresaservicio', N, caso.id_empresaservicio], ['xid_lugaranalisis', N, caso.id_lugaranalisis],
          [sinFecha ? 'xfecha_cope' : 'xfecha_muestreo', F10, fechaPlanilla], ['xid_programa', N, caso.id_programa],
          ['xid_centro', N, caso.id_centro], ['xid_especie', N, caso.id_especie]
        ]);
        let unitario = 0;
        if (planilla.length > 0) {
          const xco = montoCo(planilla[0], caso.factor_km);
          if (xco > 0) {
            const visita = await spCasosDeLaVisita(sinFecha ? 'consulta_co_atv_cope' : 'consulta_co_atv', [
              ['xid_lugaranalisis', N, caso.id_lugaranalisis], [sinFecha ? 'xfecha_cope' : 'xfecha_muestreo', F10, fechaPlanilla],
              ['xid_programa', N, caso.id_programa], ['xid_empresaservicio', N, caso.id_empresaservicio],
              ['xid_centro', N, caso.id_centro], ['xid_especie', N, caso.id_especie]
            ]);
            unitario = xco / Math.max(1, visita.length);
          }
        }
        await guardar282(caso.id_caso, unitario, 1);
        resumen.costoOperativo++;
      }
    }

    // Jornada de muestreo de Screening para AquaGen (empresa 56): una por día en los centros 7421 y 5610 y una por día y centro en
    // los demás; se cobra en el primer caso de cada grupo.
    if (progNum === 2 && Number(id_empresaservicio) === 56) {
      const cobrarJornada = async (fila) => {
        const p = await pool.request()
          .input('es', N, fila.id_empresaservicio).input('emp', N, fila.id_empresa).input('cen', N, fila.id_centro).input('esp', N, fila.id_especie)
          .query('EXEC dbo.consulta_listaprecio_jornada_screening @xid_empresaservicio = @es, @xid_empresa = @emp, @xid_centro = @cen, @xid_especie = @esp;');
        const unitario = fx(p.recordset?.[0]?.jornada);
        await pool.request()
          .input('c', N, fila.id_caso).input('v', sql.Float, unitario).input('t', sql.Float, unitario)
          .input('uf', sql.Numeric(10, 2), numUf).input('usd', sql.Numeric(10, 2), numUsd)
          .query('UPDATE dbo.muestras_detalle SET ind_nmuestras = 1, n_analisis = 1, vtaunitario = @v, vtatotal = @t, uf = @uf, usd = @usd, mf = 1 WHERE id_caso = @c AND id_tecnica = 955 AND id_facturacion = 0;');
        resumen.jornadas++;
      };
      const leer = async (sp) => (await pool.request()
        .input('fi', F10, rango.ini).input('ff', F10, rango.fin)
        .query(`SET DATEFORMAT dmy; EXEC dbo.${sp} @xfechaini = @fi, @xfechafin = @ff;`)).recordset || [];
      // Pangueco y Sen Sen (centros 7421 y 5610): una por fecha, sin importar el centro
      let fechaAnterior = null;
      for (const fila of await leer('fac_agrupaempresacasos_entrefechas_screening_JORNADA')) {
        if (fechaAnterior !== null && fechaAnterior === fila.fecha_muestreo) continue;
        fechaAnterior = fila.fecha_muestreo;
        await cobrarJornada(fila);
      }
      // Otros centros: una por fecha y centro
      let anterior = null;
      for (const fila of await leer('fac_agrupaempresacasos_entrefechas_screening_JORNADA_otros_centros')) {
        const clave = `${fila.fecha_muestreo}|${fila.id_centro}`;
        if (clave === anterior) continue;
        anterior = clave;
        await cobrarJornada(fila);
      }
    }

    // Mowi (empresa 383): costo fijo del maestro de centro (15-09-2025). ADLSOFT recorre todos los casos pendientes de Mowi; aquí
    // solo los casos que se están valorizando.
    if (Number(id_empresaservicio) === 383) {
      const procesados = new Map(casos.map((c) => [Number(c.id_caso), c]));
      const filas = (await pool.request().query('EXEC dbo.ConsultaCasosMowiCostosFijos;')).recordset || [];
      for (const fila of filas) {
        const caso = procesados.get(Number(fila.id_caso));
        if (!caso) continue;
        const sinFecha = vacia(fila.fecha_muestreo);
        const fecha = sinFecha ? caso.fecha_recepcion : fila.fecha_muestreo;
        const planilla = await spCasosDeLaVisita(sinFecha ? 'consulta_atv_planilla_sinfacturarxcaso_cope_CostosFijo' : 'consulta_atv_planilla_sinfacturarxcaso_CostosFijo', [
          ['xid_empresaservicio', N, fila.id_empresaservicio], ['xid_lugaranalisis', N, fila.id_lugaranalisis],
          [sinFecha ? 'xfecha_cope' : 'xfecha_muestreo', F10, fecha], ['xid_programa', N, fila.id_programa], ['xid_veterinario', N, fila.id_veterinario]
        ]);
        let unitario = 0;
        if (planilla.length > 0) {
          const xco = String(fila.pm_ingreso ?? '').trim() === 'S' ? montoCo(planilla[0], caso.factor_km) : fx(fila.co_fijo) + fx(planilla[0].co_veterinario);
          if (xco > 0) {
            const visita = await spCasosDeLaVisita(sinFecha ? 'consulta_co_atv_cope_CostosFijo' : 'consulta_co_atv_CostosFijo', [
              ['xid_lugaranalisis', N, fila.id_lugaranalisis], [sinFecha ? 'xfecha_cope' : 'xfecha_muestreo', F10, fecha],
              ['xid_programa', N, fila.id_programa], ['xid_empresaservicio', N, fila.id_empresaservicio], ['xid_veterinario', N, fila.id_veterinario]
            ]);
            unitario = xco / Math.max(1, visita.length);
          }
        }
        await guardar282(fila.id_caso, unitario, 1);
        resumen.mowi++;
      }
    }
    return resumen;
  }

  /**
   * Acceso de solo lectura a los procedimientos de precios de ADLSOFT. Cada consulta se recuerda durante la valorización
   * (misma empresa/técnica/centro = misma respuesta), para no repetir cientos de llamadas iguales.
   */
  _crearRepoPrecios(pool) {
    const memo = new Map();
    const N = sql.Numeric(10, 0);
    const exec = (sp, params) => {
      const key = `${sp}|${params.map(([, , v]) => String(v)).join('|')}`;
      if (!memo.has(key)) {
        memo.set(key, (async () => {
          const req = pool.request();
          for (const [nombre, tipo, valor] of params) req.input(nombre, tipo, valor);
          const lista = params.map(([nombre]) => `@${nombre} = @${nombre}`).join(', ');
          const r = await req.query(`EXEC dbo.${sp} ${lista};`);
          return r.recordset || [];
        })());
      }
      return memo.get(key);
    };
    const p = (nombre, valor) => [nombre, N, valor];
    return {
      precioLista: (tec) => exec('consulta_listaprecio_unatecnica', [p('xid_tecnica', tec)]),
      precioEspecial: (es, tec) => exec('consulta_listaprecio_unatecnica_especial', [p('xid_empresaservicio', es), p('xid_tecnica', tec)]),
      tipoListaPva: (es) => exec('consulta_pva_tipolista', [p('xid_empresaservicio', es)]),
      precioPva: (es, tec) => exec('consulta_listaprecio_unatecnica_pva', [p('xid_empresaservicio', es), p('xid_tecnica', tec)]),
      precioPvaPorCentro: (es, tec, cen) => exec('consulta_listaprecio_unatecnica_pva_porcentro', [p('xid_empresaservicio', es), p('xid_tecnica', tec), p('xid_centro', cen)]),
      precioScreening: (es, emp, cen, esp, tec) => exec('consulta_listaprecio_unatecnica_screening', [p('xid_empresaservicio', es), p('xid_empresa', emp), p('xid_centro', cen), p('xid_especie', esp), p('xid_tecnica', tec)]),
      precioScreeningMultiplex: (es, emp, cen, esp, tec) => exec('consulta_listaprecio_unatecnica_screening_multiplex', [p('xid_empresaservicio', es), p('xid_empresa', emp), p('xid_centro', cen), p('xid_especie', esp), p('xid_tecnica', tec)]),
      precioEnsilaje: (es, emp, cen, tec) => exec('ConsultaPrecioEnsilajeUnaEmpresa', [p('xid_empresaservicio', es), p('xid_empresa', emp), p('xid_centro', cen), p('xid_tecnica', tec)]),
      costoOperativoEnsilaje: (la, fecha, es, cen) => exec('Consulta_CO_Ensalije', [p('xid_lugaranalisis', la), ['xfecha_muestreo', sql.VarChar(10), fecha], p('xid_empresaservicio', es), p('xid_centro', cen)]),
      precioProa: (es, emp, cen, tec) => exec('ConsultaPrecioProaUnaEmpresa', [p('xid_empresaservicio', es), p('xid_empresa', emp), p('xid_centro', cen), p('xid_tecnica', tec)]),
      precioPack: (pack, es, tec) => exec('consulta_listaprecio_unatecnica_pack', [p('xid_pack', pack), p('xid_empresaservicio', es), p('xid_tecnica', tec)]),
      tipoListaCisa: (es) => exec('consulta_cisa_tipolista', [p('xid_empresaservicio', es)]),
      precioCisa: (es, tec) => exec('consulta_listaprecio_unatecnica_cisa', [p('xid_empresaservicio', es), p('xid_tecnica', tec)]),
      precioCisaPorCentro: (es, tec, cen) => exec('consulta_listaprecio_unatecnica_cisa_porcentro', [p('xid_empresaservicio', es), p('xid_tecnica', tec), p('xid_centro', cen)]),
      tipoListaSrs: (es) => exec('consulta_srs_tipolista', [p('xid_empresaservicio', es)]),
      precioSrs: (es, tec) => exec('consulta_listaprecio_unatecnica_srs', [p('xid_empresaservicio', es), p('xid_tecnica', tec)]),
      precioSrsPorCentro: (es, tec, cen) => exec('consulta_listaprecio_unatecnica_srs_porcentro', [p('xid_empresaservicio', es), p('xid_tecnica', tec), p('xid_centro', cen)]),
      precioMedioAmbiente: (es, emp, cen, tabla, tec) => exec('consulta_listaprecio_unatecnica_ma', [p('xid_empresaservicio', es), p('xid_empresa', emp), p('xid_centro', cen), p('xid_tablama', tabla), p('xid_tecnica', tec)]),
      precioSamic: (es, emp, cen, tec) => exec('consulta_listaprecio_unatecnica_samic', [p('xid_empresaservicio', es), p('xid_empresa', emp), p('xid_centro', cen), p('xid_tecnica', tec)]),
      precioProyecto: (es, proy, tec) => exec('consulta_proyecto_facturar_det', [p('xid_empresaservicio', es), p('xid_proyecto', proy), p('xid_tecnica', tec)]),
      nIdentificaciones: (caso) => exec('consulta_cuantas_identificaciones', [p('xid_caso', caso)])
    };
  }

  /**
   * Motor Principal de Valorización de Casos de Salud (Réplica exacta de fac_prefacturacion_new_v6.scx Command4.Click)
   */
  async valorizarCasosSalud({
    id_empresaservicio,
    eligeprograma = 4,
    fecha_proceso_ini,
    fecha_proceso_fin,
    ensilaje = false,
    proa = false,
    valor_uf,
    valor_usd,
    uf,
    usd
  }) {
    const numUf = Number(valor_uf ?? uf);
    const numUsd = Number(valor_usd ?? usd) || 0;
    if (!numUf || numUf <= 0) {
      throw new Error('Debe ingresar el Valor de la U.F.');
    }
    if (Number(id_empresaservicio) === 500 && numUsd <= 0) {
      throw new Error('Para el cliente Benchmark Genetics (ID 500) es obligatorio ingresar el Valor USD (> 0).');
    }

    const pool = await this._pool();

    // Paso previo de ATBPlex (solo SDiag-ATV normal): se valoriza por la recepción completa, no por el rango de fechas.
    if (aplicaAtbplex(eligeprograma, { ensilaje, proa })) {
      await this._valorizarAtbplexPorRango(pool, { id_empresaservicio, valorUf: numUf, valorUsd: numUsd });
    }

    const casos = await this.getCasosElegiblesPorEmpresa({
      id_empresaservicio,
      eligeprograma,
      fecha_proceso_ini,
      fecha_proceso_fin,
      ensilaje,
      proa
    });

    if (casos.length === 0) {
      return {
        casosValorizados: 0,
        lineasValorizadas: 0,
        ufTotalGeneral: 0,
        reglasAplicadas: {},
        casos: []
      };
    }

    const progNum = Number(eligeprograma);
    const reglasAplicadas = {};
    const registrarRegla = (nombre) => {
      reglasAplicadas[nombre] = (reglasAplicadas[nombre] || 0) + 1;
    };

    let lineasValorizadasCount = 0;
    let ufTotalGeneral = 0;

    const repo = this._crearRepoPrecios(pool);
    const txtv = (v) => String(v ?? '').trim();
    let lineasConservadas = 0;
    let lineasExcluidas = 0;

    for (const caso of casos) {
      let ufTotalCaso = 0;
      const idProg = Number(caso.id_programa);
      // Lista de precios de la empresa -> columna de mae_tecnica. Con una lista distinta de las cuatro, ADLSOFT no valoriza el caso.
      const columna = columnaDeLista(caso.precio_lista);
      if (!columna) {
        logger.warn(`[Facturación Salud] Caso ${caso.caso_adlab}: la lista de precios "${caso.precio_lista}" no es ninguna de las cuatro; no se valoriza.`);
        continue;
      }
      const esProyecto = esCasoDeProyecto(caso);
      const poolOIndv = modalidadScreening(caso);

      // Screening multiplex: antes de valorizar, las técnicas 958 y 959 pasan a contar el total de pools del caso.
      if (idProg === 2 && txtv(caso.multiplex) === 'S') {
        const tp = await pool.request().input('c', sql.Numeric(10, 0), caso.id_caso).query('EXEC dbo.fac_agrupaempresacasos_uno_TotalPoolesMultiplex @xid_caso = @c;');
        const totalPools = Number(tp.recordset?.[0]?.pol_npooles) || 0;
        await pool.request()
          .input('c', sql.Numeric(10, 0), caso.id_caso)
          .input('t', sql.Numeric(10, 0), totalPools)
          .query('UPDATE dbo.muestras_detalle SET pol_npooles = @t, n_analisis = @t WHERE id_caso = @c AND (id_tecnica = 958 OR id_tecnica = 959);');
        for (const l of caso.lineas) {
          if (Number(l.id_tecnica) === 958 || Number(l.id_tecnica) === 959) { l.pol_npooles = totalPools; l.n_analisis = totalPools; }
        }
      }

      for (const linea of caso.lineas) {
        const idTec = Number(linea.id_tecnica);
        let xnAnalisis = 0;
        let xvtaUnitario = 0;
        let xvtatotal = null;
        let reglaUsada = '';

        if (esProyecto) {
          // Caso de proyecto: todas sus líneas con la tarifa del proyecto (sin tarifa = 0; no cae a la lista)
          const precio = await resolverPrecioProyecto({ caso, linea }, repo);
          const nIdent = precio.idTipoCobro === 8 ? ((await repo.nIdentificaciones(caso.id_caso)) || []).length : 0;
          const r = cantidadYTotal({ idTipoCobro: precio.idTipoCobro, linea, caso, xvta: precio.xvta, variante: 'proyecto', nIdentificaciones: nIdent });
          xnAnalisis = r.nAnalisis; xvtaUnitario = r.vtaUnitario; xvtatotal = r.vtaTotal; reglaUsada = precio.regla;
        } else if (esLineaDerivada(caso, linea)) {
          // Derivaciones y secciones 10/13: no se valorizan de nuevo. Con valor previo entran a la factura; sin él, quedan fuera.
          const conserva = tieneValorPrevio(linea);
          await pool.request()
            .input('c', sql.Numeric(10, 0), caso.id_caso)
            .input('item', sql.Numeric(10, 0), linea.item)
            .input('uf', sql.Numeric(10, 2), numUf)
            .input('usd', sql.Numeric(10, 2), numUsd)
            .input('mf', sql.Numeric(1, 0), conserva ? 1 : 0)
            .query('UPDATE dbo.muestras_detalle SET uf = @uf, usd = @usd, mf = @mf WHERE id_caso = @c AND item = @item AND id_facturacion = 0;');
          linea.uf = numUf; linea.usd = numUsd; linea.mf = conserva ? 1 : 0;
          if (conserva) {
            lineasConservadas++;
            linea.regla_aplicada = 'Derivación / sección con valor previo (se conserva)';
            ufTotalCaso = round2(ufTotalCaso + Number(linea.vtatotal || 0));
            registrarRegla(linea.regla_aplicada);
          } else {
            lineasExcluidas++;
            linea.regla_aplicada = 'Derivación / sección sin valor previo (queda fuera de la factura)';
            registrarRegla(linea.regla_aplicada);
          }
          continue;
        }
        else {
          const precio = await resolverPrecioLinea({ caso, linea, columna, poolOIndv }, repo);
          const nIdent = precio.idTipoCobro === 8 ? ((await repo.nIdentificaciones(caso.id_caso)) || []).length : 0;
          let r = cantidadYTotal({ idTipoCobro: precio.idTipoCobro, linea, caso, xvta: precio.xvta, nIdentificaciones: nIdent });
          r = aplicaExcepcionViabilidad(idTec, r);
          xnAnalisis = r.nAnalisis; xvtaUnitario = r.vtaUnitario; xvtatotal = r.vtaTotal; reglaUsada = precio.regla;
        }

        if (xvtatotal === null) xvtatotal = round2(xnAnalisis * xvtaUnitario);
        registrarRegla(reglaUsada);

        // Se guarda la valorización de la línea (igual que ADLSOFT: por caso e ítem, sin tocar `valorizado`)
        await pool.request()
          .input('c', sql.Numeric(10, 0), caso.id_caso)
          .input('item', sql.Numeric(10, 0), linea.item)
          .input('n', sql.Numeric(10, 0), xnAnalisis)
          .input('vta', sql.Numeric(10, 3), xvtaUnitario)
          .input('total', sql.Numeric(10, 3), xvtatotal)
          .input('uf', sql.Numeric(10, 2), numUf)
          .input('usd', sql.Numeric(10, 2), numUsd)
          .query(`
            UPDATE dbo.muestras_detalle
            SET vtaunitario = @vta, n_analisis = @n, vtatotal = @total, uf = @uf, usd = @usd, mf = 1
            WHERE id_caso = @c AND item = @item AND id_facturacion = 0;
          `);

        linea.n_analisis = xnAnalisis;
        linea.vtaunitario = xvtaUnitario;
        linea.vtatotal = xvtatotal;
        linea.uf = numUf;
        linea.usd = numUsd;
        linea.mf = 1;
        linea.regla_aplicada = reglaUsada;

        ufTotalCaso = round2(ufTotalCaso + xvtatotal);
        lineasValorizadasCount++;
      }

      caso.uf_totalfac = ufTotalCaso;
    }

    // Costos operacionales, jornada y costo fijo (después de valorizar todos los casos, como en ADLSOFT)
    const costosAgregados = await this._aplicarCostosOperacionales(pool, {
      casos, eligeprograma, id_empresaservicio, ensilaje, proa, numUf, numUsd, rango: this._rangoSpPrefactura({ fecha_proceso_ini, fecha_proceso_fin })
    });
    if (costosAgregados.costoOperativo) registrarRegla('Costo operativo agregado');
    if (costosAgregados.jornadas) registrarRegla('Jornada de muestreo agregada');
    if (costosAgregados.mowi) registrarRegla('Costo fijo Mowi agregado');

    // Cierre de la valorización (igual que ADLSOFT, caso por caso): líneas de las técnicas multiplex 958/959 que quedaron con la
    // cantidad en pools o en análisis sin completar, total de todas las líneas abiertas, marca mf de las líneas ya valorizadas
    // (valorizado = 'S') y total del caso en muestras.uf_totalfac.
    ufTotalGeneral = 0;
    for (const caso of casos) {
      await pool.request().input('c', sql.Numeric(10, 0), caso.id_caso)
        .query('UPDATE dbo.muestras_detalle SET n_analisis = pol_npooles, vtatotal = pol_npooles * vtaunitario WHERE id_caso = @c AND id_facturacion = 0 AND mf = 1 AND (id_tecnica = 958 OR id_tecnica = 959);');
      const mpl = await pool.request().input('c', sql.Numeric(10, 0), caso.id_caso)
        .query('SELECT id_tecnica, pol_npooles, n_analisis, vtaunitario FROM dbo.muestras_detalle WHERE id_caso = @c AND id_facturacion = 0 AND (id_tecnica = 958 OR id_tecnica = 959);');
      for (const m of mpl.recordset || []) {
        const pol = Number(m.pol_npooles) || 0;
        const n = Number(m.n_analisis) || 0;
        const vta = Number(m.vtaunitario) || 0;
        if (pol === 0) {
          await pool.request().input('c', sql.Numeric(10, 0), caso.id_caso).input('t', sql.Numeric(10, 0), m.id_tecnica)
            .input('p', sql.Numeric(10, 0), n).input('v', sql.Numeric(10, 3), redondea(n * vta, 3))
            .query('UPDATE dbo.muestras_detalle SET pol_npooles = @p, vtatotal = @v, mf = 1 WHERE id_caso = @c AND id_tecnica = @t AND id_facturacion = 0;');
        } else if (n === 0) {
          await pool.request().input('c', sql.Numeric(10, 0), caso.id_caso).input('t', sql.Numeric(10, 0), m.id_tecnica)
            .input('n', sql.Numeric(10, 0), pol).input('v', sql.Numeric(10, 3), redondea(pol * vta, 3))
            .query('UPDATE dbo.muestras_detalle SET n_analisis = @n, vtatotal = @v, mf = 1 WHERE id_caso = @c AND id_tecnica = @t AND id_facturacion = 0;');
        }
      }
      await pool.request()
        .input('c', sql.Numeric(10, 0), caso.id_caso)
        .input('uf', sql.Numeric(10, 2), numUf)
        .input('usd', sql.Numeric(10, 2), numUsd)
        .query(`
          UPDATE dbo.muestras_detalle SET uf = @uf, usd = @usd, vtatotal = n_analisis * vtaunitario WHERE id_caso = @c AND id_facturacion = 0;
          UPDATE dbo.muestras_detalle SET mf = 1 WHERE id_caso = @c AND id_facturacion = 0 AND valorizado = 'S';
        `);
      const abiertas = await pool.request().input('c', sql.Numeric(10, 0), caso.id_caso).query('EXEC dbo.fac_agrupaempresacasos_uno @xid_caso = @c;');
      const totalCaso = redondea((abiertas.recordset || []).reduce((a, l) => a + (Number(l.vtatotal) || 0), 0), 3);
      await pool.request().input('c', sql.Numeric(10, 0), caso.id_caso).input('t', sql.Numeric(10, 3), totalCaso)
        .query('UPDATE dbo.muestras SET uf_totalfac = @t WHERE id_caso = @c;');
      caso.uf_totalfac = totalCaso;
      ufTotalGeneral = round2(ufTotalGeneral + totalCaso);
    }

    return {
      casosValorizados: casos.length,
      lineasValorizadas: lineasValorizadasCount,
      ufTotalGeneral,
      reglasAplicadas,
      casos
    };
  }

  /**
   * Ajuste Manual de Precio Unitario Caso a Caso (Réplica de fac_agrupaempresacasos_uno_new.scx)
   */
  async actualizarLineaCasoManual({ id_caso, item, id_tecnica, n_analisis, vtaunitario }) {
    const pool = await getConnectionSalud();
    const cant = Number(n_analisis || 0);
    const unit = Number(vtaunitario || 0);
    const total = round2(cant * unit);

    await pool.request()
      .input('id_caso', sql.Numeric(10, 0), Number(id_caso))
      .input('item', sql.Numeric(10, 0), Number(item))
      .input('id_tecnica', sql.Numeric(10, 0), Number(id_tecnica))
      .input('n_analisis', sql.Numeric(10, 2), cant)
      .input('vtaunitario', sql.Numeric(12, 4), unit)
      .input('vtatotal', sql.Numeric(12, 2), total)
      .query(`
        UPDATE dbo.muestras_detalle
        SET n_analisis = @n_analisis,
            vtaunitario = @vtaunitario,
            vtatotal = @vtatotal,
            mf = 1,
            valorizado = 'S'
        WHERE id_caso = @id_caso AND item = @item AND id_tecnica = @id_tecnica;
      `);

    const sumRes = await pool.request()
      .input('id_caso', sql.Numeric(10, 0), Number(id_caso))
      .query(`
        SELECT SUM(ISNULL(vtatotal, 0)) AS nuevo_total
        FROM dbo.muestras_detalle
        WHERE id_caso = @id_caso AND clasifica IN ('CLIENTE', 'COMPLEMENT') AND ISNULL(id_facturacion, 0) = 0;
      `);

    const nuevoTotalCaso = round2(sumRes.recordset?.[0]?.nuevo_total || 0);

    await pool.request()
      .input('id_caso', sql.Numeric(10, 0), Number(id_caso))
      .input('uf_total', sql.Numeric(12, 2), nuevoTotalCaso)
      .query(`
        UPDATE dbo.muestras
        SET uf_totalcaso = @uf_total,
            uf_totalfac = @uf_total
        WHERE id_caso = @id_caso;
      `);

    return {
      id_caso: Number(id_caso),
      item: Number(item),
      n_analisis: cant,
      vtaunitario: unit,
      vtatotal: total,
      uf_totalfac_caso: nuevoTotalCaso
    };
  }

  /**
   * Rango de fechas que ADLSOFT pasa a los procedimientos de pre-visualización ("Fecha datos a procesar"). Esos procedimientos
   * comparan contra muestras.fecha_informe. Como los casos a facturar ya vienen marcados, si no se indica rango se usa uno amplio.
   */
  _rangoSpPrefactura({ fecha_proceso_ini, fecha_proceso_fin } = {}) {
    return {
      ini: toDmyString(fecha_proceso_ini) || '01/01/2000',
      fin: toDmyString(fecha_proceso_fin) || '31/12/2099'
    };
  }

  /** Ejecuta el procedimiento de pre-visualización de ADLSOFT (solo lectura) y devuelve sus líneas. */
  async _leerLineasPreVer(ejecutor, { id_empresaservicio, eligeprograma, criterio, ini, fin }) {
    const sp = nombreSpPrever(eligeprograma, criterio);
    const res = await new sql.Request(ejecutor)
      .input('es', sql.Numeric(10, 0), Number(id_empresaservicio))
      .input('fi', sql.VarChar(10), ini)
      .input('ff', sql.VarChar(10), fin)
      .query(`SET DATEFORMAT dmy; EXEC dbo.${sp} @xid_empresaservicio = @es, @xfechaini = @fi, @xfechafin = @ff;`);
    return res.recordset || [];
  }

  /**
   * "Pre-ver Facturación" (fac_unaempresa_v4.scx): muestra en qué pre-facturas quedarían los casos marcados, con los N° de
   * facturación que recibirían. No escribe nada: los N° son provisorios (Mae_id + 1, +2…) hasta que se crea la factura.
   */
  async previsualizarPrefacturasSalud({
    id_empresaservicio,
    eligeprograma = 4,
    criterio_agrupacion = 'Na',
    casos_ids = [],
    fecha_proceso_ini = '',
    fecha_proceso_fin = ''
  }) {
    const cleanIds = (casos_ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (cleanIds.length === 0) throw new Error('Debe marcar al menos un caso valorizado.');

    const pool = await this._pool();
    const { ini, fin } = this._rangoSpPrefactura({ fecha_proceso_ini, fecha_proceso_fin });
    const mae = await pool.request().query('SELECT TOP 1 id_facturacion FROM dbo.Mae_id');
    const idBase = Number(mae.recordset?.[0]?.id_facturacion);
    if (!Number.isFinite(idBase)) throw new Error('No se pudo leer el contador de facturación (Mae_id).');

    const lineas = await this._leerLineasPreVer(pool, { id_empresaservicio, eligeprograma, criterio: criterio_agrupacion, ini, fin });
    const { grupos, lineas: asignadas } = agruparLineasPrefactura(lineas, criterio_agrupacion, cleanIds, idBase);
    return {
      criterio_agrupacion,
      ids_provisorios: true,
      total_lineas: asignadas.length,
      uf_total: redondea(grupos.reduce((a, g) => a + g.uf_total, 0), 2),
      grupos
    };
  }

  /**
   * "Facturar" (fac_unaempresa_v4.scx): crea las pre-facturas de los casos marcados. Réplica del orden de ADLSOFT:
   *  1. lee Mae_id.id_facturacion y arma los grupos con el procedimiento de pre-visualización;
   *  2. marca las líneas valorizadas (mf = 1) con su N° de facturación y mf = 3;
   *  3. fac_creandofacturas_enc / _det agregan lo marcado (mf = 3);
   *  4. inserta facturacion_enc (factura = 0, emitido vacío, mf = 1) y las OC/HES de cada pre-factura;
   *  5. Mae_id.id_facturacion = MAX(facturacion_enc) + 1;
   *  6. inserta facturacion_det (una fila por LÍNEA de análisis) y deja las líneas en estado FACTURADO, mf = 0.
   * Único añadido respecto de ADLSOFT: todo corre en una transacción, así un fallo a medias no deja líneas atrapadas en mf = 3.
   *
   * ordenes_compra: [{ ocompra, ocompra_fecha, referencia, tipo: 'OC'|'HES', orden, id_facturacion? }]. Sin id_facturacion, la
   * referencia se asocia a todas las pre-facturas creadas (en ADLSOFT se tecleaban contra el N° de la pre-visualización).
   */
  async crearPrefacturasSalud({
    id_empresaservicio,
    eligeprograma = 4,
    criterio_agrupacion = 'Na',
    casos_ids = [],
    fecha_facturacion,
    id_formapago,
    id_glosa,
    glosa = '',
    observaciones = '',
    nota = '',
    mes = '',
    ano = '',
    fecha_proceso_ini = '',
    fecha_proceso_fin = '',
    fecha_informe_ini = '',
    fecha_informe_fin = '',
    ordenes_compra = [],
    // Campos antiguos del formulario (una OC y una HES): se convierten en ordenes_compra.
    ocompra = '',
    ocompra_fecha = '',
    referencia_oc = '',
    hes = '',
    hes_fecha = '',
    referencia_hes = ''
  }) {
    const cleanIds = (casos_ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (cleanIds.length === 0) {
      throw new Error('Debe seleccionar al menos un caso valorizado para crear prefacturas.');
    }
    if (!Number(id_empresaservicio)) throw new Error('Falta la empresa a facturar.');
    const fechaFacDmy = toDmyString(fecha_facturacion);
    if (!fechaFacDmy) throw new Error('Debe ingresar la Fecha de Facturación.');
    if (!(Number(id_formapago) > 0)) throw new Error('Debe elegir la forma de pago.');
    if (!(Number(id_glosa) > 0)) throw new Error('Debe elegir la glosa de la factura electrónica.');

    const progConfig = getProgramaConfig(eligeprograma);
    const { ini, fin } = this._rangoSpPrefactura({ fecha_proceso_ini, fecha_proceso_fin });
    // Validar la combinación programa/criterio antes de abrir la transacción.
    nombreSpPrever(eligeprograma, criterio_agrupacion);

    const referencias = [...(ordenes_compra || [])];
    if (String(ocompra || '').trim()) {
      referencias.push({ tipo: 'OC', ocompra, ocompra_fecha, referencia: referencia_oc });
    }
    if (String(hes || '').trim()) {
      referencias.push({ tipo: 'HES', ocompra: hes, ocompra_fecha: hes_fecha, referencia: referencia_hes });
    }

    const pool = await this._pool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // 1. Contador y grupos. UPDLOCK evita que dos usuarios tomen la misma numeración.
      const mae = await new sql.Request(tx).query('SELECT TOP 1 id_facturacion FROM dbo.Mae_id WITH (UPDLOCK, HOLDLOCK)');
      const idBase = Number(mae.recordset?.[0]?.id_facturacion);
      if (!Number.isFinite(idBase)) throw new Error('No se pudo leer el contador de facturación (Mae_id).');

      const lineasSp = await this._leerLineasPreVer(tx, { id_empresaservicio, eligeprograma, criterio: criterio_agrupacion, ini, fin });
      const { grupos, lineas } = agruparLineasPrefactura(lineasSp, criterio_agrupacion, cleanIds, idBase);
      if (lineas.length === 0) {
        throw new Error('Los casos seleccionados no tienen líneas valorizadas pendientes de facturar (valoriza de nuevo, o revisa el rango de fechas de informe).');
      }
      const idsNuestros = new Set(grupos.map((g) => g.id_facturacion));

      // 2. Marcar las líneas valorizadas (mf = 1) con su N° de facturación y mf = 3.
      for (const trozo of enTrozos(lineas, 400)) {
        const valores = trozo.map((l) => `(${l.id_facturacion},${l.id_caso},${l.id_tecnica},${l.item})`).join(',');
        await new sql.Request(tx).query(`
          UPDATE md
          SET md.id_facturacion = v.idf, md.mf = 3
          FROM dbo.muestras_detalle md
          INNER JOIN (VALUES ${valores}) AS v (idf, idc, idt, itm)
            ON md.id_caso = v.idc AND md.id_tecnica = v.idt AND md.item = v.itm
          WHERE md.mf = 1;
        `);
      }

      // 3. Lo marcado (mf = 3) lo agregan los procedimientos de ADLSOFT.
      const encRes = await new sql.Request(tx).query('EXEC dbo.fac_creandofacturas_enc');
      const detRes = await new sql.Request(tx).query('EXEC dbo.fac_creandofacturas_det');
      const encTodas = encRes.recordset || [];
      const encRows = encTodas
        .filter((r) => idsNuestros.has(Number(r.id_facturacion)))
        .sort((a, b) => Number(a.id_facturacion) - Number(b.id_facturacion));
      if (encTodas.length !== encRows.length) {
        logger.warn(`[Facturación Salud] Había ${encTodas.length - encRows.length} pre-factura(s) ajena(s) con líneas en mf = 3 (de otra sesión o de un proceso interrumpido); no se tocan.`);
      }
      if (encRows.length !== grupos.length) {
        throw new Error('Las líneas de una misma pre-factura quedaron con valores de UF distintos (se valorizaron en momentos distintos). Valoriza de nuevo los casos y reintenta.');
      }

      // 4. Encabezados (como ADLSOFT: factura = 0, emitido vacío, mf = 1) y sus OC/HES.
      const mesTxt = textoMesFacturacion(mes, ano, fechaFacDmy);
      const glosaFinal = (String(glosa || '').trim() || progConfig.glosa_default).slice(0, 500);
      const creadas = [];
      for (const r of encRows) {
        const idFac = Number(r.id_facturacion);
        const ufTotal = redondea(r.uf_totalfac, 2);
        const uf = Number(r.uf) || 0;
        const usd = Number(r.usd) || 0;
        const pesoTotal = redondea(ufTotal * uf, 0);
        // El valor en USD solo se calcula para Benchmark Genetics (empresa 500), como en ADLSOFT.
        const usdTotal = Number(r.id_empresaservicio) === 500 && usd > 0 ? redondea(pesoTotal / redondea(usd, 2), 2) : 0;
        const grupo = grupos.find((g) => g.id_facturacion === idFac);

        await new sql.Request(tx)
          .input('id_facturacion', sql.Numeric(10, 0), idFac)
          .input('id_empresaservicio', sql.Numeric(10, 0), Number(r.id_empresaservicio))
          .input('fecha_facturacion', sql.VarChar(10), fechaFacDmy)
          .input('uf_totalcaso', sql.Numeric(10, 3), ufTotal)
          .input('uf_totalfac', sql.Numeric(10, 3), ufTotal)
          .input('uf', sql.Numeric(10, 3), uf)
          .input('facturado_por', sql.VarChar(50), String(criterio_agrupacion).slice(0, 50))
          .input('fecha_proceso_ini', sql.VarChar(10), toDmyString(fecha_proceso_ini) || ini)
          .input('fecha_proceso_fin', sql.VarChar(10), toDmyString(fecha_proceso_fin) || fin)
          .input('fecha_informe_ini', sql.VarChar(10), toDmyString(fecha_informe_ini))
          .input('fecha_informe_fin', sql.VarChar(10), toDmyString(fecha_informe_fin))
          .input('peso_totalfac', sql.Numeric(10, 0), pesoTotal)
          .input('id_formapago', sql.Numeric(10, 0), Number(id_formapago))
          .input('mes', sql.VarChar(20), mesTxt)
          .input('id_glosa', sql.Numeric(10, 0), Number(id_glosa))
          .input('observaciones', sql.VarChar(500), String(observaciones || '').trim().slice(0, 500))
          .input('glosa', sql.VarChar(500), glosaFinal)
          .input('nota', sql.VarChar(500), String(nota || '').trim().slice(0, 500))
          .input('usd', sql.Numeric(10, 2), usd)
          .input('usd_totalfac', sql.Numeric(10, 2), usdTotal)
          .query(`
            INSERT INTO dbo.facturacion_enc (
              id_facturacion, id_empresaservicio, fecha_facturacion, uf_totalotrosing, uf_totalotrosdes, uf_totalcaso, uf_totalfac,
              uf, mf, facturado_por, fecha_proceso_ini, fecha_proceso_fin, factura, fecha_informe_ini, fecha_informe_fin,
              peso_totalfac, id_formapago, mes, id_glosa, observaciones, glosa, emitido, ocompra, ocompra_fecha, nota, usd, usd_totalfac
            ) VALUES (
              @id_facturacion, @id_empresaservicio, @fecha_facturacion, 0, 0, @uf_totalcaso, @uf_totalfac,
              @uf, 1, @facturado_por, @fecha_proceso_ini, @fecha_proceso_fin, 0, @fecha_informe_ini, @fecha_informe_fin,
              @peso_totalfac, @id_formapago, @mes, @id_glosa, @observaciones, @glosa, '', '', '', @nota, @usd, @usd_totalfac
            );
          `);

        creadas.push({
          id_facturacion: idFac,
          grupo: grupo?.etiqueta || '',
          total_casos: grupo?.total_casos || 0,
          total_lineas: grupo?.total_lineas || 0,
          uf_totalfac: ufTotal,
          peso_totalfac: pesoTotal
        });
      }

      for (const ref of referencias) {
        const numero = String(ref?.ocompra ?? '').trim();
        if (!numero) continue;
        const tipo = String(ref.tipo || 'OC').trim().toUpperCase() === 'HES' ? 'HES' : 'OC';
        const destino = ref.id_facturacion != null && ref.id_facturacion !== ''
          ? [Number(ref.id_facturacion)]
          : creadas.map((c) => c.id_facturacion);
        for (const idDestino of destino) {
          if (!idsNuestros.has(idDestino)) throw new Error(`La referencia ${numero} apunta a la pre-factura ${idDestino}, que no es una de las que se están creando.`);
          await new sql.Request(tx)
            .input('ocompra', sql.VarChar(50), numero.slice(0, 50))
            .input('ocompra_fecha', sql.VarChar(10), toDmyString(ref.ocompra_fecha))
            .input('referencia', sql.VarChar(50), String(ref.referencia || '').trim().slice(0, 50))
            .input('id_facturacion', sql.Numeric(10, 0), idDestino)
            .input('tipo', sql.VarChar(10), tipo)
            .input('orden', sql.Numeric(10, 0), Number(ref.orden) || (tipo === 'HES' ? 2 : 1))
            .query(`
              INSERT INTO dbo.facturacion_ocompra (ocompra, ocompra_fecha, referencia, id_facturacion, tipo, orden)
              VALUES (@ocompra, @ocompra_fecha, @referencia, @id_facturacion, @tipo, @orden);
            `);
        }
      }

      // 5. El contador queda en MAX(facturacion_enc) + 1 (facturacion_ultimoid + 1).
      const ultimo = await new sql.Request(tx).query('EXEC dbo.facturacion_ultimoid');
      const siguiente = Number(ultimo.recordset?.[0]?.id_facturacion) + 1;
      if (!Number.isFinite(siguiente)) throw new Error('No se pudo leer el último N° de facturación.');
      await new sql.Request(tx).input('n', sql.Numeric(10, 0), siguiente).query('UPDATE dbo.Mae_id SET id_facturacion = @n;');

      // 6. Detalle: una fila por línea de análisis. Las líneas pasan a FACTURADO y se libera la marca mf.
      const detRows = (detRes.recordset || []).filter((d) => idsNuestros.has(Number(d.id_facturacion)));
      for (const trozo of enTrozos(detRows, 400)) {
        const valores = trozo.map((d) => {
          const vt = Number(d.vtatotal);
          if (![d.id_facturacion, d.id_caso, d.item, vt].every((x) => Number.isFinite(Number(x)))) {
            throw new Error('Una línea del detalle de la factura tiene datos no numéricos.');
          }
          return `(${Number(d.id_facturacion)},${Number(d.id_caso)},${Number(d.item)},${vt})`;
        }).join(',');
        await new sql.Request(tx).query(`
          INSERT INTO dbo.facturacion_det (id_facturacion, id_caso, item, vtatotal) VALUES ${valores};
        `);
      }
      await new sql.Request(tx).query(`
        UPDATE dbo.muestras_detalle SET mf = 0, estado = 'FACTURADO'
        WHERE mf = 3 AND id_facturacion IN (${[...idsNuestros].join(',')});
      `);

      await tx.commit();
      return {
        total_prefacturas_creadas: creadas.length,
        total_lineas: detRows.length,
        prefacturas: creadas
      };
    } catch (error) {
      try { await tx.rollback(); } catch (e) { logger.error('[Facturación Salud] No se pudo revertir la transacción de creación:', e.message); }
      throw error;
    }
  }

  // ==========================================================================
  // 2. BANDEJA DE PRE-FACTURAS DE CASOS, OI/OD, OC/HES, EXCEL Y REPROCESO
  // ==========================================================================

  async listarPrefacturasSalud({ emitido = 'ALL', id_empresaservicio = null, busqueda = '', limite = 300 } = {}) {
    const pool = await getConnectionSalud();
    const request = pool.request();
    const conds = [`ISNULL(fe.eliminado, 'N') <> 'S'`];

    if (emitido === 'N') {
      conds.push(`ISNULL(fe.emitido, 'N') <> 'S'`);
    } else if (emitido === 'S') {
      conds.push(`fe.emitido = 'S'`);
    }

    if (id_empresaservicio && Number(id_empresaservicio) > 0) {
      request.input('id_empresaservicio', sql.Numeric(10, 0), Number(id_empresaservicio));
      conds.push(`fe.id_empresaservicio = @id_empresaservicio`);
    }

    if (busqueda && String(busqueda).trim() !== '') {
      request.input('q', sql.VarChar(100), `%${String(busqueda).trim()}%`);
      conds.push(`(
        CAST(fe.id_facturacion AS VARCHAR(20)) LIKE @q
        OR CAST(fe.factura AS VARCHAR(20)) LIKE @q
        OR es.nombre_empresaservicios LIKE @q
        OR es.rut_empresaservicios LIKE @q
        OR fe.glosa LIKE @q
        OR fe.ocompra LIKE @q
      )`);
    }

    const topN = Math.min(Math.max(Number(limite) || 300, 10), 2000);
    const query = `
      SELECT TOP (${topN})
        fe.id_facturacion,
        fe.factura,
        fe.id_empresaservicio,
        LTRIM(RTRIM(ISNULL(es.nombre_empresaservicios, ''))) AS nombre_empresaservicios,
        LTRIM(RTRIM(ISNULL(es.rut_empresaservicios, ''))) AS rut_empresaservicios,
        LTRIM(RTRIM(ISNULL(fe.fecha_facturacion, ''))) AS fecha_facturacion,
        ISNULL(fe.uf_totalcaso, 0) AS uf_totalcaso,
        ISNULL(fe.uf_totalotrosing, 0) AS uf_totalotrosing,
        ISNULL(fe.uf_totalotrosdes, 0) AS uf_totalotrosdes,
        ISNULL(fe.uf_totalfac, 0) AS uf_totalfac,
        ISNULL(fe.uf, 0) AS uf,
        ISNULL(fe.usd, 0) AS usd,
        ISNULL(fe.peso_totalfac, ROUND(ISNULL(fe.uf_totalfac, 0) * ISNULL(fe.uf, 0), 0)) AS peso_totalfac,
        LTRIM(RTRIM(ISNULL(fe.facturado_por, 'Na'))) AS facturado_por,
        LTRIM(RTRIM(ISNULL(fe.glosa, ''))) AS glosa,
        LTRIM(RTRIM(ISNULL(fe.observaciones, ''))) AS observaciones,
        LTRIM(RTRIM(ISNULL(fe.nota, ''))) AS nota,
        LTRIM(RTRIM(ISNULL(fe.emitido, 'N'))) AS emitido,
        LTRIM(RTRIM(ISNULL(fe.ocompra, ''))) AS ocompra,
        LTRIM(RTRIM(ISNULL(fe.ocompra_fecha, ''))) AS ocompra_fecha,
        ISNULL(fe.id_formapago, 1) AS id_formapago,
        LTRIM(RTRIM(ISNULL(fp.nombre_formapago, ''))) AS nombre_formapago,
        ISNULL(fe.id_glosa, 1) AS id_glosa,
        (SELECT COUNT(DISTINCT fd.id_caso) FROM dbo.facturacion_det fd WHERE fd.id_facturacion = fe.id_facturacion) AS total_casos
      FROM dbo.facturacion_enc fe
      LEFT JOIN dbo.mae_empresaservicios es ON fe.id_empresaservicio = es.id_empresaservicio
      LEFT JOIN dbo.mae_formapago fp ON fe.id_formapago = fp.id_formapago
      WHERE ${conds.join(' AND ')}
      ORDER BY fe.id_facturacion DESC;
    `;

    const res = await request.query(query);
    return res.recordset || [];
  }

  async getPrefacturaSaludDetalle(id_facturacion) {
    const pool = await getConnectionSalud();
    const idFac = Number(id_facturacion);

    const result = await pool.request()
      .input('id_facturacion', sql.Numeric(10, 0), idFac)
      .query(`
        -- 1. Encabezado
        SELECT
          fe.*,
          LTRIM(RTRIM(ISNULL(es.nombre_empresaservicios, ''))) AS nombre_empresaservicios,
          LTRIM(RTRIM(ISNULL(es.rut_empresaservicios, ''))) AS rut_empresaservicios,
          LTRIM(RTRIM(ISNULL(es.direccion_comercial, es.direccion_empresaservicios))) AS direccion_cliente,
          LTRIM(RTRIM(ISNULL(fp.nombre_formapago, ''))) AS nombre_formapago
        FROM dbo.facturacion_enc fe
        LEFT JOIN dbo.mae_empresaservicios es ON fe.id_empresaservicio = es.id_empresaservicio
        LEFT JOIN dbo.mae_formapago fp ON fe.id_formapago = fp.id_formapago
        WHERE fe.id_facturacion = @id_facturacion;

        -- 2. Casos asociados
        SELECT
          m.id_caso,
          LTRIM(RTRIM(m.caso_adlab)) AS caso_adlab,
          LTRIM(RTRIM(ISNULL(m.fecha_recepcion, ''))) AS fecha_recepcion,
          LTRIM(RTRIM(ISNULL(m.fecha_muestreo, ''))) AS fecha_muestreo,
          LTRIM(RTRIM(ISNULL(m.fecha_informe, ''))) AS fecha_informe,
          LTRIM(RTRIM(ISNULL(mc.nombre_centro, m.nombre_centro))) AS nombre_centro,
          LTRIM(RTRIM(ISNULL(mp.nombre_programa, m.nombre_programa))) AS nombre_programa,
          LTRIM(RTRIM(ISNULL(m.cliente_entrega, ''))) AS cliente_entrega,
          SUM(ISNULL(md.vtatotal, 0)) AS uf_caso,
          COUNT(md.item) AS total_lineas,
          MAX(ISNULL(md.marcareversa, 'N')) AS marcareversa
        FROM dbo.muestras_detalle md
        INNER JOIN dbo.muestras m ON md.id_caso = m.id_caso
        LEFT JOIN dbo.mae_centro mc ON m.id_centro = mc.id_centro
        LEFT JOIN dbo.mae_programa mp ON m.id_programa = mp.id_programa
        WHERE md.id_facturacion = @id_facturacion
        GROUP BY
          m.id_caso, m.caso_adlab, m.fecha_recepcion, m.fecha_muestreo,
          m.fecha_informe, mc.nombre_centro, m.nombre_centro,
          mp.nombre_programa, m.nombre_programa, m.cliente_entrega
        ORDER BY m.caso_adlab;

        -- 3. Otros Ingresos (OI)
        SELECT
          fi.id_facturacion,
          fi.id_otrosingresos,
          LTRIM(RTRIM(ISNULL(moi.nombre_otrosingresos, 'Otro Ingreso'))) AS nombre_otrosingresos,
          ISNULL(fi.valor, 0) AS valor
        FROM dbo.facturacion_ing fi
        LEFT JOIN dbo.mae_otrosingresos moi ON fi.id_otrosingresos = moi.id_otrosingresos
        WHERE fi.id_facturacion = @id_facturacion;

        -- 4. Otros Descuentos (OD)
        SELECT
          fd.id_facturacion,
          fd.id_otrosdescuentos,
          LTRIM(RTRIM(ISNULL(modc.nombre_otrosdescuentos, 'Otro Descuento'))) AS nombre_otrosdescuentos,
          ISNULL(fd.valor, 0) AS valor
        FROM dbo.facturacion_des fd
        LEFT JOIN dbo.mae_otrosdescuentos modc ON fd.id_otrosdescuentos = modc.id_otrosdescuentos
        WHERE fd.id_facturacion = @id_facturacion;

        -- 5. Órdenes de Compra / HES (facturacion_ocompra)
        SELECT
          id_facturacion,
          LTRIM(RTRIM(ISNULL(ocompra, ''))) AS ocompra,
          LTRIM(RTRIM(ISNULL(ocompra_fecha, ''))) AS ocompra_fecha,
          LTRIM(RTRIM(ISNULL(referencia, ''))) AS referencia,
          LTRIM(RTRIM(ISNULL(tipo, 'OC'))) AS tipo,
          ISNULL(orden, 1) AS orden
        FROM dbo.facturacion_ocompra
        WHERE id_facturacion = @id_facturacion
        ORDER BY orden ASC;
      `);

    const enc = result.recordsets[0]?.[0];
    if (!enc) {
      throw new Error(`No se encontró la prefactura #${idFac}.`);
    }

    return {
      encabezado: enc,
      casos: result.recordsets[1] || [],
      otrosIngresos: result.recordsets[2] || [],
      otrosDescuentos: result.recordsets[3] || [],
      ordenesCompra: result.recordsets[4] || []
    };
  }

  /**
   * Recalcula uf_totalcaso, uf_totalotrosing, uf_totalotrosdes, uf_totalfac y peso_totalfac en facturacion_enc
   */
  async _recalcularTotalesPrefactura(pool, id_facturacion) {
    const idFac = Number(id_facturacion);
    const res = await pool.request()
      .input('id_facturacion', sql.Numeric(10, 0), idFac)
      .query(`
        DECLARE @uf_casos NUMERIC(12,2) = ISNULL((SELECT SUM(ISNULL(vtatotal, 0)) FROM dbo.muestras_detalle WHERE id_facturacion = @id_facturacion), 0);
        DECLARE @uf_oi NUMERIC(12,2) = ISNULL((SELECT SUM(ISNULL(valor, 0)) FROM dbo.facturacion_ing WHERE id_facturacion = @id_facturacion), 0);
        DECLARE @uf_od NUMERIC(12,2) = ISNULL((SELECT SUM(ISNULL(valor, 0)) FROM dbo.facturacion_des WHERE id_facturacion = @id_facturacion), 0);
        DECLARE @uf_final NUMERIC(12,2) = @uf_casos + @uf_oi - @uf_od;

        UPDATE dbo.facturacion_enc
        SET uf_totalcaso = @uf_casos,
            uf_totalotrosing = @uf_oi,
            uf_totalotrosdes = @uf_od,
            uf_totalfac = @uf_final,
            peso_totalfac = ROUND(@uf_final * ISNULL(uf, 0), 0)
        WHERE id_facturacion = @id_facturacion;
      `);
    return res;
  }

  async agregarOtroIngreso({ id_facturacion, id_otrosingresos, valor }) {
    const pool = await getConnectionSalud();
    await pool.request()
      .input('id_facturacion', sql.Numeric(10, 0), Number(id_facturacion))
      .input('id_otrosingresos', sql.Numeric(10, 0), Number(id_otrosingresos))
      .input('valor', sql.Numeric(12, 2), round2(valor))
      .query(`
        DELETE FROM dbo.facturacion_ing WHERE id_facturacion = @id_facturacion AND id_otrosingresos = @id_otrosingresos;
        INSERT INTO dbo.facturacion_ing (id_facturacion, id_otrosingresos, valor)
        VALUES (@id_facturacion, @id_otrosingresos, @valor);
      `);
    await this._recalcularTotalesPrefactura(pool, id_facturacion);
    return this.getPrefacturaSaludDetalle(id_facturacion);
  }

  async eliminarOtroIngreso({ id_facturacion, id_otrosingresos }) {
    const pool = await getConnectionSalud();
    await pool.request()
      .input('id_facturacion', sql.Numeric(10, 0), Number(id_facturacion))
      .input('id_otrosingresos', sql.Numeric(10, 0), Number(id_otrosingresos))
      .query(`DELETE FROM dbo.facturacion_ing WHERE id_facturacion = @id_facturacion AND id_otrosingresos = @id_otrosingresos;`);
    await this._recalcularTotalesPrefactura(pool, id_facturacion);
    return this.getPrefacturaSaludDetalle(id_facturacion);
  }

  async agregarOtroDescuento({ id_facturacion, id_otrosdescuentos, valor }) {
    const pool = await getConnectionSalud();
    await pool.request()
      .input('id_facturacion', sql.Numeric(10, 0), Number(id_facturacion))
      .input('id_otrosdescuentos', sql.Numeric(10, 0), Number(id_otrosdescuentos))
      .input('valor', sql.Numeric(12, 2), round2(valor))
      .query(`
        DELETE FROM dbo.facturacion_des WHERE id_facturacion = @id_facturacion AND id_otrosdescuentos = @id_otrosdescuentos;
        INSERT INTO dbo.facturacion_des (id_facturacion, id_otrosdescuentos, valor)
        VALUES (@id_facturacion, @id_otrosdescuentos, @valor);
      `);
    await this._recalcularTotalesPrefactura(pool, id_facturacion);
    return this.getPrefacturaSaludDetalle(id_facturacion);
  }

  async eliminarOtroDescuento({ id_facturacion, id_otrosdescuentos }) {
    const pool = await getConnectionSalud();
    await pool.request()
      .input('id_facturacion', sql.Numeric(10, 0), Number(id_facturacion))
      .input('id_otrosdescuentos', sql.Numeric(10, 0), Number(id_otrosdescuentos))
      .query(`DELETE FROM dbo.facturacion_des WHERE id_facturacion = @id_facturacion AND id_otrosdescuentos = @id_otrosdescuentos;`);
    await this._recalcularTotalesPrefactura(pool, id_facturacion);
    return this.getPrefacturaSaludDetalle(id_facturacion);
  }

  /**
   * Modificación pre-exportación DTE y asociación de OC / HES (fac_electronica_modifica_exportatxt_v2.scx)
   */
  async actualizarDatosPrefactura({
    id_facturacion,
    fecha_facturacion,
    id_formapago,
    id_glosa,
    glosa,
    observaciones,
    nota,
    uf,
    ordenes_compra = []
  }) {
    const pool = await getConnectionSalud();
    const idFac = Number(id_facturacion);

    await pool.request()
      .input('id_facturacion', sql.Numeric(10, 0), idFac)
      .input('fecha_facturacion', sql.VarChar(10), toDmyString(fecha_facturacion))
      .input('id_formapago', sql.Numeric(10, 0), Number(id_formapago) || 1)
      .input('id_glosa', sql.Numeric(10, 0), Number(id_glosa) || 1)
      .input('glosa', sql.VarChar(500), String(glosa || '').slice(0, 500))
      .input('observaciones', sql.VarChar(500), String(observaciones || '').slice(0, 500))
      .input('nota', sql.VarChar(500), String(nota || '').slice(0, 500))
      .input('uf', sql.Numeric(12, 2), Number(uf) || 38500)
      .query(`
        UPDATE dbo.facturacion_enc
        SET fecha_facturacion = CASE WHEN @fecha_facturacion <> '' THEN @fecha_facturacion ELSE fecha_facturacion END,
            id_formapago = @id_formapago,
            id_glosa = @id_glosa,
            glosa = @glosa,
            observaciones = @observaciones,
            nota = @nota,
            uf = CASE WHEN @uf > 0 THEN @uf ELSE uf END
        WHERE id_facturacion = @id_facturacion;
      `);

    if (Array.isArray(ordenes_compra)) {
      await pool.request()
        .input('id_facturacion', sql.Numeric(10, 0), idFac)
        .query(`DELETE FROM dbo.facturacion_ocompra WHERE id_facturacion = @id_facturacion;`);

      let idx = 1;
      for (const ocItem of ordenes_compra) {
        if (!ocItem || !ocItem.ocompra || String(ocItem.ocompra).trim() === '') continue;
        await pool.request()
          .input('id_facturacion', sql.Numeric(10, 0), idFac)
          .input('ocompra', sql.VarChar(50), String(ocItem.ocompra).trim())
          .input('ocompra_fecha', sql.VarChar(10), toDmyString(ocItem.ocompra_fecha))
          .input('referencia', sql.VarChar(50), String(ocItem.referencia || ocItem.tipo || 'OC').slice(0, 50))
          .input('tipo', sql.VarChar(10), String(ocItem.tipo || 'OC').slice(0, 10))
          .input('orden', sql.Numeric(10, 0), Number(ocItem.orden) || idx++)
          .query(`
            INSERT INTO dbo.facturacion_ocompra (ocompra, ocompra_fecha, referencia, id_facturacion, tipo, orden, oc)
            VALUES (@ocompra, @ocompra_fecha, @referencia, @id_facturacion, @tipo, @orden, LEFT(@ocompra, 20));
          `);
      }

      const firstOc = ordenes_compra.find((o) => o && o.ocompra);
      if (firstOc) {
        await pool.request()
          .input('id_facturacion', sql.Numeric(10, 0), idFac)
          .input('ocompra', sql.VarChar(12), String(firstOc.ocompra).trim().slice(0, 12))
          .input('ocompra_fecha', sql.VarChar(10), toDmyString(firstOc.ocompra_fecha))
          .query(`
            UPDATE dbo.facturacion_enc
            SET ocompra = @ocompra, ocompra_fecha = @ocompra_fecha
            WHERE id_facturacion = @id_facturacion;
          `);
      }
    }

    await this._recalcularTotalesPrefactura(pool, idFac);
    return this.getPrefacturaSaludDetalle(idFac);
  }

  /** Ejecuta `fn` con un ejecutor ligado a una transacción (ADLSOFT envía cada sentencia por separado; aquí van juntas). */
  async _enTransaccion(fn) {
    const pool = await getConnectionSalud();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const resultado = await fn({ request: () => new sql.Request(tx) });
      await tx.commit();
      return resultado;
    } catch (error) {
      try { await tx.rollback(); } catch { /* la transacción ya estaba cerrada */ }
      throw error;
    }
  }

  /** "Elimina ID Facturación" (fac_elimina_reprocesa_v2.scx): borra la factura, libera sus líneas y las guías de despacho. */
  async eliminarPrefacturaSalud(id_facturacion) {
    return this._enTransaccion((db) => mantencion.eliminarFacturaPorId(db, { id_facturacion, liberarGuias: true }));
  }

  /** "Elimina Factura" por N° de factura: solo la primera factura interna que lleve ese número y sin liberar guías (como ADLSOFT). */
  async eliminarFacturaPorNumeroSalud(factura) {
    return this._enTransaccion((db) => mantencion.eliminarFacturaPorNumero(db, { factura }));
  }

  /** fac_cambiaempresafacturar_v1.scx: cambia la empresa de la factura y de todos sus casos. */
  async cambiarEmpresaFacturaSalud({ id_facturacion, id_empresaservicio, motivo, id_usuario }) {
    return this._enTransaccion((db) => mantencion.cambiarEmpresaFactura(db, { id_facturacion, id_empresaservicio_nueva: id_empresaservicio, motivo, id_usuario }));
  }

  /** Maestros para las pantallas de documentos: tipos, glosas por tipo de documento, formas de pago, conceptos y empresas. */
  async getMaestrosDocumentosSalud() {
    const pool = await getConnectionSalud();
    const r = await pool.request().query(`
      SELECT id_tipodocumento, LTRIM(RTRIM(nombre_tipodocumento)) AS nombre_tipodocumento, LTRIM(RTRIM(sigla)) AS sigla FROM dbo.mae_tipodocumento ORDER BY nombre_tipodocumento;
      SELECT id_glosa, LTRIM(RTRIM(nombre_glosa)) AS nombre_glosa, id_tipodocumento FROM dbo.mae_glosa WHERE habilitado = 'S' ORDER BY nombre_glosa;
      SELECT id_formapago, LTRIM(RTRIM(nombre_formapago)) AS nombre_formapago FROM dbo.mae_formapago WHERE habilitado = 'S' ORDER BY id_formapago;
      SELECT id_otrosingresos, LTRIM(RTRIM(nombre_otrosingresos)) AS nombre_otrosingresos FROM dbo.mae_otrosingresos ORDER BY nombre_otrosingresos;
      SELECT id_otrosdescuentos, LTRIM(RTRIM(nombre_otrosdescuentos)) AS nombre_otrosdescuentos FROM dbo.mae_otrosdescuentos ORDER BY nombre_otrosdescuentos;
      EXEC dbo.maestro_empresaservicio_administracion;
    `);
    const rs = r.recordsets;
    return {
      tiposDocumento: rs[0] || [], glosas: rs[1] || [], formasPago: rs[2] || [], otrosIngresos: rs[3] || [], otrosDescuentos: rs[4] || [],
      empresas: (rs[5] || []).map((e) => ({
        id_empresaservicio: e.id_empresaservicio, nombre_empresaservicios: String(e.nombre_empresaservicios ?? '').trim(), rut_empresaservicios: String(e.rut_empresaservicios ?? '').trim()
      }))
    };
  }

  async listarCasosDeFacturaSalud(id_facturacion) { return otrasVentas.listarCasosDeFactura(await getConnectionSalud(), { id_facturacion }); }
  async crearNotaCreditoCasosSalud(datos) { return this._enTransaccion((db) => otrasVentas.crearNotaCreditoPorCasos(db, datos)); }

  /** fac_otrasventas_v2.scx: documentos de otras ventas, notas de crédito y de débito (tabla facturacion_otro). */
  async listarOtrasVentasSalud(estado) { return otrasVentas.listarDocumentos(await getConnectionSalud(), { estado }); }
  async buscarReferenciaOtrasVentasSalud(datos) { return otrasVentas.buscarFacturaReferencia(await getConnectionSalud(), datos); }
  async crearOtraVentaSalud(datos) { return this._enTransaccion((db) => otrasVentas.crearDocumento(db, datos)); }
  /** `accion` = numero | nota | fecha | glosa | uf | monto-uf */
  async modificarOtraVentaSalud(accion, datos) {
    const acciones = {
      numero: otrasVentas.asignarNumeroDocumento, nota: otrasVentas.grabarNotaDocumento, fecha: otrasVentas.cambiarFechaDocumento,
      glosa: otrasVentas.cambiarGlosaDocumento, uf: otrasVentas.cambiarUfDocumento, 'monto-uf': otrasVentas.cambiarMontoUfDocumento
    };
    if (!acciones[accion]) throw new Error('Acción desconocida.');
    return this._enTransaccion((db) => acciones[accion](db, datos));
  }
  /** Archivos planos de otras ventas: flujo = FEA | FEE | NCE | NDE. */
  async listarDocumentosArchivoSalud(flujo, estado) { return otrasVentas.listarParaExportar(await getConnectionSalud(), { flujo, estado }); }
  async exportarDocumentosArchivoSalud(flujo, ids_facturacion) {
    const r = await this._enTransaccion((db) => otrasVentas.exportarDocumentos(db, { flujo, ids_facturacion }));
    return { ...r, contenidoAnsiBase64: exportacion.aBufferAnsi(r.contenido).toString('base64') };
  }

  /**
   * PDF «Resumen» de una factura. Se entrega para descargar y, si hay una carpeta de documentos configurada
   * (FACTURACION_SALUD_DOCS_DIR), también se guarda ahí en <año>/<MES>.
   */
  async generarPdfResumenSalud(id_facturacion) {
    const db = await getConnectionSalud();
    const ficha = await consulta.consultarFacturaPorId(db, { id_facturacion });
    const datos = await pdfSalud.leerDatosResumen(db, { id_facturacion });
    const buffer = await pdfSalud.crearPdfResumen(datos);
    const ruta = pdfSalud.guardarPdf(buffer, {
      carpetaBase: process.env.FACTURACION_SALUD_DOCS_DIR,
      titulo: ficha.titulo,
      fechaFacturacion: ficha.encabezado.fecha_facturacion
    });
    return { buffer, nombre: pdfSalud.nombreArchivoResumen(ficha.titulo), ruta };
  }

  /** PDF «Detalle» de una factura (mismas reglas de descarga y carpeta que el resumen). */
  async generarPdfDetalleSalud(id_facturacion) {
    const db = await getConnectionSalud();
    const ficha = await consulta.consultarFacturaPorId(db, { id_facturacion });
    const datos = await pdfSalud.leerDatosDetalle(db, { id_facturacion, usdTotalCasos: ficha.usdTotalCasos });
    const buffer = await pdfSalud.crearPdfDetalle(datos);
    const nombre = pdfSalud.nombreArchivoDetalle(ficha.titulo);
    const ruta = pdfSalud.guardarPdf(buffer, {
      carpetaBase: process.env.FACTURACION_SALUD_DOCS_DIR,
      titulo: ficha.titulo,
      fechaFacturacion: ficha.encabezado.fecha_facturacion,
      nombreArchivo: nombre
    });
    return { buffer, nombre, ruta };
  }

  /** fac_consulta_una_factura_v4.scx: busca por ID de facturación o por N° de factura. */
  async consultarFacturaSalud({ id_facturacion, factura }) {
    const db = await getConnectionSalud();
    return Number(id_facturacion) > 0
      ? consulta.consultarFacturaPorId(db, { id_facturacion })
      : consulta.consultarFacturaPorFolio(db, { factura });
  }

  /** "Graba Factura": sin N° de factura graba totales y UF; con N° de factura graba el número. */
  async grabarFacturaSalud(datos) { return this._enTransaccion((db) => consulta.grabarFactura(db, datos)); }

  /** fac_guiasclientes.scx: guías de despacho a clientes. */
  async listarGuiasPendientesSalud(id_empresaservicio) { return consulta.listarGuiasPendientes(await getConnectionSalud(), { id_empresaservicio }); }
  async calcularNetoGuiasSalud(datos) { return consulta.calcularNetoGuias(await getConnectionSalud(), datos); }
  async reservarGuiasSalud(datos) { return this._enTransaccion((db) => consulta.reservarGuias(db, datos)); }
  async liberarGuiasSalud(id_facturacion) { return this._enTransaccion((db) => consulta.liberarGuiasDeFactura(db, { id_facturacion })); }

  /** Datos de los Excel de resumen y detalle de una factura (columnas y filas, sin generar el archivo). */
  async datosExcelResumenSalud(id_facturacion) { return consulta.datosExcelResumen(await getConnectionSalud(), { id_facturacion }); }
  async datosExcelDetalleSalud(id_facturacion, lote) { return consulta.datosExcelDetalle(await getConnectionSalud(), { id_facturacion, lote }); }

  /** fac_electronica_exportatxt_v2.scx: facturas de casos disponibles para el archivo plano. */
  async listarFacturasExportacionSalud(estado) {
    return exportacion.listarFacturasParaExportar(await getConnectionSalud(), { estado });
  }

  /** Arma el archivo plano de 35 columnas de las facturas elegidas y las marca como emitidas. */
  async exportarFacturasCasosSalud(ids_facturacion) {
    const r = await this._enTransaccion((db) => exportacion.exportarFacturasCasos(db, { ids_facturacion }));
    return { ...r, contenidoAnsiBase64: exportacion.aBufferAnsi(r.contenido).toString('base64') };
  }

  /** fac_electronica_modifica_exportatxt_v2.scx: datos previos a exportar. `accion` = fecha | forma-pago | nota | glosa-libre | glosa | mes. */
  async modificarDatosExportacionSalud(accion, datos) {
    const acciones = {
      fecha: exportacion.grabarFechaFacturacion, 'forma-pago': exportacion.grabarFormaPago, nota: exportacion.grabarNota,
      'glosa-libre': exportacion.grabarGlosaLibre, glosa: exportacion.grabarGlosaMaestro, mes: exportacion.grabarMes
    };
    if (!acciones[accion]) throw new Error('Acción desconocida.');
    return this._enTransaccion((db) => acciones[accion](db, datos));
  }

  async listarOcHesSalud(id_facturacion) { return exportacion.listarOcHes(await getConnectionSalud(), { id_facturacion }); }
  async agregarOcHesSalud(datos) { return this._enTransaccion((db) => exportacion.agregarOcHes(db, datos)); }
  async modificarOcHesSalud(datos) { return this._enTransaccion((db) => exportacion.modificarOcHes(db, datos)); }
  async eliminarOcHesSalud(datos) { return this._enTransaccion((db) => exportacion.eliminarOcHes(db, datos)); }
  async buscarOcEnOtrasFacturasSalud(ocompra) { return exportacion.buscarOcEnOtrasFacturas(await getConnectionSalud(), { ocompra }); }

  /** fac_ocompra_factura.scx: órdenes de compra asociadas (facturacion_oc). */
  async listarOcSalud(id_facturacion) {
    return mantencion.listarOcAsociadas(await getConnectionSalud(), { id_facturacion });
  }

  async agregarOcSalud(datos) {
    return this._enTransaccion((db) => mantencion.agregarOc(db, datos));
  }

  async eliminarOcSalud(datos) {
    return this._enTransaccion((db) => mantencion.eliminarOc(db, datos));
  }

  /** "Graba" de fac_facturacreada_oi_od.scx: otros ingresos / descuentos de las facturas recién creadas. */
  async grabarOiOdSalud(facturas) {
    return this._enTransaccion((db) => mantencion.grabarOtrosIngresosDescuentos(db, { facturas }));
  }

  /**
   * Quitar un caso individual de una prefactura y devolverlo a ENVIADO (fac_elimina_reprocesa_v2.scx)
   */
  async quitarCasoDePrefacturaSalud({ id_facturacion, id_caso }) {
    const pool = await getConnectionSalud();
    const idFac = Number(id_facturacion);
    const idCaso = Number(id_caso);

    await pool.request()
      .input('id_facturacion', sql.Numeric(10, 0), idFac)
      .input('id_caso', sql.Numeric(10, 0), idCaso)
      .query(`
        UPDATE dbo.muestras_detalle
        SET id_facturacion = 0,
            estado = 'ENVIADO',
            mf = 0
        WHERE id_facturacion = @id_facturacion AND id_caso = @id_caso;

        DELETE FROM dbo.facturacion_det
        WHERE id_facturacion = @id_facturacion AND id_caso = @id_caso;
      `);

    await this._recalcularTotalesPrefactura(pool, idFac);
    return this.getPrefacturaSaludDetalle(idFac);
  }

  /**
   * Cambiar Empresa a Facturar (id_empresaservicio) de un caso (fac_elimina_reprocesa_v2.scx)
   */
  async cambiarEmpresaFacturarCaso({ id_caso, id_empresaservicio }) {
    const pool = await getConnectionSalud();
    await pool.request()
      .input('id_caso', sql.Numeric(10, 0), Number(id_caso))
      .input('id_empresaservicio', sql.Numeric(10, 0), Number(id_empresaservicio))
      .query(`
        UPDATE dbo.muestras
        SET id_empresaservicio = @id_empresaservicio
        WHERE id_caso = @id_caso;
      `);
    return { updated: true, id_caso: Number(id_caso), id_empresaservicio: Number(id_empresaservicio) };
  }

  /**
   * Exportación de Planilla Excel de Respaldo Cliente (Resumen y Detalle) — fac_facturacreada_oi_od.scx
   */
  async generarExcelRespaldoPrefactura(res, { id_facturacion, tipo = 'DETALLE' }) {
    const pool = await getConnectionSalud();
    const idFac = Number(id_facturacion);
    const detalle = await this.getPrefacturaSaludDetalle(idFac);
    const enc = detalle.encabezado;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ADL ONE - Facturación Salud';

    if (String(tipo).toUpperCase() === 'RESUMEN') {
      const sheet = workbook.addWorksheet(`Resumen Factura ${idFac}`);
      sheet.columns = [
        { header: 'ID Facturación', key: 'id_facturacion', width: 15 },
        { header: 'Cliente', key: 'cliente', width: 34 },
        { header: 'RUT Cliente', key: 'rut', width: 16 },
        { header: 'Caso ADLAB', key: 'caso_adlab', width: 15 },
        { header: 'Programa', key: 'nombre_programa', width: 28 },
        { header: 'Centro', key: 'nombre_centro', width: 26 },
        { header: 'Veterinario', key: 'cliente_entrega', width: 24 },
        { header: 'F. Recepción', key: 'fecha_recepcion', width: 14 },
        { header: 'F. Informe', key: 'fecha_informe', width: 14 },
        { header: 'Total Caso (UF)', key: 'uf_caso', width: 16 },
        { header: 'Valor UF', key: 'valor_uf', width: 14 },
        { header: 'Total Neto ($ CLP)', key: 'neto_clp', width: 18 }
      ];

      sheet.getRow(1).font = { bold: true };
      for (const c of detalle.casos) {
        sheet.addRow({
          id_facturacion: idFac,
          cliente: enc.nombre_empresaservicios,
          rut: enc.rut_empresaservicios,
          caso_adlab: c.caso_adlab,
          nombre_programa: c.nombre_programa,
          nombre_centro: c.nombre_centro,
          cliente_entrega: c.cliente_entrega,
          fecha_recepcion: c.fecha_recepcion,
          fecha_informe: c.fecha_informe,
          uf_caso: Number(c.uf_caso || 0),
          valor_uf: Number(enc.uf || 0),
          neto_clp: round0(Number(c.uf_caso || 0) * Number(enc.uf || 0))
        });
      }
    } else {
      const spRes = await pool.request()
        .input('id_facturacion', sql.Numeric(10, 0), idFac)
        .query(`EXEC dbo.fac_excel_detalle @xid_facturacion = @id_facturacion`);

      const rows = spRes.recordset || [];
      const sheet = workbook.addWorksheet(`Detalle Factura ${idFac}`);
      sheet.columns = [
        { header: 'ID Facturación', key: 'id_facturacion', width: 14 },
        { header: 'Empresa', key: 'empresa', width: 32 },
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Programa', key: 'programa', width: 26 },
        { header: 'Centro', key: 'centro', width: 24 },
        { header: 'Tipo Agua', key: 'tipoagua', width: 16 },
        { header: 'Veterinario', key: 'veterinario', width: 22 },
        { header: 'Caso ADLAB', key: 'caso', width: 14 },
        { header: 'F. Muestreo', key: 'fecha_muestreo', width: 14 },
        { header: 'F. Informe', key: 'fecha_informe', width: 14 },
        { header: 'Técnica / Análisis', key: 'tecnica', width: 32 },
        { header: 'Órgano / Matriz', key: 'organo', width: 18 },
        { header: 'Medio', key: 'medio', width: 16 },
        { header: 'Nº Análisis', key: 'n_analisis', width: 12 },
        { header: 'UF Unitario', key: 'uf_uni', width: 14 },
        { header: 'UF Total', key: 'uf_tot', width: 14 },
        { header: 'Valor UF', key: 'uf_valor', width: 14 },
        { header: 'Total Neto ($ CLP)', key: 'neto_clp', width: 18 }
      ];

      sheet.getRow(1).font = { bold: true };
      for (const r of rows) {
        const ufTot = round2(Number(r.uf_tot || 0));
        const ufVal = Number(r.uf_valor || enc.uf || 0);
        sheet.addRow({
          ...r,
          uf_uni: Number(r.uf_uni || 0),
          uf_tot: ufTot,
          uf_valor: ufVal,
          neto_clp: round0(ufTot * ufVal)
        });
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="respaldo_${tipo.toLowerCase()}_prefactura_${idFac}.xlsx"`
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  // ==========================================================================
  // 3. OTRAS VENTAS / OTROS COBROS Y NOTAS DE CRÉDITO / DÉBITO (facturacion_otro)
  // ==========================================================================

  async listarOtrosCobrosSalud({ id_tipodocumento = 'ALL', emitido = 'ALL', busqueda = '', limite = 300 } = {}) {
    const pool = await getConnectionSalud();
    const request = pool.request();
    const conds = ['1=1'];

    if (id_tipodocumento && id_tipodocumento !== 'ALL') {
      request.input('td', sql.Numeric(10, 0), Number(id_tipodocumento));
      conds.push(`fo.id_tipodocumento = @td`);
    }

    if (emitido === 'N') {
      conds.push(`ISNULL(fo.emitido, 'N') <> 'S'`);
    } else if (emitido === 'S') {
      conds.push(`fo.emitido = 'S'`);
    }

    if (busqueda && String(busqueda).trim() !== '') {
      request.input('q', sql.VarChar(100), `%${String(busqueda).trim()}%`);
      conds.push(`(
        CAST(fo.id_facturacion AS VARCHAR(20)) LIKE @q
        OR CAST(fo.numero_documento AS VARCHAR(20)) LIKE @q
        OR es.nombre_empresaservicios LIKE @q
        OR es.rut_empresaservicios LIKE @q
        OR fo.concepto_cobro LIKE @q
        OR fo.num_ref LIKE @q
      )`);
    }

    const topN = Math.min(Math.max(Number(limite) || 300, 10), 2000);
    const query = `
      SELECT TOP (${topN})
        fo.id_otroscobros,
        fo.id_facturacion,
        fo.id_tipodocumento,
        CASE fo.id_tipodocumento
          WHEN 1 THEN 'FEA (Factura Afecta Otras Ventas)'
          WHEN 11 THEN 'FEE (Factura Exenta)'
          WHEN 8 THEN 'NCE (Nota de Crédito Electrónica)'
          WHEN 10 THEN 'NDE (Nota de Débito Electrónica)'
          ELSE 'Otro Documento'
        END AS nombre_tipodocumento,
        fo.factura,
        fo.numero_documento,
        fo.id_empresaservicio,
        LTRIM(RTRIM(ISNULL(es.nombre_empresaservicios, ''))) AS nombre_empresaservicios,
        LTRIM(RTRIM(ISNULL(es.rut_empresaservicios, ''))) AS rut_empresaservicios,
        LTRIM(RTRIM(ISNULL(fo.concepto_cobro, ''))) AS concepto_cobro,
        LTRIM(RTRIM(ISNULL(fo.fecha_documento, ''))) AS fecha_documento,
        ISNULL(fo.uf, 0) AS uf,
        ISNULL(fo.monto_uf, 0) AS monto_uf,
        ISNULL(fo.monto, 0) AS monto,
        LTRIM(RTRIM(ISNULL(fo.observacion, ''))) AS observacion,
        LTRIM(RTRIM(ISNULL(fo.tipo_ref, ''))) AS tipo_ref,
        LTRIM(RTRIM(ISNULL(fo.num_ref, ''))) AS num_ref,
        LTRIM(RTRIM(ISNULL(fo.fecha_ref, ''))) AS fecha_ref,
        ISNULL(fo.cod_razon, 0) AS cod_razon,
        LTRIM(RTRIM(ISNULL(fo.motivo, ''))) AS motivo,
        LTRIM(RTRIM(ISNULL(fo.nota, ''))) AS nota,
        LTRIM(RTRIM(ISNULL(fo.emitido, 'N'))) AS emitido,
        LTRIM(RTRIM(ISNULL(fo.tipoimpuesto, 'AFE'))) AS tipoimpuesto,
        ISNULL(fo.id_formapago, 1) AS id_formapago
      FROM dbo.facturacion_otro fo
      LEFT JOIN dbo.mae_empresaservicios es ON fo.id_empresaservicio = es.id_empresaservicio
      WHERE ${conds.join(' AND ')}
      ORDER BY fo.id_otroscobros DESC;
    `;

    const res = await request.query(query);
    return res.recordset || [];
  }

  /**
   * Busca una Factura de Casos (facturacion_enc) o de Otras Ventas (facturacion_otro)
   * para referenciarla en una Nota de Crédito (NCE) o Nota de Débito (NDE), incluyendo sus casos para reversa.
   */
  async buscarFacturaParaNotaCredito({ folio, origen = 'CASOS' }) {
    const pool = await getConnectionSalud();
    const numFolio = Number(folio);
    if (!numFolio || isNaN(numFolio)) {
      throw new Error('Debe ingresar un número de ID Facturación o Folio válido.');
    }

    if (String(origen).toUpperCase() === 'OTRAS_VENTAS') {
      const resOtro = await pool.request()
        .input('folio', sql.Numeric(10, 0), numFolio)
        .query(`
          SELECT TOP 1
            fo.id_facturacion,
            fo.numero_documento AS factura,
            fo.id_empresaservicio,
            LTRIM(RTRIM(es.nombre_empresaservicios)) AS nombre_empresaservicios,
            LTRIM(RTRIM(es.rut_empresaservicios)) AS rut_empresaservicios,
            ISNULL(fo.uf, 0) AS uf,
            ISNULL(fo.monto_uf, 0) AS uf_totalfac,
            ISNULL(fo.monto, 0) AS peso_totalfac,
            LTRIM(RTRIM(ISNULL(fo.fecha_documento, ''))) AS fecha_facturacion,
            LTRIM(RTRIM(ISNULL(fo.concepto_cobro, ''))) AS glosa,
            ISNULL(fo.id_formapago, 1) AS id_formapago,
            'OTRAS_VENTAS' AS origen
          FROM dbo.facturacion_otro fo
          INNER JOIN dbo.mae_empresaservicios es ON fo.id_empresaservicio = es.id_empresaservicio
          WHERE fo.id_facturacion = @folio OR fo.numero_documento = @folio OR fo.factura = @folio
          ORDER BY fo.id_otroscobros DESC;
        `);
      const doc = resOtro.recordset?.[0];
      if (!doc) throw new Error(`No se encontró documento de Otras Ventas con folio/ID #${numFolio}.`);
      return { documento: doc, casos: [] };
    }

    // Búsqueda en facturacion_enc (Facturas de Casos) + casos para fac_reversa_casos_factura
    const resCasos = await pool.request()
      .input('folio', sql.Numeric(10, 0), numFolio)
      .query(`
        SELECT TOP 1
          fe.id_facturacion,
          fe.factura,
          fe.id_empresaservicio,
          LTRIM(RTRIM(es.nombre_empresaservicios)) AS nombre_empresaservicios,
          LTRIM(RTRIM(es.rut_empresaservicios)) AS rut_empresaservicios,
          ISNULL(fe.uf, 0) AS uf,
          ISNULL(fe.uf_totalfac, 0) AS uf_totalfac,
          ISNULL(fe.peso_totalfac, ROUND(ISNULL(fe.uf_totalfac, 0) * ISNULL(fe.uf, 0), 0)) AS peso_totalfac,
          LTRIM(RTRIM(ISNULL(fe.fecha_facturacion, ''))) AS fecha_facturacion,
          LTRIM(RTRIM(ISNULL(fe.glosa, ''))) AS glosa,
          ISNULL(fe.id_formapago, 1) AS id_formapago,
          'CASOS' AS origen
        FROM dbo.facturacion_enc fe
        INNER JOIN dbo.mae_empresaservicios es ON fe.id_empresaservicio = es.id_empresaservicio
        WHERE (fe.id_facturacion = @folio OR fe.factura = @folio)
          AND ISNULL(fe.eliminado, 'N') <> 'S';
      `);

    const doc = resCasos.recordset?.[0];
    if (!doc) {
      throw new Error(`No se encontró Factura de Casos con ID Facturación o Folio #${numFolio}.`);
    }

    const revRes = await pool.request()
      .input('id_facturacion', sql.Numeric(10, 0), Number(doc.id_facturacion))
      .query(`EXEC dbo.fac_reversa_casos_factura @xid_facturacion = @id_facturacion`);

    return {
      documento: doc,
      casos: revRes.recordset || []
    };
  }

  /**
   * Crea un documento en facturacion_otro (1=FEA, 11=FEE, 8=NCE, 10=NDE)
   * Implementando la lógica de Notas de Crédito de fac_otrasventas_v2.scx y fac_reversa_nc_casos.scx:
   * - cod_razon = 1 (Anula Documento): Libera automáticamente los casos a estado = 'ENVIADO' e id_facturacion = 0.
   * - cod_razon = 2 (Corrige Texto): Mantiene casos intactos.
   * - cod_razon = 3 (Corrige Montos / Reversa Parcial): Marca marcareversa = 'S' en los casos seleccionados.
   */
  async crearDocumentoOtroCobro({
    id_tipodocumento = 1,
    id_empresaservicio,
    concepto_cobro,
    fecha_documento,
    uf = 0,
    monto_uf = 0,
    monto = 0,
    observacion = '',
    tipo_ref = '',
    num_ref = '',
    fecha_ref = '',
    cod_razon = 0,
    motivo = '',
    nota = '',
    tipoimpuesto = 'AFE',
    id_formapago = 1,
    id_facturacion_referencia = null,
    origen_referencia = 'CASOS',
    casos_reversar_ids = []
  }) {
    if (!id_empresaservicio) {
      throw new Error('Debe seleccionar la Empresa de Servicio a facturar.');
    }
    if (!concepto_cobro || String(concepto_cobro).trim() === '') {
      throw new Error('Debe ingresar el Concepto de Cobro / Glosa del documento.');
    }

    const pool = await getConnectionSalud();
    const td = Number(id_tipodocumento);
    const numUf = Number(uf || 0);
    const numMontoUf = round2(Number(monto_uf || 0));
    const numMontoClp = Number(monto) > 0 ? round0(monto) : round0(numMontoUf * numUf);
    const fechaDocDmy = toDmyString(fecha_documento || new Date().toISOString().slice(0, 10));

    // Consumir correlativos id_otroscobros e id_facturacion en Mae_id
    const corrRes = await pool.request().query(`
      UPDATE dbo.Mae_id
      SET id_otroscobros = ISNULL(id_otroscobros, 0) + 1,
          id_facturacion = ISNULL(id_facturacion, 0) + 1;
      SELECT TOP 1 id_otroscobros, id_facturacion FROM dbo.Mae_id;
    `);
    const newIdOtros = Number(corrRes.recordset?.[0]?.id_otroscobros);
    const newIdFacturacion = Number(corrRes.recordset?.[0]?.id_facturacion);

    await pool.request()
      .input('id_otroscobros', sql.Numeric(10, 0), newIdOtros)
      .input('id_facturacion', sql.Numeric(10, 0), newIdFacturacion)
      .input('id_tipodocumento', sql.Numeric(10, 0), td)
      .input('factura', sql.Numeric(10, 0), Number(num_ref) || newIdFacturacion)
      .input('id_empresaservicio', sql.Numeric(10, 0), Number(id_empresaservicio))
      .input('concepto_cobro', sql.VarChar(100), String(concepto_cobro).trim().slice(0, 100))
      .input('numero_documento', sql.Numeric(10, 0), newIdFacturacion)
      .input('fecha_documento', sql.VarChar(10), fechaDocDmy)
      .input('uf', sql.Numeric(12, 2), numUf)
      .input('monto', sql.Numeric(14, 0), numMontoClp)
      .input('monto_uf', sql.Numeric(12, 2), numMontoUf)
      .input('observacion', sql.VarChar(1000), String(observacion || '').slice(0, 1000))
      .input('mf', sql.Numeric(10, 0), 0)
      .input('tipo_ref', sql.VarChar(20), String(tipo_ref || '').slice(0, 20))
      .input('num_ref', sql.VarChar(20), String(num_ref || '').slice(0, 20))
      .input('fecha_ref', sql.VarChar(10), toDmyString(fecha_ref))
      .input('cod_razon', sql.Numeric(10, 0), Number(cod_razon) || 0)
      .input('motivo', sql.VarChar(200), String(motivo || '').slice(0, 200))
      .input('nota', sql.VarChar(200), String(nota || '').slice(0, 200))
      .input('emitido', sql.VarChar(1), 'N')
      .input('tipoimpuesto', sql.VarChar(5), String(tipoimpuesto || 'AFE').slice(0, 5))
      .input('id_formapago', sql.Numeric(10, 0), Number(id_formapago) || 1)
      .query(`
        INSERT INTO dbo.facturacion_otro (
          id_otroscobros, id_facturacion, id_tipodocumento, factura,
          id_empresaservicio, concepto_cobro, numero_documento, fecha_documento,
          uf, monto, monto_uf, observacion, mf, tipo_ref, num_ref, fecha_ref,
          cod_razon, motivo, nota, emitido, tipoimpuesto, id_formapago
        ) VALUES (
          @id_otroscobros, @id_facturacion, @id_tipodocumento, @factura,
          @id_empresaservicio, @concepto_cobro, @numero_documento, @fecha_documento,
          @uf, @monto, @monto_uf, @observacion, @mf, @tipo_ref, @num_ref, @fecha_ref,
          @cod_razon, @motivo, @nota, @emitido, @tipoimpuesto, @id_formapago
        );
      `);

    let accionCasos = 'NINGUNA';

    // Lógica especial de Notas de Crédito (id_tipodocumento = 8) sobre Facturas de Casos
    if (td === 8 && id_facturacion_referencia && String(origen_referencia).toUpperCase() === 'CASOS') {
      const idFacRef = Number(id_facturacion_referencia);
      const razon = Number(cod_razon);

      if (razon === 1) {
        // cod_razon = 1: Anula Documento de Referencia -> Libera todos los casos a ENVIADO
        await pool.request()
          .input('id_fac', sql.Numeric(10, 0), idFacRef)
          .query(`
            DELETE FROM dbo.facturacion_enc WHERE id_facturacion = @id_fac;
            DELETE FROM dbo.facturacion_det WHERE id_facturacion = @id_fac;
            UPDATE dbo.muestras_detalle
            SET id_facturacion = 0,
                estado = 'ENVIADO',
                mf = 0
            WHERE id_facturacion = @id_fac;
          `);
        accionCasos = `Factura #${idFacRef} anulada: todos sus casos fueron liberados al estado 'ENVIADO'.`;
      } else if (razon === 3 && Array.isArray(casos_reversar_ids) && casos_reversar_ids.length > 0) {
        // cod_razon = 3: Corrige Montos -> Reversa selectiva de casos (marcareversa = 'S')
        const cleanCasosIds = casos_reversar_ids.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
        if (cleanCasosIds.length > 0) {
          await pool.request()
            .input('id_fac', sql.Numeric(10, 0), idFacRef)
            .input('id_nc', sql.Numeric(10, 0), newIdFacturacion)
            .input('id_otros', sql.Numeric(10, 0), newIdOtros)
            .query(`
              UPDATE dbo.muestras_detalle
              SET marcareversa = 'S',
                  id_facturacionnc = @id_nc,
                  id_otroscobros = @id_otros
              WHERE id_facturacion = @id_fac
                AND id_caso IN (${cleanCasosIds.join(',')});
            `);
          accionCasos = `Se marcaron ${cleanCasosIds.length} caso(s) con marcareversa = 'S' en la factura #${idFacRef}.`;
        }
      } else if (razon === 2) {
        accionCasos = `Nota de Crédito por corrección de texto registrada (casos de factura #${idFacRef} se mantienen en 'FACTURADO').`;
      }
    }

    return {
      id_otroscobros: newIdOtros,
      id_facturacion: newIdFacturacion,
      id_tipodocumento: td,
      monto_uf: numMontoUf,
      monto: numMontoClp,
      accionCasos
    };
  }

  // ==========================================================================
  // 4. EXPORTACIÓN FACTURACIÓN ELECTRÓNICA DTE (5 FLUJOS - 35 COLUMNAS)
  // ==========================================================================

  /**
   * Lista los documentos disponibles para los 5 flujos DTE:
   * - FEA_CASOS (fac_consulta_facturaelectronica_exporta)
   * - FEA_OTROS (fac_consulta_facturaelectronica_exporta_fea)
   * - FEE       (fac_consulta_facturaelectronica_exporta_fee)
   * - NCE       (fac_consulta_facturaelectronica_exporta_nc)
   * - NDE       (fac_consulta_facturaelectronica_exporta_nd)
   */
  async listarDocumentosDteSalud({ flujo = 'FEA_CASOS', solo_pendientes = true, busqueda = '' } = {}) {
    const pool = await getConnectionSalud();
    const f = String(flujo || 'FEA_CASOS').toUpperCase();

    let spName = 'fac_consulta_facturaelectronica_exporta';
    if (f === 'FEA_OTROS') spName = 'fac_consulta_facturaelectronica_exporta_fea';
    else if (f === 'FEE') spName = 'fac_consulta_facturaelectronica_exporta_fee';
    else if (f === 'NCE') spName = 'fac_consulta_facturaelectronica_exporta_nc';
    else if (f === 'NDE') spName = 'fac_consulta_facturaelectronica_exporta_nd';

    const result = f === 'FEA_CASOS'
      ? { recordset: await exportacion.consultarListadoFacturasCasos(pool, { estado: solo_pendientes ? 'NO emitidos' : 'Todos' }) }
      : await pool.request().query(`EXEC dbo.${spName}`);
    let rows = result.recordset || [];

    if (solo_pendientes) {
      rows = rows.filter((r) => String(r.emitido || 'N').trim().toUpperCase() !== 'S');
    }

    if (busqueda && String(busqueda).trim() !== '') {
      const q = String(busqueda).trim().toLowerCase();
      rows = rows.filter((r) =>
        String(r.id_facturacion || '').includes(q) ||
        String(r.nombre_empresaservicios || '').toLowerCase().includes(q) ||
        String(r.rut_empresaservicios || '').toLowerCase().includes(q) ||
        String(r.glosa || r.concepto_cobro || '').toLowerCase().includes(q)
      );
    }

    return rows.slice(0, 500).map((r) => {
      const isCasos = f === 'FEA_CASOS';
      const neto = isCasos
        ? round0(round2(r.uf_totalfac || 0) * Number(r.uf || 0))
        : round0(r.monto || 0);
      const esExento = f === 'FEE' || (f === 'NCE' && String(r.tipoimpuesto || '').trim().toUpperCase() === 'EXE');
      const totaldoc = esExento ? neto : round0(neto * 1.19);

      return {
        ...r,
        flujo: f,
        neto_calculado: neto,
        totaldoc_calculado: totaldoc,
        es_exento: esExento
      };
    });
  }

  /**
   * Construye el archivo plano CSV/TXT de 35 columnas (cursor felectronicatxt)
   * respetando el desglose multi-línea de OC/HES en FEA_CASOS.
   */
  async generarArchivoPlanoDteSalud({ flujo = 'FEA_CASOS', ids_facturacion = [], marcar_emitido = false }) {
    const docs = await this.listarDocumentosDteSalud({ flujo, solo_pendientes: false });
    const cleanIds = new Set((ids_facturacion || []).map((id) => Number(id)));
    const selectedDocs = cleanIds.size > 0
      ? docs.filter((d) => cleanIds.has(Number(d.id_facturacion)))
      : docs.filter((d) => String(d.emitido || 'N').trim().toUpperCase() !== 'S');

    if (selectedDocs.length === 0) {
      throw new Error('No hay documentos seleccionados para exportar a DTE.');
    }

    const pool = await getConnectionSalud();
    const f = String(flujo || 'FEA_CASOS').toUpperCase();

    // Las 35 columnas exactas de felectronicatxt en Visual FoxPro
    const DTE_HEADERS = [
      'prefactura', 'n_td', 'ffac', 'oficina', 'id_cli',
      'id_dir', 'id_gir', 'id_formapago', 'banco', 'documento',
      'ocompra', 'totaldoc', 'cantidad', 'claseserv', 'tiposerv',
      'detalle', 'neto', 'oficargo', 'proyecto', 'rut_cli',
      'nom_cli', 'nom_dir', 'dir', 'id_ciu', 'ciudad',
      'id_com', 'nom_com', 'nom_gir', 'nom_fp', 'tipo_ref',
      'num_ref', 'fecha_ref', 'cod_razon', 'motivo', 'nota'
    ];

    const dteRows = [];

    for (const doc of selectedDocs) {
      const idFac = Number(doc.id_facturacion);
      const dirComercial = String(doc.direccion_comercial || doc.nombre_direccion || '').trim().slice(0, 100);
      const notaFormatted = doc.nota && String(doc.nota).trim() !== ''
        ? `Nota: ${String(doc.nota).trim()}`
        : '';

      if (f === 'FEA_CASOS') {
        const neto = doc.neto_calculado;
        const totaldoc = doc.totaldoc_calculado;

        // Línea 1: Principal del documento
        dteRows.push({
          prefactura: idFac,
          n_td: 'FEA',
          ffac: String(doc.fecha_facturacion || '').trim(),
          oficina: 'Casa Matriz',
          id_cli: Number(doc.id_empresaservicio || 0),
          id_dir: Number(doc.id_direccion || 0),
          id_gir: Number(doc.id_giro || 0),
          id_formapago: Number(doc.id_formapago || 1),
          banco: 'Banco',
          documento: 'Documento',
          ocompra: '',
          totaldoc,
          cantidad: 1,
          claseserv: String(doc.nombre_anegocio || 'SALUD').trim(),
          tiposerv: 'ADL',
          detalle: String(doc.glosa || '').trim(),
          neto,
          oficargo: 'Casa Matriz',
          proyecto: 'Laboratorio',
          rut_cli: String(doc.rut_empresaservicios || '').trim(),
          nom_cli: String(doc.nombre_empresaservicios || '').trim().slice(0, 100),
          nom_dir: dirComercial,
          dir: dirComercial,
          id_ciu: Number(doc.id_ciudad || 0),
          ciudad: String(doc.nombre_ciudad || '').trim().slice(0, 40),
          id_com: Number(doc.id_comunaef || 0),
          nom_com: String(doc.nombre_comunaef || '').trim().slice(0, 40),
          nom_gir: String(doc.nombre_giro || '').trim().slice(0, 100),
          nom_fp: String(doc.nombre_formapago || '').trim().slice(0, 30),
          tipo_ref: '',
          num_ref: '',
          fecha_ref: '',
          cod_razon: 0,
          motivo: '',
          nota: notaFormatted
        });

        // Líneas adicionales por cada OC / HES en facturacion_ocompra (Regla 7.3)
        const ocRes = await pool.request()
          .input('id_facturacion', sql.Numeric(10, 0), idFac)
          .query(`
            SELECT ocompra, ocompra_fecha, referencia, tipo, orden
            FROM dbo.facturacion_ocompra
            WHERE id_facturacion = @id_facturacion
            ORDER BY orden ASC;
          `);

        for (const oc of ocRes.recordset || []) {
          if (!oc.ocompra || String(oc.ocompra).trim() === '') continue;
          dteRows.push({
            prefactura: idFac,
            n_td: 'FEA',
            ffac: String(doc.fecha_facturacion || '').trim(),
            oficina: 'Casa Matriz',
            id_cli: Number(doc.id_empresaservicio || 0),
            id_dir: Number(doc.id_direccion || 0),
            id_gir: Number(doc.id_giro || 0),
            id_formapago: Number(doc.id_formapago || 1),
            banco: 'Banco',
            documento: 'Documento',
            ocompra: '',
            totaldoc,
            cantidad: 0,
            claseserv: '',
            tiposerv: '',
            detalle: '',
            neto: 0,
            oficargo: '',
            proyecto: '',
            rut_cli: String(doc.rut_empresaservicios || '').trim(),
            nom_cli: String(doc.nombre_empresaservicios || '').trim().slice(0, 100),
            nom_dir: dirComercial,
            dir: dirComercial,
            id_ciu: Number(doc.id_ciudad || 0),
            ciudad: String(doc.nombre_ciudad || '').trim().slice(0, 40),
            id_com: Number(doc.id_comunaef || 0),
            nom_com: String(doc.nombre_comunaef || '').trim().slice(0, 40),
            nom_gir: String(doc.nombre_giro || '').trim().slice(0, 100),
            nom_fp: String(doc.nombre_formapago || '').trim().slice(0, 30),
            tipo_ref: String(oc.tipo || 'OC').trim(),
            num_ref: String(oc.ocompra || '').trim(),
            fecha_ref: String(oc.ocompra_fecha || '').trim(),
            cod_razon: 0,
            motivo: String(oc.referencia || '').trim(),
            nota: ''
          });
        }

        if (marcar_emitido) {
          await pool.request()
            .input('id_facturacion', sql.Numeric(10, 0), idFac)
            .query(`UPDATE dbo.facturacion_enc SET emitido = 'S' WHERE id_facturacion = @id_facturacion;`);
        }
      } else {
        // Flujos basados en facturacion_otro: FEA_OTROS, FEE, NCE, NDE
        const codigoTd = f === 'FEA_OTROS' ? 'FEA' : f;
        const tipoImp = f === 'NCE' ? String(doc.tipoimpuesto || 'AFE').trim().toUpperCase() : '';
        const motivoCompleto = f === 'NCE' || f === 'NDE'
          ? `${String(doc.motivo || '').trim()}${doc.observacion ? ' . ' + String(doc.observacion).trim() : ''}`
          : String(doc.motivo || '').trim();

        dteRows.push({
          prefactura: idFac,
          n_td: codigoTd,
          ffac: String(doc.fecha_documento || '').trim(),
          oficina: 'Casa Matriz',
          id_cli: Number(doc.id_empresaservicio || 0),
          id_dir: Number(doc.id_direccion || 0),
          id_gir: Number(doc.id_giro || 0),
          id_formapago: Number(doc.id_formapago || 1),
          banco: 'Banco',
          documento: 'Documento',
          ocompra: tipoImp,
          totaldoc: doc.totaldoc_calculado,
          cantidad: 1,
          claseserv: 'OTRAS VENTAS',
          tiposerv: 'ADL',
          detalle: String(doc.concepto_cobro || '').trim(),
          neto: doc.neto_calculado,
          oficargo: 'Casa Matriz',
          proyecto: 'Laboratorio',
          rut_cli: String(doc.rut_empresaservicios || '').trim(),
          nom_cli: String(doc.nombre_empresaservicios || '').trim().slice(0, 100),
          nom_dir: dirComercial,
          dir: dirComercial,
          id_ciu: Number(doc.id_ciudad || 0),
          ciudad: String(doc.nombre_ciudad || '').trim().slice(0, 40),
          id_com: Number(doc.id_comunaef || 0),
          nom_com: String(doc.nombre_comunaef || '').trim().slice(0, 40),
          nom_gir: String(doc.nombre_giro || '').trim().slice(0, 100),
          nom_fp: String(doc.nombre_formapago || '').trim().slice(0, 30),
          tipo_ref: String(doc.tipo_ref || '').trim(),
          num_ref: String(doc.num_ref || '').trim(),
          fecha_ref: String(doc.fecha_ref || '').trim(),
          cod_razon: Number(doc.cod_razon || 0),
          motivo: motivoCompleto,
          nota: notaFormatted
        });

        if (marcar_emitido) {
          await pool.request()
            .input('id_facturacion', sql.Numeric(10, 0), idFac)
            .query(`UPDATE dbo.facturacion_otro SET emitido = 'S' WHERE id_facturacion = @id_facturacion;`);
        }
      }
    }

    const escapeCsvField = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/\r?\n/g, ' ').trim();
      if (s.includes(',') || s.includes('"') || s.includes(';')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [
      DTE_HEADERS.join(','),
      ...dteRows.map((row) => DTE_HEADERS.map((col) => escapeCsvField(row[col])).join(','))
    ];

    return {
      flujo: f,
      total_documentos: selectedDocs.length,
      total_lineas_txt: dteRows.length,
      headers: DTE_HEADERS,
      rows: dteRows,
      csvContent: lines.join('\r\n')
    };
  }
}

export const facturacionSaludService = new FacturacionSaludService();
export default facturacionSaludService;

