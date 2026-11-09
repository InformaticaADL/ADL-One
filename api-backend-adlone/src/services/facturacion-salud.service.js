import sql, { getConnectionSalud, getSaludConnectionInfo } from '../config/databaseSalud.js';
import ExcelJS from 'exceljs';
import logger from '../utils/logger.js';

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
    es_oficial: false,
    glosa_default: 'Servicio de Análisis Susceptibilidad Antimicrobiana (SAMIC)'
  },
  {
    eligeprograma: 9,
    codigo: 'CALIGUS',
    nombre: 'Susceptibilidad Caligus',
    ids_programa: [19],
    es_oficial: false,
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

  /**
   * Construye el filtro SQL de elegibilidad de casos según programa, fechas y banderas (ensilaje / proa)
   */
  _buildCasosEligibilityConditions(request, {
    eligeprograma = 4,
    id_empresaservicio = null,
    fecha_rec_ini = null,
    fecha_rec_fin = null,
    fecha_inf_ini = null,
    fecha_inf_fin = null,
    ensilaje = false,
    proa = false
  }) {
    const prog = getProgramaConfig(eligeprograma);
    const progIdsList = prog.ids_programa.join(',');

    const conds = [
      `md.estado = 'ENVIADO'`,
      `ISNULL(md.id_facturacion, 0) = 0`,
      `md.clasifica IN ('CLIENTE', 'COMPLEMENT')`,
      `md.id_tecnica <> 647`,
      `m.id_programa IN (${progIdsList})`
    ];

    if (Number(eligeprograma) === 1) {
      // En PVA las vistas de prefacturación consideran técnicas <= 58 o asociadas al programa
      conds.push(`md.id_tecnica <= 58`);
    }

    if ([2, 3, 8].includes(Number(eligeprograma))) {
      conds.push(`(m.estado_caso IN ('FINAL', 'ENMIENDA-F', 'ENMIENFA-F'))`);
    }

    if (Number(eligeprograma) === 4) {
      if (ensilaje) {
        conds.push(`ISNULL(m.ensilaje, 'N') = 'S'`);
      } else if (proa) {
        conds.push(`ISNULL(m.proa, 'N') = 'S'`);
      } else {
        conds.push(`ISNULL(m.ensilaje, 'N') <> 'S'`);
      }
    }

    if (id_empresaservicio && Number(id_empresaservicio) > 0) {
      request.input('id_empresaservicio', sql.Numeric(10, 0), Number(id_empresaservicio));
      conds.push(`m.id_empresaservicio = @id_empresaservicio`);
    }

    const isoRecIni = toIsoDate(fecha_rec_ini);
    const isoRecFin = toIsoDate(fecha_rec_fin);
    if (isoRecIni) {
      request.input('fecha_rec_ini', sql.Date, isoRecIni);
      conds.push(`COALESCE(m.FechaRecepcion, TRY_CONVERT(date, m.fecha_recepcion, 103)) >= @fecha_rec_ini`);
    }
    if (isoRecFin) {
      request.input('fecha_rec_fin', sql.Date, isoRecFin);
      conds.push(`COALESCE(m.FechaRecepcion, TRY_CONVERT(date, m.fecha_recepcion, 103)) <= @fecha_rec_fin`);
    }

    const isoInfIni = toIsoDate(fecha_inf_ini);
    const isoInfFin = toIsoDate(fecha_inf_fin);
    if (isoInfIni) {
      request.input('fecha_inf_ini', sql.Date, isoInfIni);
      conds.push(`COALESCE(m.FechaInforme, TRY_CONVERT(date, m.fecha_informe, 103)) >= @fecha_inf_ini`);
    }
    if (isoInfFin) {
      request.input('fecha_inf_fin', sql.Date, isoInfFin);
      conds.push(`COALESCE(m.FechaInforme, TRY_CONVERT(date, m.fecha_informe, 103)) <= @fecha_inf_fin`);
    }

    return conds.join(' AND ');
  }

  /**
   * Lista las Empresas de Servicio que poseen casos elegibles para pre-facturar en los filtros dados
   */
  async getEmpresasConCasosElegibles(filters = {}) {
    const pool = await getConnectionSalud();
    const request = pool.request();
    const whereSql = this._buildCasosEligibilityConditions(request, filters);

    const query = `
      SET DATEFORMAT dmy;
      SELECT
        es.id_empresaservicio,
        LTRIM(RTRIM(es.rut_empresaservicios)) AS rut_empresaservicios,
        LTRIM(RTRIM(es.nombre_empresaservicios)) AS nombre_empresaservicios,
        LTRIM(RTRIM(ISNULL(es.precio_lista, 'Precio lista'))) AS precio_lista,
        LTRIM(RTRIM(ISNULL(es.precio_especial, 'N'))) AS precio_especial,
        ISNULL(es.factor_km, 0) AS factor_km,
        LTRIM(RTRIM(ISNULL(es.costo_op, 'N'))) AS costo_op,
        COUNT(DISTINCT m.id_caso) AS total_casos,
        COUNT(md.item) AS total_lineas,
        SUM(ISNULL(md.vtatotal, 0)) AS uf_total_actual,
        SUM(CASE WHEN ISNULL(md.mf, 0) = 1 THEN 1 ELSE 0 END) AS lineas_valorizadas,
        MIN(m.fecha_recepcion) AS min_fecha_recepcion,
        MAX(m.fecha_informe) AS max_fecha_informe
      FROM dbo.muestras m
      INNER JOIN dbo.muestras_detalle md ON m.id_caso = md.id_caso
      INNER JOIN dbo.mae_empresaservicios es ON m.id_empresaservicio = es.id_empresaservicio
      WHERE ${whereSql}
      GROUP BY
        es.id_empresaservicio,
        es.rut_empresaservicios,
        es.nombre_empresaservicios,
        es.precio_lista,
        es.precio_especial,
        es.factor_km,
        es.costo_op
      ORDER BY es.nombre_empresaservicios;
    `;

    const res = await request.query(query);
    return res.recordset || [];
  }

  /**
   * Obtiene los casos y su detalle técnico para una empresa y programa dados
   */
  async getCasosElegiblesPorEmpresa(filters = {}) {
    const pool = await getConnectionSalud();
    const request = pool.request();
    const whereSql = this._buildCasosEligibilityConditions(request, filters);

    const query = `
      SET DATEFORMAT dmy;
      SELECT
        m.id_caso,
        LTRIM(RTRIM(m.caso_adlab)) AS caso_adlab,
        m.id_empresaservicio,
        LTRIM(RTRIM(es.nombre_empresaservicios)) AS nombre_empresaservicios,
        LTRIM(RTRIM(es.rut_empresaservicios)) AS rut_empresaservicios,
        LTRIM(RTRIM(ISNULL(es.precio_lista, 'Precio lista'))) AS precio_lista,
        LTRIM(RTRIM(ISNULL(es.precio_especial, 'N'))) AS precio_especial,
        ISNULL(es.factor_km, 0) AS factor_km,
        LTRIM(RTRIM(ISNULL(es.costo_op, 'N'))) AS costo_op,
        m.id_empresa,
        LTRIM(RTRIM(ISNULL(emp.nombre_empresa, ''))) AS nombre_empresa,
        m.id_centro,
        LTRIM(RTRIM(ISNULL(mc.nombre_centro, m.nombre_centro))) AS nombre_centro,
        ISNULL(mc.id_tipoagua, 0) AS id_tipoagua,
        LTRIM(RTRIM(ISNULL(ta.nombre_tipoagua, 'N/A'))) AS nombre_tipoagua,
        ISNULL(mc.co_fijo, 0) AS co_fijo,
        LTRIM(RTRIM(ISNULL(mc.pm_ingreso, 'N'))) AS pm_ingreso,
        m.id_programa,
        LTRIM(RTRIM(ISNULL(mp.nombre_programa, m.nombre_programa))) AS nombre_programa,
        m.id_especie,
        LTRIM(RTRIM(ISNULL(esp.nombre_especie, ''))) AS nombre_especie,
        m.id_lugaranalisis,
        m.id_veterinario,
        LTRIM(RTRIM(ISNULL(m.cliente_entrega, 'Sin Veterinario'))) AS cliente_entrega,
        LTRIM(RTRIM(ISNULL(m.n_recepcion, ''))) AS n_recepcion,
        LTRIM(RTRIM(ISNULL(m.fecha_muestreo, ''))) AS fecha_muestreo,
        LTRIM(RTRIM(ISNULL(m.fecha_recepcion, ''))) AS fecha_recepcion,
        LTRIM(RTRIM(ISNULL(m.fecha_informe, ''))) AS fecha_informe,
        LTRIM(RTRIM(ISNULL(m.estado_caso, ''))) AS estado_caso,
        ISNULL(m.id_proyecto, 0) AS id_proyecto,
        LTRIM(RTRIM(ISNULL(m.ensilaje, 'N'))) AS ensilaje,
        LTRIM(RTRIM(ISNULL(m.proa, 'N'))) AS proa,
        LTRIM(RTRIM(ISNULL(m.multiplex, 'N'))) AS multiplex,
        LTRIM(RTRIM(ISNULL(m.apertura, 'N'))) AS apertura,
        ISNULL(m.sc_ncrotaltot, 0) AS sc_ncrotaltot,
        ISNULL(m.uf_totalfac, 0) AS uf_totalfac,
        LTRIM(RTRIM(ISNULL(m.ocompra, ''))) AS ocompra,
        LTRIM(RTRIM(ISNULL(m.ocompra_fecha, ''))) AS ocompra_fecha,
        md.item,
        md.id_tecnica,
        LTRIM(RTRIM(ISNULL(tec.nombre_tecnica, md.nombre_tecnica))) AS nombre_tecnica,
        ISNULL(tec.id_tipocobro, 2) AS id_tipocobro,
        LTRIM(RTRIM(ISNULL(tc.nombre_tipocobro, 'Muestra'))) AS nombre_tipocobro,
        md.id_organo,
        LTRIM(RTRIM(ISNULL(org.nombre_organo, md.nombre_organo))) AS nombre_organo,
        md.id_medios,
        LTRIM(RTRIM(ISNULL(med.nombre_medios, md.nombre_medios))) AS nombre_medios,
        ISNULL(med.muestrasxplaca, 1) AS muestrasxplaca,
        md.id_seccion,
        LTRIM(RTRIM(ISNULL(md.tipoingreso, 'INDIVIDUAL'))) AS tipoingreso,
        ISNULL(md.ind_nmuestras, 0) AS ind_nmuestras,
        ISNULL(md.pol_npooles, 0) AS pol_npooles,
        ISNULL(md.pol_npeces, 0) AS pol_npeces,
        ISNULL(md.n_analisis, 0) AS n_analisis,
        ISNULL(md.vtaunitario, 0) AS vtaunitario,
        ISNULL(md.vtatotal, 0) AS vtatotal,
        ISNULL(md.uf, 0) AS uf,
        ISNULL(md.usd, 0) AS usd,
        ISNULL(md.mf, 0) AS mf,
        LTRIM(RTRIM(ISNULL(md.sederiva, 'N'))) AS sederiva,
        LTRIM(RTRIM(ISNULL(md.pack, 'N'))) AS pack,
        ISNULL(md.id_pack, 0) AS id_pack,
        ISNULL(tec.precio_lista, 0) AS tec_precio_lista,
        ISNULL(tec.precio_lista_menos, 0) AS tec_precio_convenio,
        ISNULL(tec.precio_lista_mas, 0) AS tec_precio_recargo,
        ISNULL(tec.precio_lista_adl, 0) AS tec_precio_adl,
        ISNULL(tec.precio_lista_us, 0) AS tec_precio_usd,
        ISNULL(tec.vta_cal, 0) AS tec_vta_cal
      FROM dbo.muestras m
      INNER JOIN dbo.muestras_detalle md ON m.id_caso = md.id_caso
      INNER JOIN dbo.mae_empresaservicios es ON m.id_empresaservicio = es.id_empresaservicio
      LEFT JOIN dbo.mae_empresa emp ON m.id_empresa = emp.id_empresa
      LEFT JOIN dbo.mae_centro mc ON m.id_centro = mc.id_centro
      LEFT JOIN dbo.mae_tipoagua ta ON mc.id_tipoagua = ta.id_tipoagua
      LEFT JOIN dbo.mae_programa mp ON m.id_programa = mp.id_programa
      LEFT JOIN dbo.mae_especie esp ON m.id_especie = esp.id_especie
      LEFT JOIN dbo.mae_tecnica tec ON md.id_tecnica = tec.id_tecnica
      LEFT JOIN dbo.mae_tipocobro tc ON tec.id_tipocobro = tc.id_tipocobro
      LEFT JOIN dbo.mae_organo org ON md.id_organo = org.id_organo
      LEFT JOIN dbo.mae_medios med ON md.id_medios = med.id_medios
      WHERE ${whereSql}
      ORDER BY m.caso_adlab ASC, md.item ASC;
    `;

    const result = await request.query(query);
    const rows = result.recordset || [];

    const casosMap = new Map();
    for (const r of rows) {
      if (!casosMap.has(r.id_caso)) {
        casosMap.set(r.id_caso, {
          id_caso: r.id_caso,
          caso_adlab: r.caso_adlab,
          id_empresaservicio: r.id_empresaservicio,
          nombre_empresaservicios: r.nombre_empresaservicios,
          rut_empresaservicios: r.rut_empresaservicios,
          precio_lista: r.precio_lista,
          precio_especial: r.precio_especial,
          factor_km: r.factor_km,
          costo_op: r.costo_op,
          id_empresa: r.id_empresa,
          nombre_empresa: r.nombre_empresa,
          id_centro: r.id_centro,
          nombre_centro: r.nombre_centro,
          id_tipoagua: r.id_tipoagua,
          nombre_tipoagua: r.nombre_tipoagua,
          co_fijo: r.co_fijo,
          pm_ingreso: r.pm_ingreso,
          id_programa: r.id_programa,
          nombre_programa: r.nombre_programa,
          id_especie: r.id_especie,
          nombre_especie: r.nombre_especie,
          id_lugaranalisis: r.id_lugaranalisis,
          id_veterinario: r.id_veterinario,
          cliente_entrega: r.cliente_entrega,
          n_recepcion: r.n_recepcion,
          fecha_muestreo: r.fecha_muestreo,
          fecha_recepcion: r.fecha_recepcion,
          fecha_informe: r.fecha_informe,
          estado_caso: r.estado_caso,
          id_proyecto: r.id_proyecto,
          ensilaje: r.ensilaje,
          proa: r.proa,
          multiplex: r.multiplex,
          apertura: r.apertura,
          sc_ncrotaltot: r.sc_ncrotaltot,
          ocompra: r.ocompra,
          ocompra_fecha: r.ocompra_fecha,
          uf_totalfac: 0,
          lineas: []
        });
      }
      const casoObj = casosMap.get(r.id_caso);
      casoObj.lineas.push({
        item: r.item,
        id_tecnica: r.id_tecnica,
        nombre_tecnica: r.nombre_tecnica,
        id_tipocobro: r.id_tipocobro,
        nombre_tipocobro: r.nombre_tipocobro,
        id_organo: r.id_organo,
        nombre_organo: r.nombre_organo,
        id_medios: r.id_medios,
        nombre_medios: r.nombre_medios,
        muestrasxplaca: r.muestrasxplaca,
        id_seccion: r.id_seccion,
        tipoingreso: r.tipoingreso,
        ind_nmuestras: r.ind_nmuestras,
        pol_npooles: r.pol_npooles,
        pol_npeces: r.pol_npeces,
        n_analisis: r.n_analisis,
        vtaunitario: r.vtaunitario,
        vtatotal: r.vtatotal,
        uf: r.uf,
        usd: r.usd,
        mf: r.mf,
        sederiva: r.sederiva,
        pack: r.pack,
        id_pack: r.id_pack,
        tec_precio_lista: r.tec_precio_lista,
        tec_precio_convenio: r.tec_precio_convenio,
        tec_precio_recargo: r.tec_precio_recargo,
        tec_precio_adl: r.tec_precio_adl,
        tec_precio_usd: r.tec_precio_usd,
        tec_vta_cal: r.tec_vta_cal
      });
      casoObj.uf_totalfac = round2(casoObj.uf_totalfac + Number(r.vtatotal || 0));
    }

    return Array.from(casosMap.values());
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
   * Motor Principal de Valorización de Casos de Salud (Réplica exacta de fac_prefacturacion_new_v6.scx Command4.Click)
   */
  async valorizarCasosSalud({
    id_empresaservicio,
    eligeprograma = 4,
    fecha_rec_ini,
    fecha_rec_fin,
    fecha_inf_ini,
    fecha_inf_fin,
    ensilaje = false,
    proa = false,
    valor_uf = 38500,
    valor_usd = 950
  }) {
    const numUf = Number(valor_uf);
    const numUsd = Number(valor_usd) || 0;
    if (!numUf || numUf <= 0) {
      throw new Error('Debe ingresar un Valor UF válido mayor a 0 para ejecutar la valorización.');
    }
    if (Number(id_empresaservicio) === 500 && numUsd <= 0) {
      throw new Error('Para el cliente Benchmark Genetics (ID 500) es obligatorio ingresar el Valor USD (> 0).');
    }

    const pool = await getConnectionSalud();
    const casos = await this.getCasosElegiblesPorEmpresa({
      id_empresaservicio,
      eligeprograma,
      fecha_rec_ini,
      fecha_rec_fin,
      fecha_inf_ini,
      fecha_inf_fin,
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

    // Pre-cálculo ATBPlex por rango de muestras acumuladas por recepción (Regla 1: SDiag normal)
    const recepcionPoolsMap = new Map();
    if (progNum === 4 && !ensilaje && !proa) {
      for (const c of casos) {
        if (!c.n_recepcion) continue;
        for (const l of c.lineas) {
          const key = `${c.n_recepcion}__${l.id_tecnica}`;
          recepcionPoolsMap.set(key, (recepcionPoolsMap.get(key) || 0) + Number(l.pol_npooles || 0));
        }
      }
    }

    // Control de Jornada de Muestreo AquaGen (Regla 3.4: id_empresaservicio = 56, id_tecnica = 955)
    const jornadasCobradasSet = new Set();

    let lineasValorizadasCount = 0;
    let ufTotalGeneral = 0;

    for (const caso of casos) {
      let ufTotalCaso = 0;

      for (const linea of caso.lineas) {
        const idTec = Number(linea.id_tecnica);
        let xnAnalisis = await this._calcularCantidadAnalisis(pool, caso, linea);
        let xvtaUnitario = 0;
        let reglaUsada = 'Precio Lista Estándar';

        // --------------------------------------------------------------------
        // REGLA 10: Derivaciones o Secciones 10 / 13 con valor pre-asignado
        // --------------------------------------------------------------------
        if (
          (linea.sederiva === 'S' || Number(linea.id_seccion) === 10 || Number(linea.id_seccion) === 13) &&
          Number(linea.vtaunitario) > 0 &&
          Number(linea.n_analisis) > 0
        ) {
          xnAnalisis = Number(linea.n_analisis);
          xvtaUnitario = Number(linea.vtaunitario);
          reglaUsada = 'Derivación / Sección Pre-valorizada';
        }
        // --------------------------------------------------------------------
        // REGLA 3.1 / 3.2 / 3.3: Costo Operativo (id_tecnica = 282)
        // --------------------------------------------------------------------
        else if (idTec === 282) {
          if (progNum === 2 && caso.apertura !== 'S') {
            // 3.2 Costo Operativo Screening por Crotales
            xnAnalisis = Number(caso.sc_ncrotaltot || 0);
            const scRes = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('emp', sql.Numeric(10, 0), caso.id_empresa)
              .input('cen', sql.Numeric(10, 0), caso.id_centro)
              .input('esp', sql.Numeric(10, 0), caso.id_especie)
              .input('tec', sql.Numeric(10, 0), 282)
              .query(`EXEC dbo.consulta_listaprecio_unatecnica_screening @xid_empresaservicio=@es, @xid_empresa=@emp, @xid_centro=@cen, @xid_especie=@esp, @xid_tecnica=@tec`);
            if (scRes.recordset?.length > 0) {
              const rowSc = scRes.recordset[0];
              xvtaUnitario = String(linea.tipoingreso).toUpperCase() === 'POOLES'
                ? Number(rowSc.uf_pool || rowSc.uf_individual || 0)
                : Number(rowSc.uf_individual || 0);
            }
            reglaUsada = 'Costo Operativo Screening por Crotales';
          } else if (Number(caso.id_empresaservicio) === 383 && caso.pm_ingreso !== 'S' && Number(caso.co_fijo) > 0) {
            // 3.3 Regla Especial MOWI: Costo Fijo por Centro
            const coCasosRes = await pool.request()
              .input('la', sql.Numeric(10, 0), caso.id_lugaranalisis)
              .input('fm', sql.VarChar(10), caso.fecha_muestreo)
              .input('prog', sql.Numeric(10, 0), caso.id_programa)
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('cen', sql.Numeric(10, 0), caso.id_centro)
              .input('esp', sql.Numeric(10, 0), caso.id_especie)
              .query(`EXEC dbo.consulta_co_atv @xid_lugaranalisis=@la, @xfecha_muestreo=@fm, @xid_programa=@prog, @xid_empresaservicio=@es, @xid_centro=@cen, @xid_especie=@esp`);
            const numCasosVisita = Math.max(1, (coCasosRes.recordset || []).length);
            xnAnalisis = 1;
            xvtaUnitario = round2(Number(caso.co_fijo) / numCasosVisita);
            reglaUsada = 'Costo Operativo Fijo por Centro (MOWI)';
          } else {
            // 3.1 Costo Operativo por Planilla Terreno ATV (atv_planilla)
            const atvRes = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('la', sql.Numeric(10, 0), caso.id_lugaranalisis)
              .input('fm', sql.VarChar(10), caso.fecha_muestreo)
              .input('prog', sql.Numeric(10, 0), caso.id_programa)
              .input('cen', sql.Numeric(10, 0), caso.id_centro)
              .input('esp', sql.Numeric(10, 0), caso.id_especie)
              .query(`EXEC dbo.consulta_atv_planilla_sinfacturarxcaso @xid_empresaservicio=@es, @xid_lugaranalisis=@la, @xfecha_muestreo=@fm, @xid_programa=@prog, @xid_centro=@cen, @xid_especie=@esp`);
            if (atvRes.recordset?.length > 0) {
              const pl = atvRes.recordset[0];
              const factorKm = Number(caso.factor_km || 0);
              const xco =
                Number(pl.co_km || 0) * factorKm +
                Number(pl.co_peaje || 0) / numUf +
                Number(pl.co_transbordador || 0) / numUf +
                Number(pl.co_taxi || 0) / numUf +
                Number(pl.co_pasaje || 0) / numUf +
                Number(pl.co_extra || 0) +
                Number(pl.co_colacion || 0) / numUf +
                Number(pl.co_alojamiento || 0) / numUf +
                Number(pl.co_veterinario || 0);

              const coCasosRes = await pool.request()
                .input('la', sql.Numeric(10, 0), caso.id_lugaranalisis)
                .input('fm', sql.VarChar(10), caso.fecha_muestreo)
                .input('prog', sql.Numeric(10, 0), caso.id_programa)
                .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
                .input('cen', sql.Numeric(10, 0), caso.id_centro)
                .input('esp', sql.Numeric(10, 0), caso.id_especie)
                .query(`EXEC dbo.consulta_co_atv @xid_lugaranalisis=@la, @xfecha_muestreo=@fm, @xid_programa=@prog, @xid_empresaservicio=@es, @xid_centro=@cen, @xid_especie=@esp`);
              const numCasosVisita = Math.max(1, (coCasosRes.recordset || []).length);
              xnAnalisis = 1;
              xvtaUnitario = round2(xco / numCasosVisita);
              reglaUsada = 'Costo Operativo Visita Terreno ATV (Prorrateado)';
            } else {
              xnAnalisis = Number(linea.n_analisis || 1);
              xvtaUnitario = Number(linea.vtaunitario || 0);
              reglaUsada = 'Costo Operativo (Valor Manual / Sin Planilla Pendiente)';
            }
          }
        }
        // --------------------------------------------------------------------
        // REGLA 3.4: Jornada de Muestreo Screening AquaGen (id_tecnica = 955)
        // --------------------------------------------------------------------
        else if (idTec === 955 && Number(caso.id_empresaservicio) === 56) {
          const isPanguecoOrSenSen = [7421, 5610].includes(Number(caso.id_centro));
          const jornadaKey = isPanguecoOrSenSen
            ? `${caso.fecha_muestreo}`
            : `${caso.fecha_muestreo}__${caso.id_centro}`;

          if (jornadasCobradasSet.has(jornadaKey)) {
            xnAnalisis = 0;
            xvtaUnitario = 0;
            reglaUsada = 'Jornada AquaGen (Ya cobrada en caso hermano del día)';
          } else {
            jornadasCobradasSet.add(jornadaKey);
            xnAnalisis = 1;
            const jRes = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('emp', sql.Numeric(10, 0), caso.id_empresa)
              .input('cen', sql.Numeric(10, 0), caso.id_centro)
              .input('esp', sql.Numeric(10, 0), caso.id_especie)
              .input('tec', sql.Numeric(10, 0), 955)
              .query(`EXEC dbo.consulta_listaprecio_unatecnica_screening @xid_empresaservicio=@es, @xid_empresa=@emp, @xid_centro=@cen, @xid_especie=@esp, @xid_tecnica=@tec`);
            xvtaUnitario = jRes.recordset?.length > 0
              ? Number(jRes.recordset[0].uf_individual || linea.tec_precio_lista || 0)
              : Number(linea.tec_precio_lista || 0);
            reglaUsada = 'Jornada Muestreo Screening (AquaGen 1 por Fecha/Centro)';
          }
        }
        // --------------------------------------------------------------------
        // REGLA 1: PVA (eligeprograma = 1) — General vs Por Centro + Agua Mar/Dulce
        // --------------------------------------------------------------------
        else if (progNum === 1) {
          const tlRes = await pool.request()
            .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
            .query(`EXEC dbo.consulta_pva_tipolista @xid_empresaservicio = @es`);
          const tipoListaPva = String(tlRes.recordset?.[0]?.tipo_lista || 'General').trim();

          let pvaRow = null;
          if (tipoListaPva.toLowerCase().includes('centro')) {
            const rCen = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('tec', sql.Numeric(10, 0), idTec)
              .input('cen', sql.Numeric(10, 0), caso.id_centro)
              .query(`EXEC dbo.consulta_listaprecio_unatecnica_pva_porcentro @xid_empresaservicio=@es, @xid_tecnica=@tec, @xid_centro=@cen`);
            pvaRow = rCen.recordset?.[0];
          }
          if (!pvaRow) {
            const rGen = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('tec', sql.Numeric(10, 0), idTec)
              .query(`EXEC dbo.consulta_listaprecio_unatecnica_pva @xid_empresaservicio=@es, @xid_tecnica=@tec`);
            pvaRow = rGen.recordset?.[0];
          }

          if (pvaRow) {
            const esAguaDulce = [2, 4, 15, 16, 17].includes(Number(caso.id_tipoagua));
            xvtaUnitario = esAguaDulce
              ? Number(pvaRow.uf_ad || pvaRow.uf_am || 0)
              : Number(pvaRow.uf_am || pvaRow.uf_ad || 0);
            reglaUsada = `Tarifario PVA (${tipoListaPva} · ${esAguaDulce ? 'Agua Dulce' : 'Agua Mar'})`;
          } else {
            const fallback = await this._resolverPrecioBaseOLista(pool, caso, linea, numUf, numUsd);
            xvtaUnitario = fallback.unitarioUf;
            reglaUsada = fallback.regla;
          }
        }
        // --------------------------------------------------------------------
        // REGLA 8: Screening (eligeprograma = 2) — Simple vs Multiplex y Apertura
        // --------------------------------------------------------------------
        else if (progNum === 2) {
          if (caso.multiplex === 'S') {
            if (Number(linea.item) < 300 && idTec !== 958 && idTec !== 959) {
              // Líneas hijas de un Multiplex se fuerzan a 0 para no cobrar doble
              xnAnalisis = 0;
              xvtaUnitario = 0;
              reglaUsada = 'Screening Multiplex (Ítem Hijo Exento = 0 UF)';
            } else {
              const mpPriceRes = await pool.request()
                .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
                .input('emp', sql.Numeric(10, 0), caso.id_empresa)
                .input('cen', sql.Numeric(10, 0), caso.id_centro)
                .input('esp', sql.Numeric(10, 0), caso.id_especie)
                .input('tec', sql.Numeric(10, 0), idTec)
                .query(`EXEC dbo.consulta_listaprecio_unatecnica_screening_multiplex @xid_empresaservicio=@es, @xid_empresa=@emp, @xid_centro=@cen, @xid_especie=@esp, @xid_tecnica=@tec`);
              const rowMp = mpPriceRes.recordset?.[0];
              if (rowMp) {
                const esPool = String(linea.tipoingreso).toUpperCase() === 'POOLES';
                if (caso.apertura === 'S') {
                  xvtaUnitario = esPool ? Number(rowMp.uf_pool_ap || rowMp.uf_pool || 0) : Number(rowMp.uf_individual_ap || rowMp.uf_individual || 0);
                } else {
                  xvtaUnitario = esPool ? Number(rowMp.uf_pool || 0) : Number(rowMp.uf_individual || 0);
                }
                reglaUsada = `Screening Multiplex (${caso.apertura === 'S' ? 'Con Apertura' : 'Normal'})`;
              } else {
                const fallback = await this._resolverPrecioBaseOLista(pool, caso, linea, numUf, numUsd);
                xvtaUnitario = fallback.unitarioUf;
                reglaUsada = fallback.regla;
              }
            }
          } else {
            const scPriceRes = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('emp', sql.Numeric(10, 0), caso.id_empresa)
              .input('cen', sql.Numeric(10, 0), caso.id_centro)
              .input('esp', sql.Numeric(10, 0), caso.id_especie)
              .input('tec', sql.Numeric(10, 0), idTec)
              .query(`EXEC dbo.consulta_listaprecio_unatecnica_screening @xid_empresaservicio=@es, @xid_empresa=@emp, @xid_centro=@cen, @xid_especie=@esp, @xid_tecnica=@tec`);
            const rowSc = scPriceRes.recordset?.[0];
            if (rowSc) {
              const esPool = String(linea.tipoingreso).toUpperCase() === 'POOLES';
              if (caso.apertura === 'S') {
                xvtaUnitario = esPool ? Number(rowSc.uf_pool_ap || rowSc.uf_pool || 0) : Number(rowSc.uf_individual_ap || rowSc.uf_individual || 0);
              } else {
                xvtaUnitario = esPool ? Number(rowSc.uf_pool || 0) : Number(rowSc.uf_individual || 0);
              }
              reglaUsada = `Screening Simple (${caso.apertura === 'S' ? 'Con Apertura' : 'Normal'})`;
            } else {
              const fallback = await this._resolverPrecioBaseOLista(pool, caso, linea, numUf, numUsd);
              xvtaUnitario = fallback.unitarioUf;
              reglaUsada = fallback.regla;
            }
          }
        }
        // --------------------------------------------------------------------
        // REGLA 7: Contingencia ISA / PVS / SRS (eligeprograma = 3)
        // --------------------------------------------------------------------
        else if (progNum === 3) {
          const esSrs = Number(caso.id_programa) === 10;
          const spTipo = esSrs ? 'consulta_srs_tipolista' : 'consulta_cisa_tipolista';
          const spGen = esSrs ? 'consulta_listaprecio_unatecnica_srs' : 'consulta_listaprecio_unatecnica_cisa';
          const spCen = esSrs ? 'consulta_listaprecio_unatecnica_srs_porcentro' : 'consulta_listaprecio_unatecnica_cisa_porcentro';

          const tlRes = await pool.request()
            .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
            .query(`EXEC dbo.${spTipo} @xid_empresaservicio = @es`);
          const tipoLista = String(tlRes.recordset?.[0]?.tipo_lista || 'General').trim();

          let rowTarifa = null;
          if (tipoLista.toLowerCase().includes('centro')) {
            const rCen = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('tec', sql.Numeric(10, 0), idTec)
              .input('cen', sql.Numeric(10, 0), caso.id_centro)
              .query(`EXEC dbo.${spCen} @xid_empresaservicio=@es, @xid_tecnica=@tec, @xid_centro=@cen`);
            rowTarifa = rCen.recordset?.[0];
          }
          if (!rowTarifa) {
            const rGen = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('tec', sql.Numeric(10, 0), idTec)
              .query(`EXEC dbo.${spGen} @xid_empresaservicio=@es, @xid_tecnica=@tec`);
            rowTarifa = rGen.recordset?.[0];
          }

          if (rowTarifa && Number(rowTarifa.uf_pool) > 0) {
            xvtaUnitario = Number(rowTarifa.uf_pool);
            reglaUsada = `Tarifario ${esSrs ? 'SRS' : 'CISA/PVS'} (${tipoLista})`;
          } else {
            const fallback = await this._resolverPrecioBaseOLista(pool, caso, linea, numUf, numUsd);
            xvtaUnitario = fallback.unitarioUf;
            reglaUsada = fallback.regla;
          }
        }
        // --------------------------------------------------------------------
        // REGLAS EN SERVICIO DIAGNÓSTICO - ATV (eligeprograma = 4) E I+D (5)
        // --------------------------------------------------------------------
        else if (progNum === 4 || progNum === 5) {
          let resolved = false;

          // 5. Ensilaje (Normativo vs Derivación vs No Normativo)
          if (progNum === 4 && (ensilaje || caso.ensilaje === 'S')) {
            const ensRes = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('emp', sql.Numeric(10, 0), caso.id_empresa)
              .input('cen', sql.Numeric(10, 0), caso.id_centro)
              .input('tec', sql.Numeric(10, 0), idTec)
              .query(`EXEC dbo.ConsultaPrecioEnsilajeUnaEmpresa @xid_empresaservicio=@es, @xid_empresa=@emp, @xid_centro=@cen, @xid_tecnica=@tec`);
            const rowEns = ensRes.recordset?.[0];
            if (rowEns) {
              const coEnsRes = await pool.request()
                .input('la', sql.Numeric(10, 0), caso.id_lugaranalisis)
                .input('fm', sql.VarChar(10), caso.fecha_muestreo)
                .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
                .input('cen', sql.Numeric(10, 0), caso.id_centro)
                .query(`EXEC dbo.Consulta_CO_Ensalije @xid_lugaranalisis=@la, @xfecha_muestreo=@fm, @xid_empresaservicio=@es, @xid_centro=@cen`);
              const tieneCoOficial = (coEnsRes.recordset || []).length > 0;
              if (tieneCoOficial) {
                xvtaUnitario = Number(rowEns.uf_normativo || 0);
                reglaUsada = 'Ensilaje Normativo (Con Visita Oficial)';
              } else if (Number(caso.id_veterinario) === 33) {
                xvtaUnitario = Number(rowEns.uf_derivacion || 0);
                reglaUsada = 'Ensilaje Derivación (Enviado por Cliente)';
              } else {
                xvtaUnitario = Number(rowEns.uf_nonormativo || 0);
                reglaUsada = 'Ensilaje No Normativo (Muestreo Terreno ADL)';
              }
              resolved = true;
            }
          }

          // 6. PROA
          if (!resolved && progNum === 4 && (proa || caso.proa === 'S')) {
            const proaRes = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('emp', sql.Numeric(10, 0), caso.id_empresa)
              .input('cen', sql.Numeric(10, 0), caso.id_centro)
              .input('tec', sql.Numeric(10, 0), idTec)
              .query(`EXEC dbo.ConsultaPrecioProaUnaEmpresa @xid_empresaservicio=@es, @xid_empresa=@emp, @xid_centro=@cen, @xid_tecnica=@tec`);
            if (proaRes.recordset?.length > 0 && Number(proaRes.recordset[0].uf) > 0) {
              xvtaUnitario = Number(proaRes.recordset[0].uf);
              reglaUsada = 'Tarifario PROA';
              resolved = true;
            }
          }

          // 1. ATBPlex por Rango de Muestras acumuladas por Recepción
          if (!resolved && progNum === 4 && !ensilaje && !proa) {
            const rangoRes = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('tec', sql.Numeric(10, 0), idTec)
              .query(`EXEC dbo.consulta_listaprecio_tecnicas_porrangomuestras @xid_empresaservicio=@es, @xid_tecnica=@tec`);
            if (rangoRes.recordset?.length > 0) {
              const totalPoolsRec = recepcionPoolsMap.get(`${caso.n_recepcion}__${idTec}`) || Number(linea.pol_npooles || 0);
              const tramo = rangoRes.recordset.find(
                (t) => totalPoolsRec >= Number(t.rangodesde) && totalPoolsRec <= Number(t.rangohasta)
              );
              if (tramo && Number(tramo.valor) > 0) {
                xvtaUnitario = Number(tramo.valor);
                reglaUsada = `ATBPlex por Rango de Muestras (${tramo.rangodesde}-${tramo.rangohasta} pools)`;
                resolved = true;
              }
            }
          }

          // 2. Proyectos (id_proyecto > 0)
          if (!resolved && Number(caso.id_proyecto) > 0) {
            const proyRes = await pool.request()
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('proy', sql.Numeric(10, 0), caso.id_proyecto)
              .input('tec', sql.Numeric(10, 0), idTec)
              .query(`EXEC dbo.consulta_proyecto_facturar_det @xid_empresaservicio=@es, @xid_proyecto=@proy, @xid_tecnica=@tec`);
            if (proyRes.recordset?.length > 0) {
              const rowProy = proyRes.recordset[0];
              const esPool = String(linea.tipoingreso).toUpperCase() === 'POOLES';
              xvtaUnitario = esPool
                ? Number(rowProy.uf_pool || rowProy.uf_individual || 0)
                : Number(rowProy.uf_individual || rowProy.uf_pool || 0);
              reglaUsada = `Tarifario por Proyecto (#${caso.id_proyecto})`;
              resolved = true;
            }
          }

          // 3. Packs (pack = 'S' e id_pack > 0)
          if (!resolved && linea.pack === 'S' && Number(linea.id_pack) > 0) {
            const packRes = await pool.request()
              .input('pack', sql.Numeric(10, 0), linea.id_pack)
              .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
              .input('tec', sql.Numeric(10, 0), idTec)
              .query(`EXEC dbo.consulta_listaprecio_unatecnica_pack @xid_pack=@pack, @xid_empresaservicio=@es, @xid_tecnica=@tec`);
            if (packRes.recordset?.length > 0 && Number(packRes.recordset[0].valor) > 0) {
              xvtaUnitario = Number(packRes.recordset[0].valor);
              reglaUsada = `Tarifario Pack (#${linea.id_pack})`;
              resolved = true;
            }
          }

          // 4. Fallback a Precio Especial / Lista Estándar
          if (!resolved) {
            const base = await this._resolverPrecioBaseOLista(pool, caso, linea, numUf, numUsd);
            xvtaUnitario = base.unitarioUf;
            reglaUsada = base.regla;
          }
        }
        // --------------------------------------------------------------------
        // REGLA 9: SAMIC (eligeprograma = 8, id_programa = 18)
        // --------------------------------------------------------------------
        else if (progNum === 8) {
          const samicRes = await pool.request()
            .input('es', sql.Numeric(10, 0), caso.id_empresaservicio)
            .input('emp', sql.Numeric(10, 0), caso.id_empresa)
            .input('cen', sql.Numeric(10, 0), caso.id_centro)
            .input('tec', sql.Numeric(10, 0), idTec)
            .query(`EXEC dbo.consulta_listaprecio_unatecnica_samic @xid_empresaservicio=@es, @xid_empresa=@emp, @xid_centro=@cen, @xid_tecnica=@tec`);
          if (samicRes.recordset?.length > 0 && Number(samicRes.recordset[0].uf) > 0) {
            xvtaUnitario = Number(samicRes.recordset[0].uf);
            reglaUsada = 'Tarifario SAMIC (Cliente/Empresa/Centro)';
          } else {
            const base = await this._resolverPrecioBaseOLista(pool, caso, linea, numUf, numUsd);
            xvtaUnitario = base.unitarioUf;
            reglaUsada = base.regla;
          }
        }
        // --------------------------------------------------------------------
        // Susceptibilidad Caligus (eligeprograma = 9) e Investigación Lab (6)
        // --------------------------------------------------------------------
        else {
          if (progNum === 9 && Number(linea.tec_vta_cal) > 0) {
            xvtaUnitario = Number(linea.tec_vta_cal);
            reglaUsada = 'Tarifa Susceptibilidad Caligus';
          } else {
            const base = await this._resolverPrecioBaseOLista(pool, caso, linea, numUf, numUsd);
            xvtaUnitario = base.unitarioUf;
            reglaUsada = base.regla;
          }
        }

        const xvtatotal = round2(xnAnalisis * xvtaUnitario);
        registrarRegla(reglaUsada);

        // Persistir valorización en muestras_detalle (local database)
        await pool.request()
          .input('id_caso', sql.Numeric(10, 0), caso.id_caso)
          .input('item', sql.Numeric(10, 0), linea.item)
          .input('id_tecnica', sql.Numeric(10, 0), linea.id_tecnica)
          .input('n_analisis', sql.Numeric(10, 2), xnAnalisis)
          .input('vtaunitario', sql.Numeric(12, 4), xvtaUnitario)
          .input('vtatotal', sql.Numeric(12, 2), xvtatotal)
          .input('uf', sql.Numeric(12, 2), numUf)
          .input('usd', sql.Numeric(12, 2), numUsd)
          .query(`
            UPDATE dbo.muestras_detalle
            SET n_analisis = @n_analisis,
                vtaunitario = @vtaunitario,
                vtatotal = @vtatotal,
                uf = @uf,
                usd = @usd,
                mf = 1,
                valorizado = 'S'
            WHERE id_caso = @id_caso AND item = @item AND id_tecnica = @id_tecnica AND ISNULL(id_facturacion, 0) = 0;
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

      // Actualizar muestras.uf_totalcaso y muestras.uf_totalfac
      await pool.request()
        .input('id_caso', sql.Numeric(10, 0), caso.id_caso)
        .input('uf_total', sql.Numeric(12, 2), ufTotalCaso)
        .query(`
          UPDATE dbo.muestras
          SET uf_totalcaso = @uf_total,
              uf_totalfac = @uf_total
          WHERE id_caso = @id_caso;
        `);

      caso.uf_totalfac = ufTotalCaso;
      ufTotalGeneral = round2(ufTotalGeneral + ufTotalCaso);
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
   * Creación de Pre-Facturas Agrupadas según criterio (Réplica de fac_unaempresa_v5.scx Command4.Click "Crear Factura")
   * Criterios soportados: 'Na', 'Centro', 'Veterinario', 'Centro - Veterinario', 'Tipo de Agua', 'Tipo de Agua - Veterinario'
   */
  async crearPrefacturasSalud({
    id_empresaservicio,
    eligeprograma = 4,
    criterio_agrupacion = 'Na',
    casos_ids = [],
    fecha_facturacion,
    valor_uf = 38500,
    valor_usd = 0,
    id_formapago = 1,
    id_glosa = 1,
    glosa = '',
    observaciones = '',
    nota = '',
    mes = '',
    ano = '',
    fecha_proceso_ini = '',
    fecha_proceso_fin = '',
    fecha_informe_ini = '',
    fecha_informe_fin = '',
    ocompra = '',
    ocompra_fecha = '',
    referencia_oc = '',
    hes = '',
    hes_fecha = '',
    referencia_hes = ''
  }) {
    if (!Array.isArray(casos_ids) || casos_ids.length === 0) {
      throw new Error('Debe seleccionar al menos un caso valorizado para crear prefacturas.');
    }

    const pool = await getConnectionSalud();
    const progConfig = getProgramaConfig(eligeprograma);
    const numUf = Number(valor_uf) || 38500;
    const numUsd = Number(valor_usd) || 0;
    const fechaFacDmy = toDmyString(fecha_facturacion || new Date().toISOString().slice(0, 10));

    // Obtener información de los casos seleccionados y sus totales en muestras_detalle
    const cleanIds = casos_ids.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
    const casosQuery = `
      SELECT
        m.id_caso,
        LTRIM(RTRIM(m.caso_adlab)) AS caso_adlab,
        m.id_empresaservicio,
        m.id_programa,
        LTRIM(RTRIM(ISNULL(mp.nombre_programa, ''))) AS nombre_programa,
        m.id_centro,
        LTRIM(RTRIM(ISNULL(mc.nombre_centro, 'Sin Centro'))) AS nombre_centro,
        ISNULL(mc.id_tipoagua, 0) AS id_tipoagua,
        LTRIM(RTRIM(ISNULL(ta.nombre_tipoagua, 'General'))) AS nombre_tipoagua,
        LTRIM(RTRIM(ISNULL(m.cliente_entrega, 'Sin Veterinario'))) AS cliente_entrega,
        SUM(ISNULL(md.vtatotal, 0)) AS uf_caso
      FROM dbo.muestras m
      INNER JOIN dbo.muestras_detalle md ON m.id_caso = md.id_caso
      LEFT JOIN dbo.mae_programa mp ON m.id_programa = mp.id_programa
      LEFT JOIN dbo.mae_centro mc ON m.id_centro = mc.id_centro
      LEFT JOIN dbo.mae_tipoagua ta ON mc.id_tipoagua = ta.id_tipoagua
      WHERE m.id_caso IN (${cleanIds.join(',')})
        AND md.estado = 'ENVIADO'
        AND ISNULL(md.id_facturacion, 0) = 0
        AND md.clasifica IN ('CLIENTE', 'COMPLEMENT')
      GROUP BY
        m.id_caso,
        m.caso_adlab,
        m.id_empresaservicio,
        m.id_programa,
        mp.nombre_programa,
        m.id_centro,
        mc.nombre_centro,
        mc.id_tipoagua,
        ta.nombre_tipoagua,
        m.cliente_entrega
      HAVING SUM(ISNULL(md.vtatotal, 0)) > 0
      ORDER BY m.caso_adlab;
    `;

    const casosRes = await pool.request().query(casosQuery);
    const casosRows = casosRes.recordset || [];
    if (casosRows.length === 0) {
      throw new Error('Los casos seleccionados no tienen monto valorizado (> 0 UF) o ya fueron facturados.');
    }

    // Agrupar casos según criterio_agrupacion
    const groupsMap = new Map();
    for (const c of casosRows) {
      let groupKey = 'NA';
      let groupLabel = progConfig.nombre;
      switch (criterio_agrupacion) {
        case 'Centro':
          groupKey = `CEN_${c.id_centro}`;
          groupLabel = `Centro: ${c.nombre_centro}`;
          break;
        case 'Veterinario':
          groupKey = `VET_${c.cliente_entrega}`;
          groupLabel = `Veterinario: ${c.cliente_entrega}`;
          break;
        case 'Centro - Veterinario':
          groupKey = `CENVET_${c.id_centro}__${c.cliente_entrega}`;
          groupLabel = `${c.nombre_centro} · ${c.cliente_entrega}`;
          break;
        case 'Tipo de Agua':
          groupKey = `TAGUA_${c.id_tipoagua}`;
          groupLabel = `Agua: ${c.nombre_tipoagua}`;
          break;
        case 'Tipo de Agua - Veterinario':
          groupKey = `TAGUAVET_${c.id_tipoagua}__${c.cliente_entrega}`;
          groupLabel = `${c.nombre_tipoagua} · ${c.cliente_entrega}`;
          break;
        default:
          groupKey = `PROG_${c.id_programa}`;
          groupLabel = c.nombre_programa || progConfig.nombre;
          break;
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          groupKey,
          groupLabel,
          casos: [],
          uf_totalcaso: 0
        });
      }
      const grp = groupsMap.get(groupKey);
      grp.casos.push(c);
      grp.uf_totalcaso = round2(grp.uf_totalcaso + Number(c.uf_caso || 0));
    }

    const prefacturasCreadas = [];
    const now = new Date();
    const mesStr = mes || now.toLocaleString('es-CL', { month: 'long' }).toUpperCase();
    const anoStr = ano || String(now.getFullYear());

    for (const grp of groupsMap.values()) {
      // 1. Obtener siguiente id_facturacion desde Mae_id
      const idRes = await pool.request().query(`
        UPDATE dbo.Mae_id SET id_facturacion = ISNULL(id_facturacion, 0) + 1;
        SELECT TOP 1 id_facturacion FROM dbo.Mae_id;
      `);
      const newIdFacturacion = Number(idRes.recordset?.[0]?.id_facturacion);

      const ufTotalFac = round2(grp.uf_totalcaso);
      const pesoTotalFac = round0(ufTotalFac * numUf);
      const usdTotalFac = numUsd > 0 ? round2((ufTotalFac * numUf) / numUsd) : 0;
      const glosaFinal = (glosa || `${progConfig.glosa_default} (${grp.groupLabel})`).slice(0, 500);

      // 2. Insertar encabezado en facturacion_enc
      await pool.request()
        .input('id_facturacion', sql.Numeric(10, 0), newIdFacturacion)
        .input('id_empresaservicio', sql.Numeric(10, 0), Number(id_empresaservicio))
        .input('fecha_facturacion', sql.VarChar(10), fechaFacDmy)
        .input('uf_totalotrosing', sql.Numeric(12, 2), 0)
        .input('uf_totalotrosdes', sql.Numeric(12, 2), 0)
        .input('uf_totalcaso', sql.Numeric(12, 2), ufTotalFac)
        .input('uf_totalfac', sql.Numeric(12, 2), ufTotalFac)
        .input('uf', sql.Numeric(12, 2), numUf)
        .input('mf', sql.Numeric(10, 0), 0)
        .input('facturado_por', sql.VarChar(50), String(criterio_agrupacion || 'Na').slice(0, 50))
        .input('fecha_proceso_ini', sql.VarChar(10), toDmyString(fecha_proceso_ini || fechaFacDmy))
        .input('fecha_proceso_fin', sql.VarChar(10), toDmyString(fecha_proceso_fin || fechaFacDmy))
        .input('factura', sql.Numeric(10, 0), newIdFacturacion)
        .input('fecha_informe_ini', sql.VarChar(10), toDmyString(fecha_informe_ini || fechaFacDmy))
        .input('fecha_informe_fin', sql.VarChar(10), toDmyString(fecha_informe_fin || fechaFacDmy))
        .input('peso_totalfac', sql.Numeric(14, 0), pesoTotalFac)
        .input('id_formapago', sql.Numeric(10, 0), Number(id_formapago) || 1)
        .input('mes', sql.VarChar(20), String(mesStr).slice(0, 20))
        .input('id_glosa', sql.Numeric(10, 0), Number(id_glosa) || 1)
        .input('observaciones', sql.VarChar(500), String(observaciones || grp.groupLabel).slice(0, 500))
        .input('glosa', sql.VarChar(500), glosaFinal)
        .input('emitido', sql.VarChar(1), 'N')
        .input('ocompra', sql.VarChar(12), String(ocompra || '').slice(0, 12))
        .input('ocompra_fecha', sql.VarChar(10), toDmyString(ocompra_fecha))
        .input('nota', sql.VarChar(500), String(nota || '').slice(0, 500))
        .input('ano', sql.VarChar(4), String(anoStr).slice(0, 4))
        .input('usd', sql.Numeric(12, 2), numUsd)
        .input('usd_totalfac', sql.Numeric(12, 2), usdTotalFac)
        .query(`
          INSERT INTO dbo.facturacion_enc (
            id_facturacion, id_empresaservicio, fecha_facturacion,
            uf_totalotrosing, uf_totalotrosdes, uf_totalcaso, uf_totalfac,
            uf, mf, facturado_por, fecha_proceso_ini, fecha_proceso_fin,
            factura, fecha_informe_ini, fecha_informe_fin, peso_totalfac,
            id_formapago, mes, id_glosa, observaciones, glosa, emitido,
            ocompra, ocompra_fecha, nota, ano, usd, usd_totalfac, pdf, eliminado
          ) VALUES (
            @id_facturacion, @id_empresaservicio, @fecha_facturacion,
            @uf_totalotrosing, @uf_totalotrosdes, @uf_totalcaso, @uf_totalfac,
            @uf, @mf, @facturado_por, @fecha_proceso_ini, @fecha_proceso_fin,
            @factura, @fecha_informe_ini, @fecha_informe_fin, @peso_totalfac,
            @id_formapago, @mes, @id_glosa, @observaciones, @glosa, @emitido,
            @ocompra, @ocompra_fecha, @nota, @ano, @usd, @usd_totalfac, 'N', 'N'
          );
        `);

      // 3. Insertar detalle en facturacion_det y marcar muestras_detalle como FACTURADO
      let itemCounter = 1;
      for (const caso of grp.casos) {
        await pool.request()
          .input('id_facturacion', sql.Numeric(10, 0), newIdFacturacion)
          .input('id_caso', sql.Numeric(10, 0), caso.id_caso)
          .input('item', sql.Numeric(10, 0), itemCounter++)
          .input('vtatotal', sql.Numeric(12, 2), round2(caso.uf_caso))
          .query(`
            INSERT INTO dbo.facturacion_det (id_facturacion, id_caso, item, vtatotal)
            VALUES (@id_facturacion, @id_caso, @item, @vtatotal);

            UPDATE dbo.muestras_detalle
            SET id_facturacion = @id_facturacion,
                estado = 'FACTURADO',
                mf = 0
            WHERE id_caso = @id_caso
              AND estado = 'ENVIADO'
              AND ISNULL(id_facturacion, 0) = 0
              AND clasifica IN ('CLIENTE', 'COMPLEMENT');
          `);
      }

      // 4. Si se ingresó OC o HES, registrar en facturacion_ocompra
      if (ocompra && String(ocompra).trim() !== '') {
        await pool.request()
          .input('id_facturacion', sql.Numeric(10, 0), newIdFacturacion)
          .input('ocompra', sql.VarChar(50), String(ocompra).trim())
          .input('ocompra_fecha', sql.VarChar(10), toDmyString(ocompra_fecha || fechaFacDmy))
          .input('referencia', sql.VarChar(50), String(referencia_oc || 'Orden de Compra').slice(0, 50))
          .query(`
            INSERT INTO dbo.facturacion_ocompra (ocompra, ocompra_fecha, referencia, id_facturacion, tipo, orden, oc)
            VALUES (@ocompra, @ocompra_fecha, @referencia, @id_facturacion, 'OC', 1, LEFT(@ocompra, 20));
          `);
      }
      if (hes && String(hes).trim() !== '') {
        await pool.request()
          .input('id_facturacion', sql.Numeric(10, 0), newIdFacturacion)
          .input('ocompra', sql.VarChar(50), String(hes).trim())
          .input('ocompra_fecha', sql.VarChar(10), toDmyString(hes_fecha || fechaFacDmy))
          .input('referencia', sql.VarChar(50), String(referencia_hes || 'HES').slice(0, 50))
          .query(`
            INSERT INTO dbo.facturacion_ocompra (ocompra, ocompra_fecha, referencia, id_facturacion, tipo, orden, oc)
            VALUES (@ocompra, @ocompra_fecha, @referencia, @id_facturacion, 'HES', 2, LEFT(@ocompra, 20));
          `);
      }

      prefacturasCreadas.push({
        id_facturacion: newIdFacturacion,
        grupo: grp.groupLabel,
        total_casos: grp.casos.length,
        uf_totalfac: ufTotalFac,
        peso_totalfac: pesoTotalFac
      });
    }

    return {
      total_prefacturas_creadas: prefacturasCreadas.length,
      prefacturas: prefacturasCreadas
    };
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

  /**
   * Eliminar Prefactura y liberar casos a ENVIADO (fac_elimina_reprocesa_v2.scx)
   */
  async eliminarPrefacturaSalud(id_facturacion) {
    const pool = await getConnectionSalud();
    const idFac = Number(id_facturacion);

    await pool.request()
      .input('id_facturacion', sql.Numeric(10, 0), idFac)
      .query(`
        UPDATE dbo.muestras_detalle
        SET id_facturacion = 0,
            estado = 'ENVIADO',
            mf = 0
        WHERE id_facturacion = @id_facturacion;

        DELETE FROM dbo.facturacion_ing WHERE id_facturacion = @id_facturacion;
        DELETE FROM dbo.facturacion_des WHERE id_facturacion = @id_facturacion;
        DELETE FROM dbo.facturacion_ocompra WHERE id_facturacion = @id_facturacion;
        DELETE FROM dbo.facturacion_det WHERE id_facturacion = @id_facturacion;
        DELETE FROM dbo.facturacion_enc WHERE id_facturacion = @id_facturacion;
      `);

    return { deleted: true, id_facturacion: idFac };
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

    const result = await pool.request().query(`EXEC dbo.${spName}`);
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

