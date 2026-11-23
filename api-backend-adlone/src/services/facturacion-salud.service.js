import sql, { getConnectionSalud, getSaludConnectionInfo } from '../config/databaseSalud.js';
import sqlFact, { getConnectionFacturacion } from '../config/databaseFacturacion.js';
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

const FECHA_INICIO_REZAGADOS = '01/01/2022';

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
    const poolFact = await getConnectionFacturacion();
    const connInfo = getSaludConnectionInfo();

    const querySalud = `
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

      SELECT TOP 1 uf
      FROM dbo.facturacion_enc
      WHERE ISNULL(eliminado, 'N') <> 'S'
        AND uf BETWEEN 10000 AND 100000
      ORDER BY id_facturacion DESC;
    `;

    const queryFact = `
      SELECT
        COUNT(*) AS total_prefacturas,
        SUM(CASE WHEN ISNULL(emitido, 'N') <> 'S' THEN 1 ELSE 0 END) AS pendientes_emision,
        SUM(CASE WHEN ISNULL(emitido, 'N') = 'S' THEN 1 ELSE 0 END) AS emitidas_dte,
        SUM(CASE WHEN ISNULL(emitido, 'N') <> 'S' THEN ISNULL(uf_totalfac, 0) ELSE 0 END) AS uf_pendiente_emision,
        (
          SELECT TOP 1 uf
          FROM dbo.facturacion_enc
          WHERE ISNULL(eliminado, 'N') <> 'S'
            AND uf BETWEEN 10000 AND 100000
          ORDER BY id_facturacion DESC
        ) AS ultima_uf
      FROM dbo.facturacion_enc
      WHERE ISNULL(eliminado, 'N') <> 'S';

      SELECT
        tipo_documento AS id_tipodocumento,
        COUNT(*) AS total_docs,
        SUM(CASE WHEN ISNULL(emitido, 'N') <> 'S' THEN 1 ELSE 0 END) AS pendientes_dte,
        SUM(ISNULL(peso_totalfac, 0)) AS monto_total_clp,
        SUM(ISNULL(uf_totalfac, 0)) AS monto_total_uf
      FROM dbo.facturacion_otro
      WHERE ISNULL(eliminado, 'N') <> 'S'
      GROUP BY tipo_documento;
    `;

    const [resultSalud, resultFact] = await Promise.all([
      pool.request().query(querySalud),
      poolFact.request().query(queryFact),
    ]);
    const pendientesPorPrograma = resultSalud.recordsets[0] || [];
    const ultimaUfSalud = Number(resultSalud.recordsets[1]?.[0]?.uf || 0);
    const resumenPrefacturas = resultFact.recordsets[0]?.[0] || {};
    const resumenOtros = resultFact.recordsets[1] || [];

    const totalCasosPendientes = pendientesPorPrograma.reduce((acc, r) => acc + Number(r.total_casos || 0), 0);
    const totalLineasPendientes = pendientesPorPrograma.reduce((acc, r) => acc + Number(r.total_lineas || 0), 0);

    return {
      connection: { ...connInfo, facturacionDb: 'ADLFacturacion' },
      kpis: {
        totalCasosPendientes,
        totalLineasPendientes,
        prefacturasPendientesDte: Number(resumenPrefacturas.pendientes_emision || 0),
        prefacturasEmitidasDte: Number(resumenPrefacturas.emitidas_dte || 0),
        ufPendienteEmision: round2(resumenPrefacturas.uf_pendiente_emision || 0),
        ultimaUf: Number(resumenPrefacturas.ultima_uf || ultimaUfSalud || 38500),
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

  async _poolFacturacion() {
    return getConnectionFacturacion();
  }

  /**
   * Lee metadatos de empresas (dirección, giro, ciudad, comuna, forma de pago) desde LaboratorioADL (solo lectura).
   */
  async _cargarMetadatosEmpresas(idsEmpresas = []) {
    const cleanIds = [...new Set((idsEmpresas || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))];
    const map = new Map();
    if (cleanIds.length === 0) return map;

    const poolSalud = await this._pool();
    const res = await poolSalud.request().query(`
      SELECT
        es.id_empresaservicio,
        LTRIM(RTRIM(ISNULL(es.nombre_empresaservicios, ''))) AS nombre_empresaservicios,
        LTRIM(RTRIM(ISNULL(es.rut_empresaservicios, ''))) AS rut_empresaservicios,
        LTRIM(RTRIM(ISNULL(es.sigla, ''))) AS sigla,
        LTRIM(RTRIM(ISNULL(es.direccion_comercial, ''))) AS direccion_comercial,
        LTRIM(RTRIM(ISNULL(es.fono_empresaservicios, ''))) AS fono_empresaservicios,
        LTRIM(RTRIM(ISNULL(es.email_contacto, ''))) AS email_contacto,
        ISNULL(es.id_giro, 0) AS id_giro,
        LTRIM(RTRIM(ISNULL(g.nombre_giro, ''))) AS nombre_giro,
        ISNULL(es.id_direccion, 0) AS id_direccion,
        LTRIM(RTRIM(ISNULL(d.nombre_direccion, ''))) AS nombre_direccion,
        ISNULL(es.id_ciudad, 0) AS id_ciudad,
        LTRIM(RTRIM(ISNULL(ci.nombre_ciudad, ''))) AS nombre_ciudad,
        ISNULL(es.id_comunaef, 0) AS id_comunaef,
        LTRIM(RTRIM(ISNULL(co.nombre_comunaef, ''))) AS nombre_comunaef,
        ISNULL(es.id_formapago, 1) AS id_formapago_emp
      FROM dbo.mae_empresaservicios es
      LEFT JOIN dbo.mae_giro g ON g.id_giro = es.id_giro
      LEFT JOIN dbo.mae_direccion d ON d.id_direccion = es.id_direccion
      LEFT JOIN dbo.mae_ciudad ci ON ci.id_ciudad = es.id_ciudad
      LEFT JOIN dbo.mae_comunaef co ON co.id_comunaef = es.id_comunaef
      WHERE es.id_empresaservicio IN (${cleanIds.join(',')});
    `);
    for (const row of res.recordset || []) {
      map.set(Number(row.id_empresaservicio), row);
    }
    return map;
  }

  /**
   * Lee formas de pago desde LaboratorioADL (solo lectura).
   */
  async _cargarFormasPagoMap() {
    const poolSalud = await this._pool();
    const res = await poolSalud.request().query(`
      SELECT id_formapago, LTRIM(RTRIM(ISNULL(nombre_formapago, ''))) AS nombre_formapago
      FROM dbo.mae_formapago;
    `);
    const map = new Map();
    for (const row of res.recordset || []) {
      map.set(Number(row.id_formapago), row.nombre_formapago || '');
    }
    return map;
  }

  /**
   * Lista facturas de casos desde ADLFacturacion enriquecidas con catálogos de LaboratorioADL
   * para listado DTE y generación de archivo plano FE_CASOS.
   */
  async _listarFacturasCasosAdlf({ estado = 'NO emitidos', ids = null } = {}) {
    const poolFact = await this._poolFacturacion();
    const req = poolFact.request();
    const conds = ['ISNULL(fe.peso_totalfac, 0) > 0', 'ISNULL(fe.id_formapago, 0) > 0'];

    if (estado === 'Emitidos') conds.push(`ISNULL(fe.emitido, 'N') = 'S'`);
    else if (estado === 'Eliminado') conds.push(`ISNULL(fe.eliminado, 'N') = 'S'`);
    else if (estado !== 'Todos') conds.push(`ISNULL(fe.emitido, 'N') <> 'S' AND ISNULL(fe.eliminado, 'N') <> 'S'`);

    const cleanIds = Array.isArray(ids) ? ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0) : [];
    if (cleanIds.length > 0) {
      conds.push(`fe.id_facturacion IN (${cleanIds.join(',')})`);
    }

    const resEnc = await req.query(`
      SELECT TOP 500
        fe.id_facturacion, fe.factura, fe.id_empresaservicio,
        fe.nombre_empresaservicios, fe.rut_empresaservicios, fe.sigla,
        fe.fecha_facturacion, fe.uf_totalotrosing, fe.uf_totalotrosdes,
        fe.uf_totalcaso, fe.uf_totalfac, fe.uf, fe.mf, fe.facturado_por,
        fe.peso_totalfac, fe.id_formapago, fe.nombre_formapago,
        fe.mes, fe.id_glosa, fe.nombre_glosa, fe.observaciones,
        fe.glosa, fe.emitido, fe.ocompra, fe.ocompra_fecha, fe.nota, fe.eliminado
      FROM dbo.facturacion_enc fe
      WHERE ${conds.join(' AND ')}
      ORDER BY fe.id_facturacion DESC;
    `);
    const rows = resEnc.recordset || [];
    if (rows.length === 0) return [];

    const [empMap, fpMap] = await Promise.all([
      this._cargarMetadatosEmpresas(rows.map((r) => r.id_empresaservicio)),
      this._cargarFormasPagoMap()
    ]);

    return rows.map((r) => {
      const emp = empMap.get(Number(r.id_empresaservicio)) || {};
      const fpNombre = r.nombre_formapago || fpMap.get(Number(r.id_formapago)) || '';
      return {
        ...r,
        nombre_empresaservicios: r.nombre_empresaservicios || emp.nombre_empresaservicios || '',
        rut_empresaservicios: r.rut_empresaservicios || emp.rut_empresaservicios || '',
        sigla: r.sigla || emp.sigla || '',
        nombre_anegocio: 'SALUD',
        id_giro: Number(emp.id_giro || 0),
        nombre_giro: emp.nombre_giro || '',
        id_direccion: Number(emp.id_direccion || 0),
        nombre_direccion: emp.nombre_direccion || '',
        direccion_comercial: emp.direccion_comercial || emp.nombre_direccion || '',
        id_ciudad: Number(emp.id_ciudad || 0),
        nombre_ciudad: emp.nombre_ciudad || '',
        id_comunaef: Number(emp.id_comunaef || 0),
        nombre_comunaef: emp.nombre_comunaef || '',
        nombre_formapago: fpNombre
      };
    });
  }

  /**
   * Lista documentos de ADLFacturacion.dbo.facturacion_otro enriquecidos con metadatos de LaboratorioADL.
   */
  async _listarOtrosDocumentosAdlf({ id_tipodocumento = null, tipoimpuesto = null, estado = 'Todos', ids = null } = {}) {
    const poolFact = await this._poolFacturacion();
    const conds = [`ISNULL(fo.eliminado, 'N') <> 'S'`];
    if (id_tipodocumento !== null && id_tipodocumento !== undefined) {
      conds.push(`fo.id_tipodocumento = ${Number(id_tipodocumento)}`);
    }
    if (tipoimpuesto) {
      conds.push(`UPPER(LTRIM(RTRIM(ISNULL(fo.tipoimpuesto, 'AFE')))) = '${String(tipoimpuesto).toUpperCase().replace(/'/g, '')}'`);
    }
    if (estado === 'Emitidos') conds.push(`ISNULL(fo.emitido, 'N') = 'S'`);
    else if (estado === 'NO emitidos') conds.push(`ISNULL(fo.emitido, 'N') <> 'S'`);

    const cleanIds = Array.isArray(ids) ? ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0) : [];
    if (cleanIds.length > 0) {
      conds.push(`fo.id_facturacion IN (${cleanIds.join(',')})`);
    }

    const res = await poolFact.request().query(`
      SELECT TOP 500
        ISNULL(NULLIF(fo.id_otroscobros, 0), fo.id_facturacion) AS id_otroscobros,
        fo.id_facturacion,
        fo.id_tipodocumento,
        fo.factura,
        ISNULL(NULLIF(fo.numero_documento, 0), fo.id_facturacion) AS numero_documento,
        fo.id_empresaservicio,
        LTRIM(RTRIM(ISNULL(fo.nombre_empresaservicios, ''))) AS nombre_empresaservicios,
        LTRIM(RTRIM(ISNULL(fo.rut_empresaservicios, ''))) AS rut_empresaservicios,
        LTRIM(RTRIM(ISNULL(NULLIF(fo.concepto_cobro, ''), fo.glosa))) AS concepto_cobro,
        LTRIM(RTRIM(ISNULL(NULLIF(fo.fecha_documento, ''), fo.fecha))) AS fecha_documento,
        ISNULL(fo.uf, 0) AS uf,
        ISNULL(NULLIF(fo.monto_uf, 0), fo.uf_totalfac) AS monto_uf,
        ISNULL(NULLIF(fo.monto, 0), fo.peso_totalfac) AS monto,
        LTRIM(RTRIM(ISNULL(NULLIF(fo.observacion, ''), fo.observaciones))) AS observacion,
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
      WHERE ${conds.join(' AND ')}
      ORDER BY fo.id_facturacion DESC;
    `);
    const rows = res.recordset || [];
    if (rows.length === 0) return [];

    const [empMap, fpMap] = await Promise.all([
      this._cargarMetadatosEmpresas(rows.map((r) => r.id_empresaservicio)),
      this._cargarFormasPagoMap()
    ]);

    return rows.map((r) => {
      const emp = empMap.get(Number(r.id_empresaservicio)) || {};
      return {
        ...r,
        nombre_empresaservicios: r.nombre_empresaservicios || emp.nombre_empresaservicios || '',
        rut_empresaservicios: r.rut_empresaservicios || emp.rut_empresaservicios || '',
        id_giro: Number(emp.id_giro || 0),
        nombre_giro: emp.nombre_giro || '',
        id_direccion: Number(emp.id_direccion || 0),
        nombre_direccion: emp.nombre_direccion || '',
        direccion_comercial: emp.direccion_comercial || emp.nombre_direccion || '',
        id_ciudad: Number(emp.id_ciudad || 0),
        nombre_ciudad: emp.nombre_ciudad || '',
        id_comunaef: Number(emp.id_comunaef || 0),
        nombre_comunaef: emp.nombre_comunaef || '',
        nombre_formapago: fpMap.get(Number(r.id_formapago)) || ''
      };
    });
  }

  /**
   * Líneas (id_caso|item) ya prefacturadas/facturadas en ADLFacturacion (facturas activas).
   */
  async _getLineasFacturadasSet() {
    const poolFact = await this._poolFacturacion();
    const r = await poolFact.request().query(`
      SELECT DISTINCT fd.id_caso, fd.item
      FROM dbo.facturacion_det fd
      INNER JOIN dbo.facturacion_enc fe ON fe.id_facturacion = fd.id_facturacion
      WHERE ISNULL(fe.eliminado, 'N') <> 'S';
    `);
    const set = new Set();
    for (const row of r.recordset || []) {
      set.add(`${Number(row.id_caso)}|${Number(row.item)}`);
    }
    return set;
  }

  /**
   * Valorizaciones guardadas en ADLFacturacion.dbo.facturacion_valorizacion para los casos dados.
   */
  async _getValorizacionesMap(idsCasos = []) {
    const mapa = new Map();
    if (!idsCasos.length) return mapa;
    const poolFact = await this._poolFacturacion();
    for (const trozo of enTrozos(idsCasos, 400)) {
      const r = await poolFact.request().query(`
        SELECT id_caso, item, id_tecnica, n_analisis, vtaunitario, vtatotal, uf, usd, mf, regla_aplicada, ind_nmuestras, pol_npooles
        FROM dbo.facturacion_valorizacion
        WHERE id_caso IN (${trozo.join(',')});
      `);
      for (const row of r.recordset || []) {
        mapa.set(`${Number(row.id_caso)}|${Number(row.item)}|${Number(row.id_tecnica)}`, row);
      }
    }
    return mapa;
  }

  /**
   * Persiste en ADLFacturacion.dbo.facturacion_valorizacion las líneas valorizadas de un conjunto de casos.
   */
  async _guardarValorizaciones(casos = [], { id_empresaservicio = 0, eligeprograma = 4, numUf = 0, numUsd = 0 } = {}) {
    if (!casos.length) return;
    const poolFact = await this._poolFacturacion();
    const tx = new sqlFact.Transaction(poolFact);
    await tx.begin();
    try {
      const ids = [...new Set(casos.map((c) => Number(c.id_caso)).filter((n) => Number.isFinite(n) && n > 0))];
      for (const trozo of enTrozos(ids, 400)) {
        await new sqlFact.Request(tx).query(`DELETE FROM dbo.facturacion_valorizacion WHERE id_caso IN (${trozo.join(',')});`);
      }

      const filas = [];
      for (const c of casos) {
        const idEmp = Number(c.id_empresaservicio || id_empresaservicio || 0);
        for (const l of c.lineas || []) {
          if (Number(l.mf) !== 1) continue;
          filas.push({
            id_caso: Number(c.id_caso),
            item: Number(l.item),
            id_tecnica: Number(l.id_tecnica),
            id_empresaservicio: idEmp,
            eligeprograma: Number(eligeprograma || 4),
            n_analisis: Number(l.n_analisis) || 0,
            vtaunitario: Number(l.vtaunitario) || 0,
            vtatotal: Number(l.vtatotal) || 0,
            uf: Number(l.uf ?? numUf) || 0,
            usd: Number(l.usd ?? numUsd) || 0,
            mf: 1,
            regla_aplicada: String(l.regla_aplicada || '').slice(0, 200),
            ind_nmuestras: Number(l.ind_nmuestras) || 0,
            pol_npooles: Number(l.pol_npooles) || 0,
          });
        }
      }

      for (const f of filas) {
        await new sqlFact.Request(tx)
          .input('id_caso', sqlFact.Numeric(10, 0), f.id_caso)
          .input('item', sqlFact.Int, f.item)
          .input('id_tecnica', sqlFact.Numeric(10, 0), f.id_tecnica)
          .input('id_empresaservicio', sqlFact.Numeric(10, 0), f.id_empresaservicio)
          .input('eligeprograma', sqlFact.Int, f.eligeprograma)
          .input('n_analisis', sqlFact.Numeric(12, 2), f.n_analisis)
          .input('vtaunitario', sqlFact.Numeric(14, 4), f.vtaunitario)
          .input('vtatotal', sqlFact.Numeric(14, 4), f.vtatotal)
          .input('uf', sqlFact.Numeric(14, 4), f.uf)
          .input('usd', sqlFact.Numeric(14, 4), f.usd)
          .input('mf', sqlFact.Int, f.mf)
          .input('regla', sqlFact.VarChar(200), f.regla_aplicada)
          .input('ind', sqlFact.Numeric(10, 0), f.ind_nmuestras)
          .input('pol', sqlFact.Numeric(10, 0), f.pol_npooles)
          .query(`
            INSERT INTO dbo.facturacion_valorizacion (
              id_caso, item, id_tecnica, id_empresaservicio, eligeprograma,
              n_analisis, vtaunitario, vtatotal, uf, usd, mf, regla_aplicada, ind_nmuestras, pol_npooles
            ) VALUES (
              @id_caso, @item, @id_tecnica, @id_empresaservicio, @eligeprograma,
              @n_analisis, @vtaunitario, @vtatotal, @uf, @usd, @mf, @regla, @ind, @pol
            );
          `);
      }

      await tx.commit();
    } catch (err) {
      try { await tx.rollback(); } catch { /* ignore */ }
      throw err;
    }
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
    const incluirRezagados = Boolean(filters.incluir_rezagados);
    const iniPeriodoIso = toIsoDate(ini);
    const rezagadosDesdeIso = toIsoDate(FECHA_INICIO_REZAGADOS);
    const iniConsulta = (incluirRezagados && (!iniPeriodoIso || iniPeriodoIso > rezagadosDesdeIso))
      ? FECHA_INICIO_REZAGADOS
      : ini;
    const sp = nombreSpCasos(filters.eligeprograma ?? 4, filters);
    const pool = await this._pool();

    const res = await pool.request()
      .input('es', sql.Numeric(10, 0), idEmpresa)
      .input('fi', sql.VarChar(10), iniConsulta)
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
          LTRIM(RTRIM(ISNULL(m.lote, ''))) AS lote,
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

    const [lineasFacturadas, valorizacionesMap] = await Promise.all([
      this._getLineasFacturadasSet(),
      this._getValorizacionesMap(idsCasos)
    ]);

    const txt = (v) => String(v ?? '').trim();
    // Algunos procedimientos (SAMIC) devuelven la misma columna dos veces (id_centro, id_empresa…) y el driver las junta en una lista [6745, 6745]:
    // convertida a número daba NaN y la tarifa SAMIC no se encontraba (las líneas quedaban en 0). Se toma el primer valor.
    const uno = (v) => (Array.isArray(v) ? v[0] : v);
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
        id_empresa: uno(sp0.id_empresa ?? base.id_empresa),
        nombre_empresa: dc.nombre_empresa || '',
        id_centro: uno(sp0.id_centro ?? base.id_centro),
        nombre_centro: dc.nombre_centro || '',
        id_tipoagua: dc.id_tipoagua ?? base.id_tipoagua ?? 0,
        nombre_tipoagua: dc.nombre_tipoagua || 'N/A',
        co_fijo: dc.co_fijo ?? 0,
        pm_ingreso: dc.pm_ingreso || 'N',
        id_programa: uno(sp0.id_programa ?? base.id_programa),
        nombre_programa: dc.nombre_programa || txt(sp0.nombre_programa),
        id_especie: uno(sp0.id_especie ?? base.id_especie),
        nombre_especie: dc.nombre_especie || '',
        lote: dc.lote || '',
        id_lugaranalisis: uno(sp0.id_lugaranalisis ?? base.id_lugaranalisis),
        id_veterinario: base.id_veterinario,
        cliente_entrega: dc.cliente_entrega || 'Sin Veterinario',
        n_recepcion: dc.n_recepcion || '',
        fecha_muestreo: dc.fecha_muestreo || txt(sp0.fecha_muestreo),
        fecha_recepcion: txt(sp0.fecha_recepcion),
        fecha_informe: txt(sp0.fecha_informe),
        es_rezagado: Boolean(
          incluirRezagados &&
          iniPeriodoIso &&
          toIsoDate(sp0.fecha_informe) &&
          toIsoDate(sp0.fecha_informe) < iniPeriodoIso
        ),
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
        if (lineasFacturadas.has(`${idCaso}|${Number(l.item)}`)) continue;
        const dl = datosLinea.get(`${idCaso}|${Number(l.item)}`) || {};
        const val = valorizacionesMap.get(`${idCaso}|${Number(l.item)}|${Number(l.id_tecnica)}`);
        const nAnalisis = val ? Number(val.n_analisis) || 0 : Number(l.n_analisis) || 0;
        const vtaUnitario = val ? Number(val.vtaunitario) || 0 : Number(l.vtaunitario) || 0;
        const vtaTotal = val ? Number(val.vtatotal) || 0 : Number(l.vtatotal) || 0;
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
          ind_nmuestras: val ? Number(val.ind_nmuestras) || 0 : Number(l.ind_nmuestras) || 0,
          pol_npooles: val ? Number(val.pol_npooles) || 0 : Number(l.pol_npooles) || 0,
          pol_npeces: Number(l.pol_npeces) || 0,
          n_analisis: nAnalisis,
          vtaunitario: vtaUnitario,
          vtatotal: vtaTotal,
          uf: val ? Number(val.uf) || 0 : (dl.uf ?? 0),
          usd: val ? Number(val.usd) || 0 : (dl.usd ?? 0),
          mf: val ? Number(val.mf) || 0 : (dl.mf ?? 0),
          regla_aplicada: val?.regla_aplicada || undefined,
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
        caso.uf_totalfac = round2(caso.uf_totalfac + vtaTotal);
      }
      if (caso.lineas.length > 0) {
        casos.push(caso);
      }
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
      const poolFact = await this._poolFacturacion();
      for (const c of casos) {
        const pools = Number(c.pol_npooles) || 0;
        const total = redondea(precio * pools, 3);
        const detRes = await pool.request()
          .input('caso', sql.Numeric(10, 0), Number(c.id_caso))
          .input('tec', sql.Numeric(10, 0), Number(c.id_tecnica))
          .query(`SELECT item FROM dbo.muestras_detalle WHERE id_caso = @caso AND estado = 'ENVIADO' AND id_tecnica = @tec AND id_facturacion = 0;`);
        for (const d of detRes.recordset || []) {
          await poolFact.request()
            .input('caso', sqlFact.Numeric(10, 0), Number(c.id_caso))
            .input('item', sqlFact.Int, Number(d.item))
            .input('tec', sqlFact.Numeric(10, 0), Number(c.id_tecnica))
            .input('es', sqlFact.Numeric(10, 0), Number(id_empresaservicio))
            .input('n', sqlFact.Numeric(12, 2), pools)
            .input('precio', sqlFact.Numeric(14, 4), precio)
            .input('total', sqlFact.Numeric(14, 4), total)
            .input('uf', sqlFact.Numeric(14, 4), valorUf)
            .input('usd', sqlFact.Numeric(14, 4), valorUsd)
            .input('pol', sqlFact.Numeric(10, 0), pools)
            .query(`
              DELETE FROM dbo.facturacion_valorizacion WHERE id_caso = @caso AND item = @item AND id_tecnica = @tec;
              INSERT INTO dbo.facturacion_valorizacion (
                id_caso, item, id_tecnica, id_empresaservicio, eligeprograma, n_analisis, vtaunitario, vtatotal, uf, usd, mf, regla_aplicada, pol_npooles
              ) VALUES (
                @caso, @item, @tec, @es, 4, @n, @precio, @total, @uf, @usd, 1, 'ATBPlex por tramo', @pol
              );
            `);
          lineas++;
        }
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

    const casosMap = new Map(casos.map((c) => [Number(c.id_caso), c]));
    const guardar282 = async (idCaso, unitario, cantidad, totalOverride = null) => {
      const casoObj = casosMap.get(Number(idCaso));
      if (!casoObj) return;
      for (const l of casoObj.lineas || []) {
        if (Number(l.id_tecnica) === 282) {
          l.n_analisis = cantidad;
          l.vtaunitario = unitario;
          l.vtatotal = totalOverride !== null ? totalOverride : redondea(cantidad * unitario, 3);
          l.uf = numUf;
          l.usd = numUsd;
          l.mf = 1;
          if (!l.regla_aplicada) l.regla_aplicada = 'Costo operativo agregado';
        }
      }
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
        await guardar282(caso.id_caso, unitario, n, n * unitario);
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
        const casoObj = casosMap.get(Number(fila.id_caso));
        if (casoObj) {
          for (const l of casoObj.lineas || []) {
            if (Number(l.id_tecnica) === 955) {
              l.ind_nmuestras = 1;
              l.n_analisis = 1;
              l.vtaunitario = unitario;
              l.vtatotal = unitario;
              l.uf = numUf;
              l.usd = numUsd;
              l.mf = 1;
              l.regla_aplicada = 'Jornada de muestreo agregada';
            }
          }
        }
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
    incluir_rezagados = false,
    valor_uf,
    valor_usd,
    uf,
    usd,
    casos_ids
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

    const todosLosCasos = await this.getCasosElegiblesPorEmpresa({
      id_empresaservicio,
      eligeprograma,
      fecha_proceso_ini,
      fecha_proceso_fin,
      ensilaje,
      proa,
      incluir_rezagados
    });

    const idsFiltro = Array.isArray(casos_ids) && casos_ids.length > 0
      ? new Set(casos_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))
      : null;
    const casos = idsFiltro ? todosLosCasos.filter((c) => idsFiltro.has(Number(c.id_caso))) : todosLosCasos;

    if (casos.length === 0) {
      return {
        casosValorizados: 0,
        lineasValorizadas: 0,
        ufTotalGeneral: 0,
        reglasAplicadas: {},
        casos: todosLosCasos
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

    // Cierre de la valorización: técnicas multiplex 958/959 y totales por caso en memoria + guardado en ADLFacturacion
    ufTotalGeneral = 0;
    for (const caso of casos) {
      for (const l of caso.lineas || []) {
        const tec = Number(l.id_tecnica);
        if (tec === 958 || tec === 959) {
          const pol = Number(l.pol_npooles) || 0;
          const n = Number(l.n_analisis) || 0;
          const vta = Number(l.vtaunitario) || 0;
          if (pol > 0) {
            l.n_analisis = pol;
            l.vtatotal = redondea(pol * vta, 3);
            l.mf = 1;
          } else if (n > 0) {
            l.pol_npooles = n;
            l.vtatotal = redondea(n * vta, 3);
            l.mf = 1;
          }
        }
        l.uf = numUf;
        l.usd = numUsd;
      }
      const totalCaso = redondea(
        (caso.lineas || []).filter((l) => Number(l.mf) === 1).reduce((a, l) => a + (Number(l.vtatotal) || 0), 0),
        3
      );
      caso.uf_totalfac = totalCaso;
      ufTotalGeneral = round2(ufTotalGeneral + totalCaso);
    }

    await this._guardarValorizaciones(casos, { id_empresaservicio, eligeprograma, numUf, numUsd });

    return {
      casosValorizados: casos.length,
      lineasValorizadas: lineasValorizadasCount,
      ufTotalGeneral,
      reglasAplicadas,
      casos: todosLosCasos
    };
  }

  /**
   * Ajuste Manual de Precio Unitario Caso a Caso: persiste en ADLFacturacion.dbo.facturacion_valorizacion
   */
  async actualizarLineaCasoManual({ id_caso, item, id_tecnica, n_analisis, vtaunitario }) {
    const poolSalud = await getConnectionSalud();
    const poolFact = await this._poolFacturacion();
    const idCasoNum = Number(id_caso);
    const itemNum = Number(item);
    const idTecNum = Number(id_tecnica);
    const cant = Number(n_analisis || 0);
    const unit = Number(vtaunitario || 0);
    const total = round2(cant * unit);

    // Asegurar que existan las líneas base del caso en facturacion_valorizacion para que la suma sea exacta
    const baseRes = await poolSalud.request()
      .input('id_caso', sql.Numeric(10, 0), idCasoNum)
      .query(`
        SELECT m.id_empresaservicio, md.item, md.id_tecnica, md.n_analisis, md.vtaunitario, md.vtatotal, md.uf, md.usd
        FROM dbo.muestras m
        INNER JOIN dbo.muestras_detalle md ON m.id_caso = md.id_caso
        WHERE md.id_caso = @id_caso AND md.clasifica IN ('CLIENTE', 'COMPLEMENT') AND ISNULL(md.id_facturacion, 0) = 0;
      `);

    const existentes = await this._getValorizacionesMap([idCasoNum]);
    for (const b of baseRes.recordset || []) {
      const k = `${idCasoNum}|${Number(b.item)}|${Number(b.id_tecnica)}`;
      if (!existentes.has(k) && (Number(b.item) !== itemNum || Number(b.id_tecnica) !== idTecNum)) {
        await poolFact.request()
          .input('id_caso', sqlFact.Numeric(10, 0), idCasoNum)
          .input('item', sqlFact.Int, Number(b.item))
          .input('id_tecnica', sqlFact.Numeric(10, 0), Number(b.id_tecnica))
          .input('id_emp', sqlFact.Numeric(10, 0), Number(b.id_empresaservicio || 0))
          .input('n', sqlFact.Numeric(12, 2), Number(b.n_analisis || 0))
          .input('vta', sqlFact.Numeric(14, 4), Number(b.vtaunitario || 0))
          .input('tot', sqlFact.Numeric(14, 4), Number(b.vtatotal || 0))
          .input('uf', sqlFact.Numeric(14, 4), Number(b.uf || 0))
          .input('usd', sqlFact.Numeric(14, 4), Number(b.usd || 0))
          .query(`
            INSERT INTO dbo.facturacion_valorizacion (id_caso, item, id_tecnica, id_empresaservicio, n_analisis, vtaunitario, vtatotal, uf, usd, mf, regla_aplicada)
            VALUES (@id_caso, @item, @id_tecnica, @id_emp, @n, @vta, @tot, @uf, @usd, 1, 'Valor previo');
          `);
      }
    }

    const idEmpCaso = Number(baseRes.recordset?.[0]?.id_empresaservicio || 0);
    await poolFact.request()
      .input('id_caso', sqlFact.Numeric(10, 0), idCasoNum)
      .input('item', sqlFact.Int, itemNum)
      .input('id_tecnica', sqlFact.Numeric(10, 0), idTecNum)
      .input('id_emp', sqlFact.Numeric(10, 0), idEmpCaso)
      .input('n_analisis', sqlFact.Numeric(12, 2), cant)
      .input('vtaunitario', sqlFact.Numeric(14, 4), unit)
      .input('vtatotal', sqlFact.Numeric(14, 4), total)
      .query(`
        DELETE FROM dbo.facturacion_valorizacion WHERE id_caso = @id_caso AND item = @item AND id_tecnica = @id_tecnica;
        INSERT INTO dbo.facturacion_valorizacion (
          id_caso, item, id_tecnica, id_empresaservicio, n_analisis, vtaunitario, vtatotal, mf, regla_aplicada
        ) VALUES (
          @id_caso, @item, @id_tecnica, @id_emp, @n_analisis, @vtaunitario, @vtatotal, 1, 'Ajuste manual'
        );
      `);

    const sumRes = await poolFact.request()
      .input('id_caso', sqlFact.Numeric(10, 0), idCasoNum)
      .query(`
        SELECT SUM(ISNULL(vtatotal, 0)) AS nuevo_total
        FROM dbo.facturacion_valorizacion
        WHERE id_caso = @id_caso AND mf = 1;
      `);

    const nuevoTotalCaso = round2(sumRes.recordset?.[0]?.nuevo_total || 0);

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
  _rangoSpPrefactura({ fecha_proceso_ini, fecha_proceso_fin, incluir_rezagados = false } = {}) {
    const iniDmy = toDmyString(fecha_proceso_ini);
    const iniIso = toIsoDate(iniDmy);
    const rezagadosIso = toIsoDate(FECHA_INICIO_REZAGADOS);
    const ini = incluir_rezagados
      ? (iniIso && iniIso < rezagadosIso ? iniDmy : FECHA_INICIO_REZAGADOS)
      : (iniDmy || '01/01/2000');
    return {
      ini,
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
   * Arma las líneas valorizadas (mf = 1 en ADLFacturacion) de los casos seleccionados para agruparlas en pre-facturas.
   */
  async _armarLineasParaAgrupar({
    id_empresaservicio,
    eligeprograma = 4,
    fecha_proceso_ini = '',
    fecha_proceso_fin = '',
    incluir_rezagados = false,
    cleanIds = []
  }) {
    const todos = await this.getCasosElegiblesPorEmpresa({
      id_empresaservicio,
      eligeprograma,
      fecha_proceso_ini,
      fecha_proceso_fin,
      incluir_rezagados
    });
    const setIds = new Set(cleanIds);
    const lineas = [];
    const detallePorClave = new Map();

    for (const c of todos) {
      if (!setIds.has(Number(c.id_caso))) continue;
      for (const l of c.lineas || []) {
        if (Number(l.mf) !== 1) continue;
        const fila = {
          id_caso: Number(c.id_caso),
          caso_adlab: c.caso_adlab || '',
          n_recepcion: c.n_recepcion || '',
          fecha_recepcion: c.fecha_recepcion || '',
          fecha_muestreo: c.fecha_muestreo || '',
          fecha_informe: c.fecha_informe || '',
          id_programa: Number(c.id_programa) || 0,
          nombre_programa: c.nombre_programa || '',
          id_centro: Number(c.id_centro) || 0,
          nombre_centro: c.nombre_centro || '',
          id_tipoagua: Number(c.id_tipoagua) || 0,
          nombre_tipoagua: c.nombre_tipoagua || 'N/A',
          id_especie: Number(c.id_especie) || 0,
          nombre_especie: c.nombre_especie || '',
          lote: c.lote || '',
          cliente_entrega: c.cliente_entrega || 'Sin Veterinario',
          id_tecnica: Number(l.id_tecnica),
          nombre_tecnica: l.nombre_tecnica || '',
          nombre_organo: l.nombre_organo || '',
          nombre_medios: l.nombre_medios || '',
          multiplex: c.multiplex || 'N',
          item: Number(l.item),
          n_analisis: Number(l.n_analisis) || 0,
          vtaunitario: Number(l.vtaunitario) || 0,
          vtatotal: Number(l.vtatotal) || 0,
          uf: Number(l.uf) || 0,
          usd: Number(l.usd) || 0,
          regla_aplicada: l.regla_aplicada || '',
          id_empresaservicio: Number(c.id_empresaservicio || id_empresaservicio)
        };
        lineas.push(fila);
        detallePorClave.set(`${fila.id_caso}|${fila.id_tecnica}|${fila.item}`, fila);
      }
    }
    return { lineas, detallePorClave };
  }

  /**
   * "Pre-ver Facturación": muestra en qué pre-facturas quedarían los casos marcados, con N° provisorios consecutivos desde ADLFacturacion.
   */
  async previsualizarPrefacturasSalud({
    id_empresaservicio,
    eligeprograma = 4,
    criterio_agrupacion = 'Na',
    casos_ids = [],
    fecha_proceso_ini = '',
    fecha_proceso_fin = '',
    incluir_rezagados = false
  }) {
    const cleanIds = (casos_ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (cleanIds.length === 0) throw new Error('Debe marcar al menos un caso valorizado.');

    nombreSpPrever(eligeprograma, criterio_agrupacion);
    const poolFact = await this._poolFacturacion();
    const maxRes = await poolFact.request().query('SELECT ISNULL(MAX(id_facturacion), 0) AS max_id FROM dbo.facturacion_enc;');
    const idBase = Number(maxRes.recordset?.[0]?.max_id || 0);

    const { lineas } = await this._armarLineasParaAgrupar({
      id_empresaservicio,
      eligeprograma,
      fecha_proceso_ini,
      fecha_proceso_fin,
      incluir_rezagados,
      cleanIds
    });
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
   * "Facturar": crea las pre-facturas de los casos valorizados en ADLFacturacion (IDENTITY desde 1, sin saltos, sin Mae_id ni mf = 3).
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
    ocompra = '',
    ocompra_fecha = '',
    referencia_oc = '',
    hes = '',
    hes_fecha = '',
    referencia_hes = '',
    incluir_rezagados = false,
    usuario = ''
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
    const { ini, fin } = this._rangoSpPrefactura({ fecha_proceso_ini, fecha_proceso_fin, incluir_rezagados });
    nombreSpPrever(eligeprograma, criterio_agrupacion);

    const referencias = [...(ordenes_compra || [])];
    if (String(ocompra || '').trim()) {
      referencias.push({ tipo: 'OC', ocompra, ocompra_fecha, referencia: referencia_oc });
    }
    if (String(hes || '').trim()) {
      referencias.push({ tipo: 'HES', ocompra: hes, ocompra_fecha: hes_fecha, referencia: referencia_hes });
    }

    const { lineas: lineasOrigen, detallePorClave } = await this._armarLineasParaAgrupar({
      id_empresaservicio,
      eligeprograma,
      fecha_proceso_ini,
      fecha_proceso_fin,
      incluir_rezagados,
      cleanIds
    });

    const poolFact = await this._poolFacturacion();
    const maxRes = await poolFact.request().query('SELECT ISNULL(MAX(id_facturacion), 0) AS max_id FROM dbo.facturacion_enc;');
    const idBaseProv = Number(maxRes.recordset?.[0]?.max_id || 0);
    const { grupos, lineas } = agruparLineasPrefactura(lineasOrigen, criterio_agrupacion, cleanIds, idBaseProv);
    if (lineas.length === 0) {
      throw new Error('Los casos seleccionados no tienen líneas valorizadas pendientes de facturar (valoriza los casos antes de crear la factura).');
    }

    // Leer metadatos maestros de empresa, forma de pago y glosa desde LaboratorioADL (solo lectura)
    const poolSalud = await this._pool();
    const catRes = await poolSalud.request()
      .input('es', sql.Numeric(10, 0), Number(id_empresaservicio))
      .input('fp', sql.Numeric(10, 0), Number(id_formapago))
      .input('gl', sql.Numeric(10, 0), Number(id_glosa))
      .query(`
        SELECT LTRIM(RTRIM(ISNULL(nombre_empresaservicios, ''))) AS nombre_empresaservicios,
               LTRIM(RTRIM(ISNULL(rut_empresaservicios, ''))) AS rut_empresaservicios,
               LTRIM(RTRIM(ISNULL(sigla, ''))) AS sigla
        FROM dbo.mae_empresaservicios WHERE id_empresaservicio = @es;
        SELECT LTRIM(RTRIM(ISNULL(nombre_formapago, ''))) AS nombre_formapago
        FROM dbo.mae_formapago WHERE id_formapago = @fp;
        SELECT LTRIM(RTRIM(ISNULL(nombre_glosa, ''))) AS nombre_glosa
        FROM dbo.mae_glosa WHERE id_glosa = @gl;
      `);
    const empInfo = catRes.recordsets?.[0]?.[0] || {};
    const fpInfo = catRes.recordsets?.[1]?.[0] || {};
    const glInfo = catRes.recordsets?.[2]?.[0] || {};

    const tx = new sqlFact.Transaction(poolFact);
    await tx.begin();
    try {
      const mesTxt = textoMesFacturacion(mes, ano, fechaFacDmy);
      const glosaFinal = (String(glosa || '').trim() || progConfig.glosa_default).slice(0, 1000);
      const creadas = [];
      const mapaIdProvAReal = new Map();
      let totalLineasInsertadas = 0;

      for (const g of grupos) {
        const lineasGrupo = lineas
          .filter((l) => l.id_facturacion === g.id_facturacion)
          .map((l) => detallePorClave.get(`${l.id_caso}|${l.id_tecnica}|${l.item}`))
          .filter(Boolean);

        const uf = Number(lineasGrupo.find((l) => Number(l.uf) > 0)?.uf || 0);
        const usd = Number(lineasGrupo.find((l) => Number(l.usd) > 0)?.usd || 0);
        const ufTotal = redondea(lineasGrupo.reduce((a, l) => a + (Number(l.vtatotal) || 0), 0), 2);
        const pesoTotal = redondea(ufTotal * uf, 0);
        const usdTotal = Number(id_empresaservicio) === 500 && usd > 0 ? redondea(pesoTotal / redondea(usd, 2), 2) : 0;
        const firstLine = lineasGrupo[0] || {};

        const encIns = await new sqlFact.Request(tx)
          .input('id_empresaservicio', sqlFact.Numeric(10, 0), Number(id_empresaservicio))
          .input('nom_emp', sqlFact.VarChar(250), String(empInfo.nombre_empresaservicios || '').slice(0, 250))
          .input('rut_emp', sqlFact.VarChar(30), String(empInfo.rut_empresaservicios || '').slice(0, 30))
          .input('sigla', sqlFact.VarChar(50), String(empInfo.sigla || '').slice(0, 50))
          .input('fecha_facturacion', sqlFact.VarChar(10), fechaFacDmy)
          .input('uf_totalcaso', sqlFact.Numeric(14, 3), ufTotal)
          .input('uf_totalfac', sqlFact.Numeric(14, 3), ufTotal)
          .input('uf', sqlFact.Numeric(14, 4), uf)
          .input('facturado_por', sqlFact.VarChar(60), String(criterio_agrupacion).slice(0, 60))
          .input('valor_agrupacion', sqlFact.VarChar(200), String(g.etiqueta || '').slice(0, 200))
          .input('fecha_proceso_ini', sqlFact.VarChar(10), toDmyString(fecha_proceso_ini) || ini)
          .input('fecha_proceso_fin', sqlFact.VarChar(10), toDmyString(fecha_proceso_fin) || fin)
          .input('fecha_informe_ini', sqlFact.VarChar(10), toDmyString(fecha_informe_ini))
          .input('fecha_informe_fin', sqlFact.VarChar(10), toDmyString(fecha_informe_fin))
          .input('peso_totalfac', sqlFact.Numeric(18, 0), pesoTotal)
          .input('id_formapago', sqlFact.Numeric(10, 0), Number(id_formapago))
          .input('nom_fp', sqlFact.VarChar(120), String(fpInfo.nombre_formapago || '').slice(0, 120))
          .input('mes', sqlFact.VarChar(40), mesTxt)
          .input('id_glosa', sqlFact.Numeric(10, 0), Number(id_glosa))
          .input('nom_gl', sqlFact.VarChar(300), String(glInfo.nombre_glosa || '').slice(0, 300))
          .input('observaciones', sqlFact.VarChar(1000), String(observaciones || '').trim().slice(0, 1000))
          .input('glosa', sqlFact.VarChar(1000), glosaFinal)
          .input('nota', sqlFact.VarChar(1000), String(nota || '').trim().slice(0, 1000))
          .input('usd', sqlFact.Numeric(14, 4), usd)
          .input('usd_totalfac', sqlFact.Numeric(14, 3), usdTotal)
          .input('id_prog', sqlFact.Numeric(10, 0), Number(firstLine.id_programa || 0))
          .input('nom_prog', sqlFact.VarChar(200), String(firstLine.nombre_programa || progConfig.nombre || '').slice(0, 200))
          .input('sigla_prog', sqlFact.VarChar(30), String(progConfig.codigo || '').slice(0, 30))
          .input('eligeprograma', sqlFact.Int, Number(eligeprograma || 4))
          .input('criterio', sqlFact.VarChar(60), String(criterio_agrupacion).slice(0, 60))
          .input('usr', sqlFact.VarChar(100), String(usuario || '').slice(0, 100))
          .query(`
            INSERT INTO dbo.facturacion_enc (
              id_empresaservicio, nombre_empresaservicios, rut_empresaservicios, sigla,
              fecha_facturacion, uf_totalotrosing, uf_totalotrosdes, uf_totalcaso, uf_totalfac,
              uf, mf, facturado_por, valor_agrupacion, fecha_proceso_ini, fecha_proceso_fin, factura,
              fecha_informe_ini, fecha_informe_fin, peso_totalfac, id_formapago, nombre_formapago,
              mes, id_glosa, nombre_glosa, observaciones, glosa, emitido, ocompra, ocompra_fecha, nota,
              usd, usd_totalfac, eliminado, id_programa, nombre_programa, sigla_programa, eligeprograma, criterio_agrupacion, usuario_crea
            )
            OUTPUT INSERTED.id_facturacion
            VALUES (
              @id_empresaservicio, @nom_emp, @rut_emp, @sigla,
              @fecha_facturacion, 0, 0, @uf_totalcaso, @uf_totalfac,
              @uf, 1, @facturado_por, @valor_agrupacion, @fecha_proceso_ini, @fecha_proceso_fin, 0,
              @fecha_informe_ini, @fecha_informe_fin, @peso_totalfac, @id_formapago, @nom_fp,
              @mes, @id_glosa, @nom_gl, @observaciones, @glosa, '', '', '', @nota,
              @usd, @usd_totalfac, 'N', @id_prog, @nom_prog, @sigla_prog, @eligeprograma, @criterio, @usr
            );
          `);

        const idFacReal = Number(encIns.recordset?.[0]?.id_facturacion);
        mapaIdProvAReal.set(g.id_facturacion, idFacReal);

        for (const d of lineasGrupo) {
          await new sqlFact.Request(tx)
            .input('id_fac', sqlFact.Int, idFacReal)
            .input('id_caso', sqlFact.Numeric(10, 0), d.id_caso)
            .input('item', sqlFact.Int, d.item)
            .input('id_tec', sqlFact.Numeric(10, 0), d.id_tecnica)
            .input('n', sqlFact.Numeric(12, 2), d.n_analisis)
            .input('vta', sqlFact.Numeric(14, 4), d.vtaunitario)
            .input('tot', sqlFact.Numeric(14, 4), d.vtatotal)
            .input('uf', sqlFact.Numeric(14, 4), d.uf || uf)
            .input('usd', sqlFact.Numeric(14, 4), d.usd || usd)
            .input('caso_adlab', sqlFact.VarChar(40), String(d.caso_adlab).slice(0, 40))
            .input('n_rec', sqlFact.VarChar(40), String(d.n_recepcion).slice(0, 40))
            .input('f_rec', sqlFact.VarChar(10), String(d.fecha_recepcion).slice(0, 10))
            .input('f_mue', sqlFact.VarChar(10), String(d.fecha_muestreo).slice(0, 10))
            .input('f_inf', sqlFact.VarChar(10), String(d.fecha_informe).slice(0, 10))
            .input('id_prog', sqlFact.Numeric(10, 0), d.id_programa)
            .input('nom_prog', sqlFact.VarChar(200), String(d.nombre_programa).slice(0, 200))
            .input('id_cen', sqlFact.Numeric(10, 0), d.id_centro)
            .input('nom_cen', sqlFact.VarChar(200), String(d.nombre_centro).slice(0, 200))
            .input('id_agua', sqlFact.Numeric(10, 0), d.id_tipoagua)
            .input('nom_agua', sqlFact.VarChar(100), String(d.nombre_tipoagua).slice(0, 100))
            .input('vet', sqlFact.VarChar(200), String(d.cliente_entrega).slice(0, 200))
            .input('nom_tec', sqlFact.VarChar(250), String(d.nombre_tecnica).slice(0, 250))
            .input('nom_org', sqlFact.VarChar(200), String(d.nombre_organo).slice(0, 200))
            .input('nom_med', sqlFact.VarChar(150), String(d.nombre_medios).slice(0, 150))
            .input('mult', sqlFact.VarChar(10), String(d.multiplex).slice(0, 10))
            .input('regla', sqlFact.VarChar(200), String(d.regla_aplicada).slice(0, 200))
            .input('id_emp', sqlFact.Numeric(10, 0), Number(id_empresaservicio))
            .query(`
              INSERT INTO dbo.facturacion_det (
                id_facturacion, id_caso, item, id_tecnica, n_analisis, vtaunitario, vtatotal, uf, usd,
                caso_adlab, n_recepcion, fecha_recepcion, fecha_muestreo, fecha_informe,
                id_programa, nombre_programa, id_centro, nombre_centro, id_tipoagua, nombre_tipoagua,
                cliente_entrega, nombre_tecnica, nombre_organo, nombre_medios, multiplex, regla_aplicada, id_empresaservicio
              ) VALUES (
                @id_fac, @id_caso, @item, @id_tec, @n, @vta, @tot, @uf, @usd,
                @caso_adlab, @n_rec, @f_rec, @f_mue, @f_inf,
                @id_prog, @nom_prog, @id_cen, @nom_cen, @id_agua, @nom_agua,
                @vet, @nom_tec, @nom_org, @nom_med, @mult, @regla, @id_emp
              );
              DELETE FROM dbo.facturacion_valorizacion WHERE id_caso = @id_caso AND item = @item AND id_tecnica = @id_tec;
            `);
          totalLineasInsertadas++;
        }

        creadas.push({
          id_facturacion: idFacReal,
          grupo: g.etiqueta || '',
          total_casos: g.total_casos || 0,
          total_lineas: lineasGrupo.length,
          uf_totalfac: ufTotal,
          peso_totalfac: pesoTotal
        });
      }

      for (const ref of referencias) {
        const numero = String(ref?.ocompra ?? '').trim();
        if (!numero) continue;
        const tipo = String(ref.tipo || 'OC').trim().toUpperCase() === 'HES' ? 'HES' : 'OC';
        const destino = ref.id_facturacion != null && ref.id_facturacion !== ''
          ? [mapaIdProvAReal.get(Number(ref.id_facturacion)) ?? Number(ref.id_facturacion)]
          : creadas.map((c) => c.id_facturacion);
        for (const idDestino of destino) {
          await new sqlFact.Request(tx)
            .input('ocompra', sqlFact.VarChar(100), numero.slice(0, 100))
            .input('ocompra_fecha', sqlFact.VarChar(10), toDmyString(ref.ocompra_fecha))
            .input('referencia', sqlFact.VarChar(300), String(ref.referencia || '').trim().slice(0, 300))
            .input('id_facturacion', sqlFact.Int, idDestino)
            .input('tipo', sqlFact.VarChar(10), tipo)
            .input('orden', sqlFact.Int, Number(ref.orden) || (tipo === 'HES' ? 2 : 1))
            .query(`
              INSERT INTO dbo.facturacion_ocompra (ocompra, ocompra_fecha, referencia, id_facturacion, tipo, orden)
              VALUES (@ocompra, @ocompra_fecha, @referencia, @id_facturacion, @tipo, @orden);
            `);
        }
      }

      await tx.commit();
      return {
        total_prefacturas_creadas: creadas.length,
        total_lineas: totalLineasInsertadas,
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
    const poolFact = await this._poolFacturacion();
    const request = poolFact.request();
    const conds = [`ISNULL(fe.eliminado, 'N') <> 'S'`];

    if (emitido === 'N') {
      conds.push(`ISNULL(fe.emitido, 'N') <> 'S'`);
    } else if (emitido === 'S') {
      conds.push(`fe.emitido = 'S'`);
    }

    if (id_empresaservicio && Number(id_empresaservicio) > 0) {
      request.input('id_empresaservicio', sqlFact.Numeric(10, 0), Number(id_empresaservicio));
      conds.push(`fe.id_empresaservicio = @id_empresaservicio`);
    }

    if (busqueda && String(busqueda).trim() !== '') {
      request.input('q', sqlFact.VarChar(100), `%${String(busqueda).trim()}%`);
      conds.push(`(
        CAST(fe.id_facturacion AS VARCHAR(20)) LIKE @q
        OR CAST(fe.factura AS VARCHAR(20)) LIKE @q
        OR fe.nombre_empresaservicios LIKE @q
        OR fe.rut_empresaservicios LIKE @q
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
        fe.nombre_empresaservicios,
        fe.rut_empresaservicios,
        fe.fecha_facturacion,
        ISNULL(fe.uf_totalcaso, 0) AS uf_totalcaso,
        ISNULL(fe.uf_totalotrosing, 0) AS uf_totalotrosing,
        ISNULL(fe.uf_totalotrosdes, 0) AS uf_totalotrosdes,
        ISNULL(fe.uf_totalfac, 0) AS uf_totalfac,
        ISNULL(fe.uf, 0) AS uf,
        ISNULL(fe.usd, 0) AS usd,
        ISNULL(fe.peso_totalfac, ROUND(ISNULL(fe.uf_totalfac, 0) * ISNULL(fe.uf, 0), 0)) AS peso_totalfac,
        fe.facturado_por,
        fe.glosa,
        fe.observaciones,
        fe.nota,
        fe.emitido,
        fe.ocompra,
        fe.ocompra_fecha,
        ISNULL(fe.id_formapago, 1) AS id_formapago,
        fe.nombre_formapago,
        ISNULL(fe.id_glosa, 1) AS id_glosa,
        (SELECT COUNT(DISTINCT fd.id_caso) FROM dbo.facturacion_det fd WHERE fd.id_facturacion = fe.id_facturacion) AS total_casos
      FROM dbo.facturacion_enc fe
      WHERE ${conds.join(' AND ')}
      ORDER BY fe.id_facturacion DESC;
    `;

    const res = await request.query(query);
    const filas = res.recordset || [];
    if (filas.length === 0) return [];

    const ids = filas.map((r) => Number(r.id_facturacion)).filter((n) => Number.isFinite(n) && n > 0);
    const centrosPorFactura = new Map();
    for (const trozo of enTrozos(ids, 400)) {
      const cenRes = await poolFact.request().query(`
        SELECT
          fd.id_facturacion,
          CASE
            WHEN COUNT(DISTINCT NULLIF(fd.id_centro, 0)) = 1
              THEN MAX(LTRIM(RTRIM(ISNULL(fd.nombre_centro, ''))))
            WHEN COUNT(DISTINCT NULLIF(fd.id_centro, 0)) > 1
              THEN 'Varios (' + CAST(COUNT(DISTINCT NULLIF(fd.id_centro, 0)) AS VARCHAR(10)) + ')'
            ELSE ''
          END AS nombre_centro
        FROM dbo.facturacion_det fd
        WHERE fd.id_facturacion IN (${trozo.join(',')})
        GROUP BY fd.id_facturacion;
      `);
      for (const c of cenRes.recordset || []) {
        centrosPorFactura.set(Number(c.id_facturacion), c.nombre_centro || '');
      }
    }

    return filas.map((r) => ({
      ...r,
      nombre_centro: centrosPorFactura.get(Number(r.id_facturacion)) || ''
    }));
  }

  async getPrefacturaSaludDetalle(id_facturacion) {
    const poolFact = await this._poolFacturacion();
    const idFac = Number(id_facturacion);

    const result = await poolFact.request()
      .input('id_facturacion', sqlFact.Int, idFac)
      .query(`
        SELECT * FROM dbo.facturacion_enc WHERE id_facturacion = @id_facturacion;

        SELECT
          id_caso,
          MAX(caso_adlab) AS caso_adlab,
          MAX(fecha_recepcion) AS fecha_recepcion,
          MAX(fecha_muestreo) AS fecha_muestreo,
          MAX(fecha_informe) AS fecha_informe,
          MAX(nombre_centro) AS nombre_centro,
          MAX(nombre_programa) AS nombre_programa,
          MAX(cliente_entrega) AS cliente_entrega,
          SUM(ISNULL(vtatotal, 0)) AS uf_caso,
          COUNT(id_detalle) AS total_lineas,
          'N' AS marcareversa
        FROM dbo.facturacion_det
        WHERE id_facturacion = @id_facturacion
        GROUP BY id_caso
        ORDER BY MAX(caso_adlab);

        SELECT id_facturacion, id_otrosingresos, nombre_otrosingresos, ISNULL(valor, 0) AS valor
        FROM dbo.facturacion_ing
        WHERE id_facturacion = @id_facturacion;

        SELECT id_facturacion, id_otrosdescuentos, nombre_otrosdescuentos, ISNULL(valor, 0) AS valor
        FROM dbo.facturacion_des
        WHERE id_facturacion = @id_facturacion;

        SELECT id_facturacion, ocompra, ocompra_fecha, referencia, tipo, orden
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
  async _recalcularTotalesPrefactura(poolFact, id_facturacion) {
    const idFac = Number(id_facturacion);
    return poolFact.request()
      .input('id_facturacion', sqlFact.Int, idFac)
      .query(`
        DECLARE @uf_casos NUMERIC(14,3) = ISNULL((SELECT SUM(ISNULL(vtatotal, 0)) FROM dbo.facturacion_det WHERE id_facturacion = @id_facturacion), 0);
        DECLARE @uf_oi NUMERIC(14,3) = ISNULL((SELECT SUM(ISNULL(valor, 0)) FROM dbo.facturacion_ing WHERE id_facturacion = @id_facturacion), 0);
        DECLARE @uf_od NUMERIC(14,3) = ISNULL((SELECT SUM(ISNULL(valor, 0)) FROM dbo.facturacion_des WHERE id_facturacion = @id_facturacion), 0);
        DECLARE @uf_final NUMERIC(14,3) = @uf_casos + @uf_oi - @uf_od;

        UPDATE dbo.facturacion_enc
        SET uf_totalcaso = @uf_casos,
            uf_totalotrosing = @uf_oi,
            uf_totalotrosdes = @uf_od,
            uf_totalfac = @uf_final,
            peso_totalfac = ROUND(@uf_final * ISNULL(uf, 0), 0)
        WHERE id_facturacion = @id_facturacion;
      `);
  }

  async agregarOtroIngreso({ id_facturacion, id_otrosingresos, valor }) {
    const poolFact = await this._poolFacturacion();
    const poolSalud = await this._pool();
    const cat = await poolSalud.request()
      .input('id', sql.Numeric(10, 0), Number(id_otrosingresos))
      .query('SELECT LTRIM(RTRIM(ISNULL(nombre_otrosingresos, \'\'))) AS nombre FROM dbo.mae_otrosingresos WHERE id_otrosingresos = @id;');
    const nombre = cat.recordset?.[0]?.nombre || 'Otro Ingreso';
    await poolFact.request()
      .input('id_facturacion', sqlFact.Int, Number(id_facturacion))
      .input('id_otrosingresos', sqlFact.Numeric(10, 0), Number(id_otrosingresos))
      .input('nombre', sqlFact.VarChar(250), nombre.slice(0, 250))
      .input('valor', sqlFact.Numeric(14, 3), round2(valor))
      .query(`
        DELETE FROM dbo.facturacion_ing WHERE id_facturacion = @id_facturacion AND id_otrosingresos = @id_otrosingresos;
        INSERT INTO dbo.facturacion_ing (id_facturacion, id_otrosingresos, nombre_otrosingresos, valor)
        VALUES (@id_facturacion, @id_otrosingresos, @nombre, @valor);
      `);
    await this._recalcularTotalesPrefactura(poolFact, id_facturacion);
    return this.getPrefacturaSaludDetalle(id_facturacion);
  }

  async eliminarOtroIngreso({ id_facturacion, id_otrosingresos }) {
    const poolFact = await this._poolFacturacion();
    await poolFact.request()
      .input('id_facturacion', sqlFact.Int, Number(id_facturacion))
      .input('id_otrosingresos', sqlFact.Numeric(10, 0), Number(id_otrosingresos))
      .query(`DELETE FROM dbo.facturacion_ing WHERE id_facturacion = @id_facturacion AND id_otrosingresos = @id_otrosingresos;`);
    await this._recalcularTotalesPrefactura(poolFact, id_facturacion);
    return this.getPrefacturaSaludDetalle(id_facturacion);
  }

  async agregarOtroDescuento({ id_facturacion, id_otrosdescuentos, valor }) {
    const poolFact = await this._poolFacturacion();
    const poolSalud = await this._pool();
    const cat = await poolSalud.request()
      .input('id', sql.Numeric(10, 0), Number(id_otrosdescuentos))
      .query('SELECT LTRIM(RTRIM(ISNULL(nombre_otrosdescuentos, \'\'))) AS nombre FROM dbo.mae_otrosdescuentos WHERE id_otrosdescuentos = @id;');
    const nombre = cat.recordset?.[0]?.nombre || 'Otro Descuento';
    await poolFact.request()
      .input('id_facturacion', sqlFact.Int, Number(id_facturacion))
      .input('id_otrosdescuentos', sqlFact.Numeric(10, 0), Number(id_otrosdescuentos))
      .input('nombre', sqlFact.VarChar(250), nombre.slice(0, 250))
      .input('valor', sqlFact.Numeric(14, 3), round2(valor))
      .query(`
        DELETE FROM dbo.facturacion_des WHERE id_facturacion = @id_facturacion AND id_otrosdescuentos = @id_otrosdescuentos;
        INSERT INTO dbo.facturacion_des (id_facturacion, id_otrosdescuentos, nombre_otrosdescuentos, valor)
        VALUES (@id_facturacion, @id_otrosdescuentos, @nombre, @valor);
      `);
    await this._recalcularTotalesPrefactura(poolFact, id_facturacion);
    return this.getPrefacturaSaludDetalle(id_facturacion);
  }

  async eliminarOtroDescuento({ id_facturacion, id_otrosdescuentos }) {
    const poolFact = await this._poolFacturacion();
    await poolFact.request()
      .input('id_facturacion', sqlFact.Int, Number(id_facturacion))
      .input('id_otrosdescuentos', sqlFact.Numeric(10, 0), Number(id_otrosdescuentos))
      .query(`DELETE FROM dbo.facturacion_des WHERE id_facturacion = @id_facturacion AND id_otrosdescuentos = @id_otrosdescuentos;`);
    await this._recalcularTotalesPrefactura(poolFact, id_facturacion);
    return this.getPrefacturaSaludDetalle(id_facturacion);
  }

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
    const poolFact = await this._poolFacturacion();
    const idFac = Number(id_facturacion);

    await poolFact.request()
      .input('id_facturacion', sqlFact.Int, idFac)
      .input('fecha_facturacion', sqlFact.VarChar(10), toDmyString(fecha_facturacion))
      .input('id_formapago', sqlFact.Numeric(10, 0), Number(id_formapago) || 1)
      .input('id_glosa', sqlFact.Numeric(10, 0), Number(id_glosa) || 1)
      .input('glosa', sqlFact.VarChar(1000), String(glosa || '').slice(0, 1000))
      .input('observaciones', sqlFact.VarChar(1000), String(observaciones || '').slice(0, 1000))
      .input('nota', sqlFact.VarChar(1000), String(nota || '').slice(0, 1000))
      .input('uf', sqlFact.Numeric(14, 4), Number(uf) || 38500)
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
      await poolFact.request()
        .input('id_facturacion', sqlFact.Int, idFac)
        .query(`DELETE FROM dbo.facturacion_ocompra WHERE id_facturacion = @id_facturacion;`);

      let idx = 1;
      for (const ocItem of ordenes_compra) {
        if (!ocItem || !ocItem.ocompra || String(ocItem.ocompra).trim() === '') continue;
        await poolFact.request()
          .input('id_facturacion', sqlFact.Int, idFac)
          .input('ocompra', sqlFact.VarChar(100), String(ocItem.ocompra).trim().slice(0, 100))
          .input('ocompra_fecha', sqlFact.VarChar(10), toDmyString(ocItem.ocompra_fecha))
          .input('referencia', sqlFact.VarChar(300), String(ocItem.referencia || ocItem.tipo || 'OC').slice(0, 300))
          .input('tipo', sqlFact.VarChar(10), String(ocItem.tipo || 'OC').slice(0, 10))
          .input('orden', sqlFact.Int, Number(ocItem.orden) || idx++)
          .query(`
            INSERT INTO dbo.facturacion_ocompra (ocompra, ocompra_fecha, referencia, id_facturacion, tipo, orden)
            VALUES (@ocompra, @ocompra_fecha, @referencia, @id_facturacion, @tipo, @orden);
          `);
      }

      const firstOc = ordenes_compra.find((o) => o && o.ocompra);
      if (firstOc) {
        await poolFact.request()
          .input('id_facturacion', sqlFact.Int, idFac)
          .input('ocompra', sqlFact.VarChar(100), String(firstOc.ocompra).trim().slice(0, 100))
          .input('ocompra_fecha', sqlFact.VarChar(10), toDmyString(firstOc.ocompra_fecha))
          .query(`
            UPDATE dbo.facturacion_enc
            SET ocompra = @ocompra, ocompra_fecha = @ocompra_fecha
            WHERE id_facturacion = @id_facturacion;
          `);
      }
    }

    await this._recalcularTotalesPrefactura(poolFact, idFac);
    return this.getPrefacturaSaludDetalle(idFac);
  }

  /** Ejecuta `fn` con un ejecutor ligado a una transacción en ADLFacturacion. */
  async _enTransaccion(fn) {
    const poolFact = await this._poolFacturacion();
    const tx = new sqlFact.Transaction(poolFact);
    await tx.begin();
    try {
      const resultado = await fn({ request: () => new sqlFact.Request(tx) });
      await tx.commit();
      return resultado;
    } catch (error) {
      try { await tx.rollback(); } catch { /* la transacción ya estaba cerrada */ }
      throw error;
    }
  }

  /** Elimina lógicamente una prefactura en ADLFacturacion, liberando sus casos para volver a prefacturar. */
  async eliminarPrefacturaSalud(id_facturacion) {
    const id = Number(id_facturacion) || 0;
    if (!id) throw new Error('Debe indicar el ID de facturación.');
    return this._enTransaccion(async (db) => {
      const res = await db.request()
        .input('id', sqlFact.Int, id)
        .query(`
          UPDATE dbo.facturacion_enc
          SET eliminado = 'S', fecha_elimina = SYSDATETIME()
          WHERE id_facturacion = @id AND ISNULL(eliminado, 'N') <> 'S';
        `);
      if (!(res.rowsAffected?.[0] > 0)) {
        throw new Error('No existen datos activos para ese N° ID Facturación.');
      }
      const detCount = await db.request()
        .input('id', sqlFact.Int, id)
        .query('SELECT COUNT(*) AS n FROM dbo.facturacion_det WHERE id_facturacion = @id;');
      const guiasDel = await db.request()
        .input('id', sqlFact.Int, id)
        .query('DELETE FROM dbo.facturacion_guias WHERE id_facturacion = @id;');
      return {
        id_facturacion: id,
        lineasLiberadas: Number(detCount.recordset?.[0]?.n || 0),
        guiasLiberadas: guiasDel.rowsAffected?.[0] ?? 0
      };
    });
  }

  /** Elimina lógicamente una factura por su folio en ADLFacturacion. */
  async eliminarFacturaPorNumeroSalud(factura) {
    const f = Number(factura) || 0;
    if (!f) throw new Error('Debe indicar el N° de factura.');
    const poolFact = await this._poolFacturacion();
    const filas = (await poolFact.request()
      .input('f', sqlFact.Numeric(12, 0), f)
      .query(`SELECT id_facturacion FROM dbo.facturacion_enc WHERE factura = @f AND ISNULL(eliminado, 'N') <> 'S' ORDER BY id_facturacion;`)).recordset || [];
    if (!filas.length) throw new Error('No existen datos para ese N° Factura.');
    const [primera, ...otras] = filas.map((r) => Number(r.id_facturacion));
    const r = await this.eliminarPrefacturaSalud(primera);
    return { ...r, factura: f, otrasFacturasConElMismoNumero: otras };
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

  async listarCasosDeFacturaSalud(id_facturacion) {
    const poolFact = await this._poolFacturacion();
    const res = await poolFact.request()
      .input('id_fac', sqlFact.Numeric(10, 0), Number(id_facturacion))
      .query(`
        SELECT DISTINCT
          fd.id_caso, fd.caso, fd.fecha_muestreo, fd.fecha_informe,
          fd.uf_caso, fd.centro, fd.programa
        FROM dbo.facturacion_det fd
        WHERE fd.id_facturacion = @id_fac
        ORDER BY fd.id_caso ASC;
      `);
    return res.recordset || [];
  }

  async crearNotaCreditoCasosSalud(datos) {
    return this.crearDocumentoOtroCobro({
      id_tipodocumento: 8,
      id_empresaservicio: datos.id_empresaservicio,
      concepto_cobro: datos.concepto_cobro || datos.motivo || 'Nota de Crédito Casos',
      fecha_documento: datos.fecha_documento || new Date().toISOString().slice(0, 10),
      uf: datos.uf || 0,
      monto_uf: datos.monto_uf || 0,
      monto: datos.monto || 0,
      observacion: datos.observacion || '',
      tipo_ref: datos.tipo_ref || 'FE',
      num_ref: datos.num_ref || String(datos.id_facturacion || ''),
      fecha_ref: datos.fecha_ref || '',
      cod_razon: datos.cod_razon || 1,
      motivo: datos.motivo || '',
      nota: datos.nota || '',
      tipoimpuesto: datos.tipoimpuesto || 'AFE',
      id_formapago: datos.id_formapago || 1,
      id_facturacion_referencia: datos.id_facturacion || datos.id_facturacion_referencia,
      origen_referencia: 'CASOS',
      casos_reversar_ids: datos.casos || datos.casos_reversar_ids || []
    });
  }

  /** fac_otrasventas_v2.scx: documentos de otras ventas, notas de crédito y de débito (tabla facturacion_otro en ADLFacturacion). */
  async listarOtrasVentasSalud(estado = 'Todos') {
    return this._listarOtrosDocumentosAdlf({ estado });
  }

  async buscarReferenciaOtrasVentasSalud(datos) {
    return this.buscarFacturaParaNotaCredito({
      folio: datos.factura || datos.id_facturacion || datos.folio,
      origen: datos.origen || 'CASOS'
    });
  }

  async crearOtraVentaSalud(datos) {
    return this.crearDocumentoOtroCobro(datos);
  }

  /** `accion` = numero | nota | fecha | glosa | uf | monto-uf */
  async modificarOtraVentaSalud(accion, datos) {
    const poolFact = await this._poolFacturacion();
    const idDoc = Number(datos.id_otroscobros || datos.id_facturacion);
    if (!idDoc) throw new Error('Debes elegir un documento.');

    if (accion === 'numero') {
      await poolFact.request()
        .input('id', sqlFact.Int, idDoc)
        .input('num', sqlFact.Numeric(10, 0), Number(datos.numero_documento || datos.factura || 0))
        .query(`UPDATE dbo.facturacion_otro SET numero_documento = @num, factura = @num WHERE id_facturacion = @id OR id_otroscobros = @id;`);
      return { ok: true };
    }
    if (accion === 'nota') {
      await poolFact.request()
        .input('id', sqlFact.Int, idDoc)
        .input('nota', sqlFact.VarChar(1000), String(datos.nota || '').trim())
        .query(`UPDATE dbo.facturacion_otro SET nota = @nota WHERE id_facturacion = @id OR id_otroscobros = @id;`);
      return { ok: true };
    }
    if (accion === 'fecha') {
      const f = toDmyString(datos.fecha || datos.fecha_documento);
      await poolFact.request()
        .input('id', sqlFact.Int, idDoc)
        .input('f', sqlFact.VarChar(10), f)
        .query(`UPDATE dbo.facturacion_otro SET fecha_documento = @f, fecha = @f WHERE id_facturacion = @id OR id_otroscobros = @id;`);
      return { ok: true };
    }
    if (accion === 'glosa') {
      const g = String(datos.glosa || datos.concepto_cobro || '').trim();
      await poolFact.request()
        .input('id', sqlFact.Int, idDoc)
        .input('g', sqlFact.VarChar(200), g.slice(0, 200))
        .query(`UPDATE dbo.facturacion_otro SET concepto_cobro = @g, glosa = @g WHERE id_facturacion = @id OR id_otroscobros = @id;`);
      return { ok: true };
    }
    if (accion === 'uf') {
      const ufVal = Number(datos.uf || 0);
      const cur = await poolFact.request().input('id', sqlFact.Int, idDoc).query(`SELECT ISNULL(NULLIF(monto_uf,0), uf_totalfac) AS monto_uf FROM dbo.facturacion_otro WHERE id_facturacion = @id OR id_otroscobros = @id;`);
      const montoUf = Number(cur.recordset?.[0]?.monto_uf || 0);
      const montoClp = round0(montoUf * ufVal);
      await poolFact.request()
        .input('id', sqlFact.Int, idDoc)
        .input('uf', sqlFact.Numeric(14, 4), ufVal)
        .input('m', sqlFact.Numeric(14, 0), montoClp)
        .query(`UPDATE dbo.facturacion_otro SET uf = @uf, monto = @m, peso_totalfac = @m WHERE id_facturacion = @id OR id_otroscobros = @id;`);
      return { ok: true };
    }
    if (accion === 'monto-uf') {
      const montoUf = Number(datos.monto_uf || 0);
      const cur = await poolFact.request().input('id', sqlFact.Int, idDoc).query(`SELECT ISNULL(uf, 0) AS uf FROM dbo.facturacion_otro WHERE id_facturacion = @id OR id_otroscobros = @id;`);
      const ufVal = Number(cur.recordset?.[0]?.uf || 0);
      const montoClp = round0(montoUf * ufVal);
      await poolFact.request()
        .input('id', sqlFact.Int, idDoc)
        .input('muf', sqlFact.Numeric(14, 3), montoUf)
        .input('m', sqlFact.Numeric(14, 0), montoClp)
        .query(`UPDATE dbo.facturacion_otro SET monto_uf = @muf, uf_totalfac = @muf, monto = @m, peso_totalfac = @m WHERE id_facturacion = @id OR id_otroscobros = @id;`);
      return { ok: true };
    }
    throw new Error('Acción desconocida.');
  }

  /** Archivos planos de otras ventas: flujo = FEA | FEE | NCE | NDE. */
  async listarDocumentosArchivoSalud(flujo, estado = 'NO emitidos') {
    const f = String(flujo || 'FEA').toUpperCase();
    const mapa = { FEA: 1, FEE: 11, NCE: 8, NDE: 10 };
    if (!mapa[f]) throw new Error(`Flujo desconocido: ${flujo}`);
    return this._listarOtrosDocumentosAdlf({
      id_tipodocumento: mapa[f],
      tipoimpuesto: f === 'FEA' ? 'AFE' : null,
      estado
    });
  }

  async exportarDocumentosArchivoSalud(flujo, ids_facturacion) {
    const f = String(flujo || 'FEA').toUpperCase();
    const ids = (ids_facturacion || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (ids.length === 0) throw new Error('Debes elegir al menos un documento.');
    const docs = await this._listarOtrosDocumentosAdlf({ estado: 'Todos', ids });
    if (docs.length === 0) throw new Error('No se encontraron los documentos seleccionados.');

    const poolFact = await this._poolFacturacion();
    const filas = [];
    for (const doc of docs) {
      const ocRes = await poolFact.request()
        .input('id', sqlFact.Numeric(10, 0), Number(doc.id_facturacion))
        .query(`SELECT ocompra, ocompra_fecha, referencia, tipo, orden FROM dbo.facturacion_ocompra WHERE id_facturacion = @id ORDER BY orden ASC;`);
      filas.push(...otrasVentas.filasDteDocumento(f, doc, ocRes.recordset || []));
    }

    await poolFact.request().query(`UPDATE dbo.facturacion_otro SET emitido = 'S' WHERE id_facturacion IN (${ids.join(',')});`);
    const contenido = exportacion.csvFoxPro(filas);
    return {
      archivo: otrasVentas.nombreArchivoOtros(f, ids),
      contenido,
      filas: filas.length,
      contenidoAnsiBase64: exportacion.aBufferAnsi(contenido).toString('base64')
    };
  }

  /**
   * PDF «Resumen» de una factura (desde ADLFacturacion).
   */
  async generarPdfResumenSalud(id_facturacion) {
    const ficha = await this.consultarFacturaSalud({ id_facturacion });
    const enc = ficha.encabezado;
    const primera = ficha.detalle?.[0] || {};
    const resumen = [{
      id_facturacion: enc.id_facturacion,
      factura: enc.factura,
      empresa: enc.nombre_empresaservicios,
      id_empresaservicio: enc.id_empresaservicio,
      programa: enc.nombre_programa || primera.programa || '',
      fecha: enc.fecha_facturacion,
      facturado_por: enc.facturado_por,
      dato1: primera.centro || '',
      dato2: primera.veterinario || '',
      dato3: primera.tipoagua || '',
      valor_uf: enc.uf,
      uf_ingresos: enc.uf_totalotrosing,
      uf_descuentos: enc.uf_totalotrosdes,
      uf_caso: enc.uf_totalcaso,
      uf_total: enc.uf_totalfac,
      usd_total: enc.usd_totalfac,
      valor_usd: enc.usd
    }];
    const datos = pdfSalud.armarDatosResumen({
      resumen,
      ingresos: ficha.ingresos,
      descuentos: ficha.descuentos
    });
    const buffer = await pdfSalud.crearPdfResumen(datos);
    const ruta = pdfSalud.guardarPdf(buffer, {
      carpetaBase: process.env.FACTURACION_SALUD_DOCS_DIR,
      titulo: ficha.titulo,
      fechaFacturacion: ficha.encabezado.fecha_facturacion
    });
    return { buffer, nombre: pdfSalud.nombreArchivoResumen(ficha.titulo), ruta };
  }

  /** PDF «Detalle» de una factura (desde ADLFacturacion). */
  async generarPdfDetalleSalud(id_facturacion) {
    const ficha = await this.consultarFacturaSalud({ id_facturacion });
    const datos = pdfSalud.armarDatosDetalle({ filas: ficha.detalle, usdTotalCasos: ficha.usdTotalCasos });
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

  /** Consulta completa de una factura en ADLFacturacion por ID o por folio SII. */
  async consultarFacturaSalud({ id_facturacion, factura }) {
    const poolFact = await this._poolFacturacion();
    const idFac = Number(id_facturacion) || 0;
    const folio = Number(factura) || 0;

    let encRows = [];
    if (idFac > 0) {
      const r = await poolFact.request().input('id', sqlFact.Int, idFac)
        .query(`SELECT * FROM dbo.facturacion_enc WHERE id_facturacion = @id AND ISNULL(eliminado, 'N') <> 'S';`);
      encRows = r.recordset || [];
    } else if (folio > 0) {
      const r = await poolFact.request().input('f', sqlFact.Numeric(12, 0), folio)
        .query(`SELECT * FROM dbo.facturacion_enc WHERE factura = @f AND ISNULL(eliminado, 'N') <> 'S' ORDER BY id_facturacion;`);
      encRows = r.recordset || [];
    }
    if (!encRows.length) throw new Error('No existen datos registrados para esta FACTURA.');
    const enc = encRows[0];
    const id = Number(enc.id_facturacion);

    const detRes = await poolFact.request().input('id', sqlFact.Int, id).query(`
      SELECT
        fd.*,
        fe.factura,
        fe.fecha_facturacion AS fecha,
        fe.facturado_por,
        fe.nombre_empresaservicios AS empresa,
        fe.sigla,
        fe.sigla_programa,
        fe.mes,
        fe.uf AS uf_valor,
        fe.usd AS usd_valor,
        fe.fecha_proceso_ini,
        fe.fecha_proceso_fin,
        fe.fecha_informe_ini,
        fe.fecha_informe_fin
      FROM dbo.facturacion_det fd
      INNER JOIN dbo.facturacion_enc fe ON fe.id_facturacion = fd.id_facturacion
      WHERE fd.id_facturacion = @id
      ORDER BY fd.nombre_centro, fd.caso_adlab, fd.nombre_tecnica, fd.item;

      SELECT id_facturacion, id_otrosingresos, nombre_otrosingresos, ISNULL(valor, 0) AS valor
      FROM dbo.facturacion_ing WHERE id_facturacion = @id;

      SELECT id_facturacion, id_otrosdescuentos, nombre_otrosdescuentos, ISNULL(valor, 0) AS valor
      FROM dbo.facturacion_des WHERE id_facturacion = @id;

      SELECT id_facturacion, ocompra, ocompra_fecha, referencia, tipo, orden
      FROM dbo.facturacion_ocompra WHERE id_facturacion = @id ORDER BY orden ASC;
    `);

    const detalle = (detRes.recordsets[0] || []).map((d) => ({
      ...d,
      programa: d.nombre_programa || enc.nombre_programa || '',
      centro: d.nombre_centro || '',
      veterinario: d.cliente_entrega || '',
      tipoagua: d.nombre_tipoagua || '',
      caso: d.caso_adlab || String(d.id_caso),
      tecnica: d.nombre_tecnica || '',
      organo: d.nombre_organo || '',
      medio: d.nombre_medios || '',
      uf_uni: Number(d.vtaunitario) || 0,
      uf_tot: Number(d.vtatotal) || 0
    }));
    const ingresos = detRes.recordsets[1] || [];
    const descuentos = detRes.recordsets[2] || [];
    const ordenes = detRes.recordsets[3] || [];

    const suma = (arr) => arr.reduce((a, x) => a + (Number(x.valor) || 0), 0);
    const usd = Number(enc.usd) || 0;
    const ficha = {
      emision: {
        fecha_facturacion: enc.fecha_facturacion,
        id_formapago: enc.id_formapago,
        id_glosa: enc.id_glosa,
        nombre_glosa: enc.nombre_glosa,
        glosa: enc.glosa,
        mes: enc.mes,
        nota: enc.nota,
        emitido: enc.emitido,
        eliminado: enc.eliminado
      },
      encabezado: enc,
      titulo: consulta.tituloFactura(enc, detalle[0]),
      tieneFolio: Number(enc.factura) > 0,
      editable: !(Number(enc.factura) > 0),
      ingresos,
      descuentos,
      ordenes,
      detalle,
      totalOtrosIngresos: exportacion.roundVfp(suma(ingresos), 2),
      totalOtrosDescuentos: exportacion.roundVfp(suma(descuentos), 2),
      totalDetalleUf: exportacion.roundVfp(detalle.reduce((a, d) => a + (Number(d.uf_tot) || 0), 0), 2),
      ...consulta.describirFacturadoPor(detalle[0]),
      llevaDolar: Number(enc.id_empresaservicio) === consulta.ID_EMPRESA_CON_DOLAR,
      usdTotalCasos: usd ? (Number(enc.uf_totalcaso) * Number(enc.uf)) / usd : 0
    };

    if (encRows.length > 1) {
      ficha.otrasFacturasConElMismoFolio = encRows.slice(1).map((x) => Number(x.id_facturacion)).filter((x) => x !== id);
    }
    return ficha;
  }

  /** "Graba Factura" en ADLFacturacion: sin N° de factura graba totales y UF; con N° de factura graba el folio. */
  async grabarFacturaSalud({ id_facturacion, factura = 0, uf, ingresos = [], descuentos = [] }) {
    const id = Number(id_facturacion) || 0;
    if (!id) throw new Error('Debe indicar el ID de facturación.');
    const valorUf = Number(uf) || 0;
    if (!(valorUf > 0)) throw new Error('Debe ingresar el Valor de la U.F.');
    const folio = Number(factura) || 0;

    return this._enTransaccion(async (db) => {
      const encRes = await db.request().input('id', sqlFact.Int, id)
        .query(`SELECT * FROM dbo.facturacion_enc WHERE id_facturacion = @id AND ISNULL(eliminado, 'N') <> 'S';`);
      const enc = encRes.recordset?.[0];
      if (!enc) throw new Error('No existen datos registrados para esta FACTURA.');
      if (Number(enc.factura) > 0) throw new Error(`La factura interna ${id} ya tiene el N° de factura ${Number(enc.factura)}.`);

      if (folio === 0) {
        const t = consulta.totalesFactura({ uf_totalcaso: enc.uf_totalcaso, ingresos, descuentos });
        const pesos = exportacion.roundVfp(exportacion.roundVfp(t.uf_totalfac, 2) * valorUf, 0);
        let usdTotal = 0;
        if (Number(enc.id_empresaservicio) === consulta.ID_EMPRESA_CON_DOLAR) {
          if (!(exportacion.roundVfp(enc.usd, 2) > 0)) throw new Error('Para la empresa de id 500 la factura debe tener el Valor USD.');
          usdTotal = pesos / exportacion.roundVfp(enc.usd, 2);
        }

        await db.request()
          .input('id', sqlFact.Int, id)
          .input('c', sqlFact.Numeric(14, 3), t.uf_totalcaso)
          .input('i', sqlFact.Numeric(14, 3), t.uf_totalotrosing)
          .input('d', sqlFact.Numeric(14, 3), t.uf_totalotrosdes)
          .input('t', sqlFact.Numeric(14, 3), t.uf_totalfac)
          .input('p', sqlFact.Numeric(18, 0), pesos)
          .input('uf', sqlFact.Numeric(14, 4), valorUf)
          .input('usd', sqlFact.Numeric(14, 3), usdTotal)
          .query(`
            UPDATE dbo.facturacion_enc
            SET uf_totalcaso = @c, uf_totalotrosing = @i, uf_totalotrosdes = @d, uf_totalfac = @t,
                peso_totalfac = @p, uf = @uf, usd_totalfac = @usd
            WHERE id_facturacion = @id;
            UPDATE dbo.facturacion_det SET uf = @uf WHERE id_facturacion = @id;
          `);

        await db.request().input('id', sqlFact.Int, id)
          .query('DELETE FROM dbo.facturacion_ing WHERE id_facturacion = @id; DELETE FROM dbo.facturacion_des WHERE id_facturacion = @id;');

        const poolSalud = await this._pool();
        for (const c of ingresos) {
          const cat = (await poolSalud.request().input('c', sql.Numeric(10, 0), Number(c.id_otrosingresos))
            .query('SELECT LTRIM(RTRIM(ISNULL(nombre_otrosingresos, \'\'))) AS nom FROM dbo.mae_otrosingresos WHERE id_otrosingresos = @c;')).recordset?.[0];
          await db.request()
            .input('id', sqlFact.Int, id)
            .input('c', sqlFact.Numeric(10, 0), Number(c.id_otrosingresos))
            .input('nom', sqlFact.VarChar(250), String(cat?.nom || c.nombre_otrosingresos || 'Otro Ingreso').slice(0, 250))
            .input('v', sqlFact.Numeric(14, 3), Number(c.valor) || 0)
            .query('INSERT INTO dbo.facturacion_ing (id_facturacion, id_otrosingresos, nombre_otrosingresos, valor) VALUES (@id, @c, @nom, @v);');
        }
        for (const c of descuentos) {
          const cat = (await poolSalud.request().input('c', sql.Numeric(10, 0), Number(c.id_otrosdescuentos))
            .query('SELECT LTRIM(RTRIM(ISNULL(nombre_otrosdescuentos, \'\'))) AS nom FROM dbo.mae_otrosdescuentos WHERE id_otrosdescuentos = @c;')).recordset?.[0];
          await db.request()
            .input('id', sqlFact.Int, id)
            .input('c', sqlFact.Numeric(10, 0), Number(c.id_otrosdescuentos))
            .input('nom', sqlFact.VarChar(250), String(cat?.nom || c.nombre_otrosdescuentos || 'Otro Descuento').slice(0, 250))
            .input('v', sqlFact.Numeric(14, 3), Number(c.valor) || 0)
            .query('INSERT INTO dbo.facturacion_des (id_facturacion, id_otrosdescuentos, nombre_otrosdescuentos, valor) VALUES (@id, @c, @nom, @v);');
        }

        return { modo: 'totales', id_facturacion: id, ...t, peso_totalfac: pesos, usd_totalfac: usdTotal, guiasAsociadas: 0 };
      }

      await db.request()
        .input('id', sqlFact.Int, id)
        .input('f', sqlFact.Numeric(12, 0), folio)
        .input('uf', sqlFact.Numeric(14, 4), valorUf)
        .query('UPDATE dbo.facturacion_enc SET factura = @f, uf = @uf WHERE id_facturacion = @id;');

      return { modo: 'folio', id_facturacion: id, factura: folio, uf: valorUf, guiasAsociadas: 0 };
    });
  }

  /** fac_guiasclientes.scx: guías de despacho a clientes (lectura desde Abastecimiento). */
  async listarGuiasPendientesSalud(id_empresaservicio) { return consulta.listarGuiasPendientes(await getConnectionSalud(), { id_empresaservicio }); }
  async calcularNetoGuiasSalud(datos) { return consulta.calcularNetoGuias(await getConnectionSalud(), datos); }
  async reservarGuiasSalud(datos) { return this._enTransaccion((db) => consulta.reservarGuias(db, datos)); }
  async liberarGuiasSalud(id_facturacion) { return this._enTransaccion((db) => consulta.liberarGuiasDeFactura(db, { id_facturacion })); }

  /** Datos de los Excel de resumen y detalle de una factura (desde ADLFacturacion). */
  async datosExcelResumenSalud(id_facturacion) {
    const ficha = await this.consultarFacturaSalud({ id_facturacion });
    const enc = ficha.encabezado;
    const primera = ficha.detalle?.[0] || {};
    return {
      columnas: ['id_facturacion', 'factura', 'empresa', 'programa', 'fecha', 'facturado_por', 'centro', 'veterinario', 'valor_uf', 'uf_ingresos', 'uf_descuentos', 'uf_caso', 'uf_total', 'peso_total'],
      filas: [{
        id_facturacion: enc.id_facturacion,
        factura: enc.factura,
        empresa: enc.nombre_empresaservicios,
        programa: enc.nombre_programa || primera.programa || '',
        fecha: enc.fecha_facturacion,
        facturado_por: enc.facturado_por,
        centro: primera.centro || '',
        veterinario: primera.veterinario || '',
        valor_uf: enc.uf,
        uf_ingresos: enc.uf_totalotrosing,
        uf_descuentos: enc.uf_totalotrosdes,
        uf_caso: enc.uf_totalcaso,
        uf_total: enc.uf_totalfac,
        peso_total: enc.peso_totalfac
      }]
    };
  }

  async datosExcelDetalleSalud(id_facturacion) {
    const ficha = await this.consultarFacturaSalud({ id_facturacion });
    return {
      columnas: ['id_facturacion', 'factura', 'fecha', 'empresa', 'programa', 'centro', 'veterinario', 'tipoagua', 'n_recepcion', 'caso', 'tecnica', 'organo', 'medio', 'n_analisis', 'uf_uni', 'uf_tot', 'uf_valor'],
      filas: ficha.detalle
    };
  }

  /** fac_electronica_exportatxt_v2.scx: facturas de casos disponibles para el archivo plano en ADLFacturacion. */
  async listarFacturasExportacionSalud(estado) {
    const poolFact = await this._poolFacturacion();
    const est = String(estado || 'PENDIENTES').toUpperCase();
    const condEmitido = est === 'EMITIDAS' ? `fe.emitido = 'S'` : est === 'TODAS' ? '1=1' : `ISNULL(fe.emitido, '') <> 'S'`;
    const r = await poolFact.request().query(`
      SELECT
        fe.*,
        (SELECT COUNT(DISTINCT fd.id_caso) FROM dbo.facturacion_det fd WHERE fd.id_facturacion = fe.id_facturacion) AS total_casos
      FROM dbo.facturacion_enc fe
      WHERE ISNULL(fe.eliminado, 'N') <> 'S' AND ${condEmitido}
      ORDER BY fe.id_facturacion DESC;
    `);
    return r.recordset || [];
  }

  /** Arma el archivo plano de 35 columnas de las facturas elegidas (ADLFacturacion) y las marca como emitidas. */
  async exportarFacturasCasosSalud(ids_facturacion) {
    const ids = (ids_facturacion || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (ids.length === 0) throw new Error('Debes elegir al menos una factura.');
    const docs = await this._listarFacturasCasosAdlf({ estado: 'Todos', ids });
    if (docs.length === 0) throw new Error('No se encontraron las facturas seleccionadas.');

    const filas = await this._enTransaccion(async (tx) => {
      const out = [];
      for (const doc of docs) {
        const ocRes = await tx.request()
          .input('id', sqlFact.Numeric(10, 0), Number(doc.id_facturacion))
          .query(`SELECT ocompra, ocompra_fecha, referencia, tipo, orden FROM dbo.facturacion_ocompra WHERE id_facturacion = @id ORDER BY orden ASC;`);
        out.push(...exportacion.filasDteFacturaCasos(doc, ocRes.recordset || []));
      }
      await tx.request().query(`UPDATE dbo.facturacion_enc SET emitido = 'S' WHERE id_facturacion IN (${ids.join(',')});`);
      return out;
    });

    const contenido = exportacion.csvFoxPro(filas);
    return {
      archivo: exportacion.nombreArchivoCasos(ids),
      contenido,
      filas: filas.length,
      contenidoAnsiBase64: exportacion.aBufferAnsi(contenido).toString('base64')
    };
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

  async listarOcHesSalud(id_facturacion) {
    const poolFact = await this._poolFacturacion();
    const res = await poolFact.request()
      .input('id', sqlFact.Numeric(10, 0), Number(id_facturacion))
      .query(`
        SELECT id_ocompra, ocompra, ocompra_fecha, referencia, id_facturacion, tipo, orden
        FROM dbo.facturacion_ocompra
        WHERE id_facturacion = @id
        ORDER BY orden ASC, id_ocompra ASC;
      `);
    return res.recordset || [];
  }
  async agregarOcHesSalud(datos) { return this._enTransaccion((db) => exportacion.agregarOcHes(db, datos)); }
  async modificarOcHesSalud(datos) { return this._enTransaccion((db) => exportacion.modificarOcHes(db, datos)); }
  async eliminarOcHesSalud(datos) { return this._enTransaccion((db) => exportacion.eliminarOcHes(db, datos)); }
  async buscarOcEnOtrasFacturasSalud(ocompra) {
    const poolFact = await this._poolFacturacion();
    const oc12 = String(ocompra ?? '').trim().slice(0, 12);
    if (!oc12) return [];
    const res = await poolFact.request()
      .input('oc', sqlFact.VarChar(12), oc12)
      .query(`
        SELECT DISTINCT
          oc.id_facturacion, oc.ocompra, oc.ocompra_fecha, oc.tipo,
          fe.factura, fe.fecha_facturacion, fe.nombre_empresaservicios
        FROM dbo.facturacion_ocompra oc
        LEFT JOIN dbo.facturacion_enc fe ON fe.id_facturacion = oc.id_facturacion
        WHERE LEFT(LTRIM(RTRIM(oc.ocompra)), 12) = @oc
        ORDER BY oc.id_facturacion DESC;
      `);
    return res.recordset || [];
  }

  /** fac_ocompra_factura.scx: órdenes de compra asociadas (facturacion_oc). */
  async listarOcSalud(id_facturacion) {
    return mantencion.listarOcAsociadas(await getConnectionFacturacion(), { id_facturacion });
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
   * Quitar un caso individual de una prefactura en ADLFacturacion (libera automáticamente el caso para volver a prefacturar).
   */
  async quitarCasoDePrefacturaSalud({ id_facturacion, id_caso }) {
    const poolFact = await this._poolFacturacion();
    const idFac = Number(id_facturacion);
    const idCaso = Number(id_caso);

    await poolFact.request()
      .input('id_facturacion', sqlFact.Int, idFac)
      .input('id_caso', sqlFact.Numeric(10, 0), idCaso)
      .query(`
        DELETE FROM dbo.facturacion_det
        WHERE id_facturacion = @id_facturacion AND id_caso = @id_caso;
      `);

    await this._recalcularTotalesPrefactura(poolFact, idFac);
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
  async generarExcelRespaldoPrefactura(res, { id_facturacion }) {
    const idFac = Number(id_facturacion);
    const ficha = await this.consultarFacturaSalud({ id_facturacion: idFac });
    const enc = ficha.encabezado;
    const primera = ficha.detalle?.[0] || {};
    const ufVal = Number(enc.uf || 0);
    const totalUf = Number(enc.uf_totalfac || 0);
    const neto = Number(enc.peso_totalfac || round0(totalUf * ufVal));
    const iva = round0(neto * 0.19);
    const totalConIva = neto + iva;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ADL ONE - Facturación Salud';

    // Hoja 1: Resumen (Encabezado y Totales)
    const wsResumen = workbook.addWorksheet('Resumen');
    wsResumen.columns = [
      { header: 'Concepto', key: 'concepto', width: 28 },
      { header: 'Valor', key: 'valor', width: 52 },
    ];
    wsResumen.getRow(1).font = { bold: true };

    const filasResumen = [
      { concepto: 'ID Facturación', valor: idFac },
      { concepto: 'N° Factura SII', valor: Number(enc.factura) > 0 ? Number(enc.factura) : 'Sin número' },
      { concepto: 'Empresa', valor: enc.nombre_empresaservicios || '' },
      { concepto: 'RUT Empresa', valor: enc.rut_empresaservicios || '' },
      { concepto: 'Programa', valor: enc.nombre_programa || primera.programa || '' },
      { concepto: 'Fecha Facturación', valor: enc.fecha_facturacion || '' },
      { concepto: 'Facturado por', valor: ficha.facturado_por ? `${ficha.facturado_por}${ficha.valor ? `: ${ficha.valor}` : ''}` : (enc.facturado_por || '') },
      { concepto: 'Glosa', valor: enc.glosa || '' },
      { concepto: 'Valor UF', valor: ufVal },
      { concepto: 'Total Casos (UF)', valor: Number(enc.uf_totalcaso || 0) },
      { concepto: 'Otros Ingresos (UF)', valor: Number(enc.uf_totalotrosing || 0) },
      { concepto: 'Otros Descuentos (UF)', valor: Number(enc.uf_totalotrosdes || 0) },
      { concepto: 'Total Factura (UF)', valor: totalUf },
      { concepto: 'Total Neto ($ CLP)', valor: neto },
      { concepto: 'IVA 19% ($ CLP)', valor: iva },
      { concepto: 'Total con IVA ($ CLP)', valor: totalConIva },
    ];
    for (const r of filasResumen) wsResumen.addRow(r);

    if ((ficha.ingresos || []).length > 0) {
      wsResumen.addRow({ concepto: '', valor: '' });
      const hOi = wsResumen.addRow({ concepto: 'Detalle Otros Ingresos', valor: 'UF' });
      hOi.font = { bold: true };
      for (const i of ficha.ingresos) {
        wsResumen.addRow({ concepto: i.nombre_otrosingresos || 'Otro Ingreso', valor: Number(i.valor || 0) });
      }
    }
    if ((ficha.descuentos || []).length > 0) {
      wsResumen.addRow({ concepto: '', valor: '' });
      const hOd = wsResumen.addRow({ concepto: 'Detalle Otros Descuentos', valor: 'UF' });
      hOd.font = { bold: true };
      for (const d of ficha.descuentos) {
        wsResumen.addRow({ concepto: d.nombre_otrosdescuentos || 'Otro Descuento', valor: Number(d.valor || 0) });
      }
    }

    // Hoja 2: Detalle (Casos y Técnicas)
    const wsDetalle = workbook.addWorksheet('Detalle');
    wsDetalle.columns = [
      { header: 'ID Facturación', key: 'id_facturacion', width: 14 },
      { header: 'Empresa', key: 'empresa', width: 32 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Programa', key: 'programa', width: 28 },
      { header: 'Centro', key: 'centro', width: 24 },
      { header: 'Tipo Agua', key: 'tipoagua', width: 16 },
      { header: 'Veterinario', key: 'veterinario', width: 22 },
      { header: 'Recepción', key: 'n_recepcion', width: 14 },
      { header: 'Caso ADLAB', key: 'caso', width: 14 },
      { header: 'F. Muestreo', key: 'fecha_muestreo', width: 14 },
      { header: 'F. Informe', key: 'fecha_informe', width: 14 },
      { header: 'Técnica / Análisis', key: 'tecnica', width: 34 },
      { header: 'Órgano / Matriz', key: 'organo', width: 20 },
      { header: 'Medio', key: 'medio', width: 16 },
      { header: 'N° Análisis', key: 'n_analisis', width: 12 },
      { header: 'UF Unitario', key: 'uf_uni', width: 14 },
      { header: 'UF Total', key: 'uf_tot', width: 14 },
      { header: 'Valor UF', key: 'uf_valor', width: 14 },
      { header: 'Total Neto ($ CLP)', key: 'neto_clp', width: 18 }
    ];
    wsDetalle.getRow(1).font = { bold: true };

    for (const r of ficha.detalle || []) {
      const ufTot = round2(Number(r.uf_tot || 0));
      const ufRow = Number(r.uf_valor || ufVal || 0);
      wsDetalle.addRow({
        id_facturacion: idFac,
        empresa: r.empresa || enc.nombre_empresaservicios || '',
        fecha: r.fecha || enc.fecha_facturacion || '',
        programa: r.programa || enc.nombre_programa || '',
        centro: r.centro || '',
        tipoagua: r.tipoagua || '',
        veterinario: r.veterinario || '',
        n_recepcion: r.n_recepcion || '',
        caso: r.caso || '',
        fecha_muestreo: r.fecha_muestreo || '',
        fecha_informe: r.fecha_informe || '',
        tecnica: r.tecnica || '',
        organo: r.organo || '',
        medio: r.medio || '',
        n_analisis: Number(r.n_analisis || 0),
        uf_uni: Number(r.uf_uni || 0),
        uf_tot: ufTot,
        uf_valor: ufRow,
        neto_clp: round0(ufTot * ufRow)
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Factura_ID${idFac}.xlsx"`
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  // ==========================================================================
  // 3. OTRAS VENTAS / OTROS COBROS Y NOTAS DE CRÉDITO / DÉBITO (facturacion_otro en ADLFacturacion)
  // ==========================================================================

  async listarOtrosCobrosSalud({ id_tipodocumento = 'ALL', emitido = 'ALL', busqueda = '', limite = 300 } = {}) {
    const estado = emitido === 'S' ? 'Emitidos' : emitido === 'N' ? 'NO emitidos' : 'Todos';
    const td = id_tipodocumento && id_tipodocumento !== 'ALL' ? Number(id_tipodocumento) : null;
    let rows = await this._listarOtrosDocumentosAdlf({ id_tipodocumento: td, estado });

    if (busqueda && String(busqueda).trim() !== '') {
      const q = String(busqueda).trim().toLowerCase();
      rows = rows.filter((r) =>
        String(r.id_facturacion || '').includes(q) ||
        String(r.numero_documento || '').includes(q) ||
        String(r.nombre_empresaservicios || '').toLowerCase().includes(q) ||
        String(r.rut_empresaservicios || '').toLowerCase().includes(q) ||
        String(r.concepto_cobro || '').toLowerCase().includes(q) ||
        String(r.num_ref || '').toLowerCase().includes(q)
      );
    }

    const topN = Math.min(Math.max(Number(limite) || 300, 10), 2000);
    return rows.slice(0, topN).map((r) => ({
      ...r,
      nombre_tipodocumento:
        Number(r.id_tipodocumento) === 1 ? 'FEA (Factura Afecta Otras Ventas)' :
        Number(r.id_tipodocumento) === 11 ? 'FEE (Factura Exenta)' :
        Number(r.id_tipodocumento) === 8 ? 'NCE (Nota de Crédito Electrónica)' :
        Number(r.id_tipodocumento) === 10 ? 'NDE (Nota de Débito Electrónica)' :
        'Otro Documento'
    }));
  }

  /**
   * Busca una Factura de Casos (facturacion_enc) o de Otras Ventas (facturacion_otro) en ADLFacturacion
   * para referenciarla en una Nota de Crédito (NCE) o Nota de Débito (NDE), incluyendo sus casos para reversa.
   */
  async buscarFacturaParaNotaCredito({ folio, origen = 'CASOS' }) {
    const poolFact = await this._poolFacturacion();
    const numFolio = Number(folio);
    if (!numFolio || isNaN(numFolio)) {
      throw new Error('Debe ingresar un número de ID Facturación o Folio válido.');
    }

    if (String(origen).toUpperCase() === 'OTRAS_VENTAS') {
      const resOtro = await poolFact.request()
        .input('folio', sqlFact.Numeric(10, 0), numFolio)
        .query(`
          SELECT TOP 1
            fo.id_facturacion,
            ISNULL(NULLIF(fo.numero_documento, 0), fo.id_facturacion) AS factura,
            fo.id_empresaservicio,
            LTRIM(RTRIM(ISNULL(fo.nombre_empresaservicios, ''))) AS nombre_empresaservicios,
            LTRIM(RTRIM(ISNULL(fo.rut_empresaservicios, ''))) AS rut_empresaservicios,
            ISNULL(fo.uf, 0) AS uf,
            ISNULL(NULLIF(fo.monto_uf, 0), fo.uf_totalfac) AS uf_totalfac,
            ISNULL(NULLIF(fo.monto, 0), fo.peso_totalfac) AS peso_totalfac,
            LTRIM(RTRIM(ISNULL(NULLIF(fo.fecha_documento, ''), fo.fecha))) AS fecha_facturacion,
            LTRIM(RTRIM(ISNULL(NULLIF(fo.concepto_cobro, ''), fo.glosa))) AS glosa,
            ISNULL(fo.id_formapago, 1) AS id_formapago,
            'OTRAS_VENTAS' AS origen
          FROM dbo.facturacion_otro fo
          WHERE (fo.id_facturacion = @folio OR fo.numero_documento = @folio OR fo.factura = @folio OR fo.id_otroscobros = @folio)
            AND ISNULL(fo.eliminado, 'N') <> 'S'
          ORDER BY fo.id_facturacion DESC;
        `);
      const doc = resOtro.recordset?.[0];
      if (!doc) throw new Error(`No se encontró documento de Otras Ventas con folio/ID #${numFolio} en ADLFacturacion.`);
      if (!doc.nombre_empresaservicios) {
        const empMap = await this._cargarMetadatosEmpresas([doc.id_empresaservicio]);
        const emp = empMap.get(Number(doc.id_empresaservicio)) || {};
        doc.nombre_empresaservicios = emp.nombre_empresaservicios || '';
        doc.rut_empresaservicios = emp.rut_empresaservicios || '';
      }
      return { documento: doc, casos: [] };
    }

    const resCasos = await poolFact.request()
      .input('folio', sqlFact.Numeric(10, 0), numFolio)
      .query(`
        SELECT TOP 1
          fe.id_facturacion,
          fe.factura,
          fe.id_empresaservicio,
          LTRIM(RTRIM(ISNULL(fe.nombre_empresaservicios, ''))) AS nombre_empresaservicios,
          LTRIM(RTRIM(ISNULL(fe.rut_empresaservicios, ''))) AS rut_empresaservicios,
          ISNULL(fe.uf, 0) AS uf,
          ISNULL(fe.uf_totalfac, 0) AS uf_totalfac,
          ISNULL(fe.peso_totalfac, ROUND(ISNULL(fe.uf_totalfac, 0) * ISNULL(fe.uf, 0), 0)) AS peso_totalfac,
          LTRIM(RTRIM(ISNULL(fe.fecha_facturacion, ''))) AS fecha_facturacion,
          LTRIM(RTRIM(ISNULL(fe.glosa, ''))) AS glosa,
          ISNULL(fe.id_formapago, 1) AS id_formapago,
          'CASOS' AS origen
        FROM dbo.facturacion_enc fe
        WHERE (fe.id_facturacion = @folio OR fe.factura = @folio)
          AND ISNULL(fe.eliminado, 'N') <> 'S';
      `);

    const doc = resCasos.recordset?.[0];
    if (!doc) {
      throw new Error(`No se encontró Factura de Casos con ID Facturación o Folio #${numFolio} en ADLFacturacion.`);
    }

    if (!doc.nombre_empresaservicios) {
      const empMap = await this._cargarMetadatosEmpresas([doc.id_empresaservicio]);
      const emp = empMap.get(Number(doc.id_empresaservicio)) || {};
      doc.nombre_empresaservicios = emp.nombre_empresaservicios || '';
      doc.rut_empresaservicios = emp.rut_empresaservicios || '';
    }

    const revRes = await poolFact.request()
      .input('id_facturacion', sqlFact.Numeric(10, 0), Number(doc.id_facturacion))
      .query(`
        SELECT
          fd.id_caso,
          MAX(fd.caso) AS caso,
          MAX(fd.centro) AS centro,
          MAX(fd.programa) AS programa,
          MAX(fd.fecha_muestreo) AS fecha_muestreo,
          MAX(fd.fecha_informe) AS fecha_informe,
          SUM(ISNULL(fd.uf_caso, 0)) AS uf_caso
        FROM dbo.facturacion_det fd
        WHERE fd.id_facturacion = @id_facturacion
        GROUP BY fd.id_caso
        ORDER BY fd.id_caso ASC;
      `);

    return {
      documento: doc,
      casos: revRes.recordset || []
    };
  }

  /**
   * Crea un documento en ADLFacturacion.dbo.facturacion_otro (1=FEA, 11=FEE, 8=NCE, 10=NDE)
   * y actualiza ADLFacturacion según cod_razon:
   * - cod_razon = 1 (Anula Documento): marca facturacion_enc.eliminado = 'S' y libera facturacion_det.
   * - cod_razon = 2 (Corrige Texto): mantiene casos intactos.
   * - cod_razon = 3 (Corrige Montos / Reversa Parcial): elimina los casos seleccionados de facturacion_det y recalcula totales.
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

    const td = Number(id_tipodocumento);
    const numUf = Number(uf || 0);
    const numMontoUf = round2(Number(monto_uf || 0));
    const numMontoClp = Number(monto) > 0 ? round0(monto) : round0(numMontoUf * numUf);
    const fechaDocDmy = toDmyString(fecha_documento || new Date().toISOString().slice(0, 10));
    const empMap = await this._cargarMetadatosEmpresas([id_empresaservicio]);
    const emp = empMap.get(Number(id_empresaservicio)) || {};
    const tipoDocMap = { 1: 'FEA', 11: 'FEE', 8: 'NCE', 10: 'NDE' };
    const tipoDocStr = tipoDocMap[td] || 'OV';
    const conceptoStr = String(concepto_cobro).trim().slice(0, 200);

    const { newIdFacturacion, accionCasos } = await this._enTransaccion(async (tx) => {
      const ins = await tx.request()
        .input('id_tipodocumento', sqlFact.Numeric(10, 0), td)
        .input('tipo_documento', sqlFact.VarChar(10), tipoDocStr)
        .input('factura', sqlFact.Numeric(12, 0), Number(num_ref) || 0)
        .input('id_empresaservicio', sqlFact.Numeric(10, 0), Number(id_empresaservicio))
        .input('nombre_empresaservicios', sqlFact.VarChar(250), String(emp.nombre_empresaservicios || '').slice(0, 250))
        .input('rut_empresaservicios', sqlFact.VarChar(30), String(emp.rut_empresaservicios || '').slice(0, 30))
        .input('concepto_cobro', sqlFact.VarChar(200), conceptoStr)
        .input('glosa', sqlFact.VarChar(1000), conceptoStr)
        .input('fecha_documento', sqlFact.VarChar(10), fechaDocDmy)
        .input('fecha', sqlFact.VarChar(10), fechaDocDmy)
        .input('uf', sqlFact.Numeric(14, 4), numUf)
        .input('monto', sqlFact.Numeric(14, 0), numMontoClp)
        .input('peso_totalfac', sqlFact.Numeric(18, 0), numMontoClp)
        .input('monto_uf', sqlFact.Numeric(14, 3), numMontoUf)
        .input('uf_totalfac', sqlFact.Numeric(14, 3), numMontoUf)
        .input('observacion', sqlFact.VarChar(1000), String(observacion || '').slice(0, 1000))
        .input('observaciones', sqlFact.VarChar(1000), String(observacion || '').slice(0, 1000))
        .input('mf', sqlFact.Numeric(10, 0), 0)
        .input('tipo_ref', sqlFact.VarChar(20), String(tipo_ref || '').slice(0, 20))
        .input('num_ref', sqlFact.VarChar(20), String(num_ref || '').slice(0, 20))
        .input('fecha_ref', sqlFact.VarChar(10), toDmyString(fecha_ref))
        .input('cod_razon', sqlFact.Numeric(10, 0), Number(cod_razon) || 0)
        .input('motivo', sqlFact.VarChar(200), String(motivo || '').slice(0, 200))
        .input('nota', sqlFact.VarChar(1000), String(nota || '').slice(0, 1000))
        .input('emitido', sqlFact.VarChar(1), 'N')
        .input('eliminado', sqlFact.VarChar(1), 'N')
        .input('tipoimpuesto', sqlFact.VarChar(5), String(tipoimpuesto || 'AFE').slice(0, 5))
        .input('id_formapago', sqlFact.Numeric(10, 0), Number(id_formapago) || 1)
        .input('id_facturacion_ref', sqlFact.Int, id_facturacion_referencia ? Number(id_facturacion_referencia) : null)
        .query(`
          INSERT INTO dbo.facturacion_otro (
            id_tipodocumento, tipo_documento, factura, id_empresaservicio,
            nombre_empresaservicios, rut_empresaservicios, concepto_cobro, glosa,
            fecha_documento, fecha, uf, monto, peso_totalfac, monto_uf, uf_totalfac,
            observacion, observaciones, mf, tipo_ref, num_ref, fecha_ref,
            cod_razon, motivo, nota, emitido, eliminado, tipoimpuesto, id_formapago, id_facturacion_ref
          )
          OUTPUT INSERTED.id_facturacion
          VALUES (
            @id_tipodocumento, @tipo_documento, @factura, @id_empresaservicio,
            @nombre_empresaservicios, @rut_empresaservicios, @concepto_cobro, @glosa,
            @fecha_documento, @fecha, @uf, @monto, @peso_totalfac, @monto_uf, @uf_totalfac,
            @observacion, @observaciones, @mf, @tipo_ref, @num_ref, @fecha_ref,
            @cod_razon, @motivo, @nota, @emitido, @eliminado, @tipoimpuesto, @id_formapago, @id_facturacion_ref
          );
        `);

      const newId = Number(ins.recordset?.[0]?.id_facturacion);
      await tx.request()
        .input('id', sqlFact.Int, newId)
        .input('fac', sqlFact.Numeric(12, 0), Number(num_ref) || newId)
        .query(`
          UPDATE dbo.facturacion_otro
          SET id_otroscobros = @id,
              numero_documento = @id,
              factura = @fac
          WHERE id_facturacion = @id;
        `);

      let accion = 'NINGUNA';
      if (td === 8 && id_facturacion_referencia && String(origen_referencia).toUpperCase() === 'CASOS') {
        const idFacRef = Number(id_facturacion_referencia);
        const razon = Number(cod_razon);

        if (razon === 1) {
          await tx.request()
            .input('id_fac', sqlFact.Int, idFacRef)
            .query(`
              UPDATE dbo.facturacion_enc SET eliminado = 'S', fecha_elimina = SYSDATETIME() WHERE id_facturacion = @id_fac;
              DELETE FROM dbo.facturacion_det WHERE id_facturacion = @id_fac;
            `);
          accion = `Factura #${idFacRef} anulada en ADLFacturacion: sus casos fueron liberados para volver a prefacturar.`;
        } else if (razon === 3 && Array.isArray(casos_reversar_ids) && casos_reversar_ids.length > 0) {
          const cleanCasosIds = casos_reversar_ids.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
          if (cleanCasosIds.length > 0) {
            await tx.request()
              .input('id_fac', sqlFact.Int, idFacRef)
              .query(`
                DELETE FROM dbo.facturacion_det
                WHERE id_facturacion = @id_fac
                  AND id_caso IN (${cleanCasosIds.join(',')});
              `);
            await this._recalcularTotalesPrefactura(tx, idFacRef);
            accion = `Se reversaron ${cleanCasosIds.length} caso(s) de la factura #${idFacRef} en ADLFacturacion.`;
          }
        } else if (razon === 2) {
          accion = `Nota de Crédito por corrección de texto registrada (casos de factura #${idFacRef} se mantienen intactos).`;
        }
      }

      return { newIdFacturacion: newId, accionCasos: accion };
    });

    return {
      id_otroscobros: newIdFacturacion,
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
   * Lista los documentos disponibles para los 5 flujos DTE desde ADLFacturacion + catálogos de LaboratorioADL:
   * - FEA_CASOS, FEA_OTROS, FEE, NCE, NDE
   */
  async listarDocumentosDteSalud({ flujo = 'FEA_CASOS', solo_pendientes = true, busqueda = '' } = {}) {
    const f = String(flujo || 'FEA_CASOS').toUpperCase();
    const estado = solo_pendientes ? 'NO emitidos' : 'Todos';

    let rows = [];
    if (f === 'FEA_CASOS') {
      rows = await this._listarFacturasCasosAdlf({ estado });
    } else if (f === 'FEA_OTROS') {
      rows = await this._listarOtrosDocumentosAdlf({ id_tipodocumento: 1, tipoimpuesto: 'AFE', estado });
    } else if (f === 'FEE') {
      rows = await this._listarOtrosDocumentosAdlf({ id_tipodocumento: 11, estado });
    } else if (f === 'NCE') {
      rows = await this._listarOtrosDocumentosAdlf({ id_tipodocumento: 8, estado });
    } else if (f === 'NDE') {
      rows = await this._listarOtrosDocumentosAdlf({ id_tipodocumento: 10, estado });
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
   * Construye el archivo plano CSV/TXT de 35 columnas (cursor felectronicatxt) desde ADLFacturacion
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

    const poolFact = await this._poolFacturacion();
    const f = String(flujo || 'FEA_CASOS').toUpperCase();

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

        const ocRes = await poolFact.request()
          .input('id_facturacion', sqlFact.Numeric(10, 0), idFac)
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
          await poolFact.request()
            .input('id_facturacion', sqlFact.Int, idFac)
            .query(`UPDATE dbo.facturacion_enc SET emitido = 'S' WHERE id_facturacion = @id_facturacion;`);
        }
      } else {
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
          await poolFact.request()
            .input('id_facturacion', sqlFact.Int, idFac)
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

