// Lecturas de fichas desde el ESQUEMA NUEVO, con la misma respuesta que ficha.service.js (legado) y con ids legados (mig_id_map).
// Fase 1 (lectura en sombra). Se activa con FICHAS_DB=nuevo (ver el final de ficha.service.js); por omisión sigue el legado.
import sql from 'mssql';
import fs from 'node:fs';
import path from 'node:path';
import { getConnectionNueva } from '../config/databaseNueva.js';

const leg = (tl) => `(SELECT id_nuevo, MIN(id_legado) id_leg FROM mig_id_map WHERE tabla_legado='${tl}' AND id_nuevo > 0 GROUP BY id_nuevo)`;
const consulta = async (texto, params = {}) => { const pool = await getConnectionNueva(); const r = pool.request(); for (const [k, v] of Object.entries(params)) r.input(k, ...(Array.isArray(v) ? v : [v])); return (await r.query(texto)).recordset; };
const SN = (b) => (b == null ? null : b ? 'S' : 'N');

// Textos legados fijos por estado (tabla mae_validaciontecnica del legado; no varía). El código en fic_estado_ficha es el mismo que usa el motor.
const ESTADO_TEXTO = { APROBADA_TECNICA: 'APROBADA ÁREA TÉCNICA', RECHAZADA_TECNICA: 'RECHAZADA ÁREA TÉCNICA', PENDIENTE_TECNICA: 'PENDIENTE ÁREA TÉCNICA', RECHAZADA_COORDINACION: 'RECHAZADA ÁREA COORDINACIÓN',
  EN_PROCESO: 'EN PROCESO', PENDIENTE_PROGRAMACION: 'PENDIENTE PROGRAMACIÓN', CANCELADO: 'CANCELADO', CICLO_FINALIZADO: 'CICLO FINALIZADO' };
const ESTADO_A_VALIDACION = { APROBADA_TECNICA: 1, RECHAZADA_TECNICA: 2, PENDIENTE_TECNICA: 3, RECHAZADA_COORDINACION: 4, EN_PROCESO: 5, PENDIENTE_PROGRAMACION: 6, CANCELADO: 7, CICLO_FINALIZADO: 8 };
const ESTADO_VISITA_ID_MOD = { POR_ASIGNAR: 0, PENDIENTE: 1, EJECUTADO: 3, SUSPENDIDO_ADL: 4, SUSPENDIDO_TERRENO: 5, CANCELADO_ADL: 6, CANCELADO_TERRENO: 7 };
const dmyDate = (d) => (d ? `${String(new Date(d).getUTCDate()).padStart(2, '0')}/${String(new Date(d).getUTCMonth() + 1).padStart(2, '0')}/${new Date(d).getUTCFullYear()}` : null);

export const fichaNuevo = {

  // Listado general (legado: SP MAM_FichaComercial_ConsultaComercial). Orden: id descendente, igual que el servicio.
  async getAllFichas() {
    const filas = await consulta(`SELECT f.*, mf.id_leg, u.nombre_usuario, o.nombre AS nombre_objetivo, s.nombre AS nombre_subarea, ef.codigo AS estado_codigo
      FROM fic_ficha f JOIN ${leg('App_Ma_FichaIngresoServicio_ENC')} mf ON mf.id_nuevo = f.id
      LEFT JOIN usr_usuario u ON u.id = f.id_usuario_creador LEFT JOIN fic_estado_ficha ef ON ef.id = f.id_estado_ficha
      LEFT JOIN fic_objetivo_muestreo o ON o.id = f.id_objetivo_muestreo LEFT JOIN fic_subarea s ON s.id = f.id_subarea ORDER BY mf.id_leg DESC`);
    return filas.map((r) => ({ id_fichaingresoservicio: r.id_leg, fichaingresoservicio: String(r.id_leg), fecha: dmyDate(r.fecha_ficha_comercial), empresa_facturar: r.snap_nombre_empresa, centro: r.snap_nombre_centro,
      empresa_servicio: r.snap_nombre_empresa_servicio, nombre_objetivomuestreo_ma: r.nombre_objetivo, nombre_subarea: r.nombre_subarea, responsablemuestreo: r.snap_nombre_persona_responsable, nombre_usuario: r.nombre_usuario,
      tipo_fichaingresoservicio: r.tipo, estado_ficha: ESTADO_TEXTO[r.estado_codigo] ?? null, id_validaciontecnica: ESTADO_A_VALIDACION[r.estado_codigo] ?? null }));
  },

  // Muestreos ejecutados (agenda con estado 3). OJO: "empresa_servicio" replica un cruce del legado que en realidad busca, por el id de
  // servicio, una fila de EMPRESA (no de servicio) — es un error del legado (columnas con nombres parecidos) que se conserva tal cual.
  async getMuestreosEjecutados() {
    // La visita no pasa por mig_id_map: su id legado vive en fic_visita.id_agendamam_legacy (columna propia; ver sync/handlers/fic.js).
    const filas = await consulta(`SELECT v.*, v.id_agendamam_legacy AS agenda_leg, p1.fecha_programada, f.tipo, mf.id_leg AS ficha_leg, CAST(f.fecha_ficha_comercial AS DATE) AS fecha_ficha_comercial, f.snap_nombre_empresa, f.snap_nombre_centro, f.id_empresa_servicio, f.id_empresa, f.id_centro, f.id_subarea, f.id_objetivo_muestreo,
        c.nombre AS nombre_subarea, o.nombre AS nombre_objetivo, mm.nombre AS muestreador, mm2.nombre AS muestreador_retiro, ef.nombre AS estado_ficha_nombre
      FROM fic_visita v JOIN fic_visita_proceso p1 ON p1.id_visita = v.id AND p1.tipo IN ('UNICO', 'INSTALACION')
      LEFT JOIN per_persona mm ON mm.id = p1.id_persona_muestreador
      LEFT JOIN fic_visita_proceso p2 ON p2.id_visita = v.id AND p2.tipo IN ('UNICO', 'RETIRO') LEFT JOIN per_persona mm2 ON mm2.id = p2.id_persona_muestreador
      JOIN fic_ficha f ON f.id = v.id_ficha JOIN ${leg('App_Ma_FichaIngresoServicio_ENC')} mf ON mf.id_nuevo = f.id
      LEFT JOIN fic_subarea c ON c.id = f.id_subarea LEFT JOIN fic_objetivo_muestreo o ON o.id = f.id_objetivo_muestreo LEFT JOIN fic_estado_ficha ef ON ef.id = f.id_estado_ficha
      WHERE v.id_estado_visita = (SELECT id FROM fic_estado_visita WHERE codigo = 'EJECUTADO') ORDER BY v.codigo_caso_adlab DESC, p1.fecha_programada DESC, mf.id_leg DESC`);
    const legMap = async (tl) => new Map((await consulta(`SELECT id_nuevo, MIN(id_legado) id_legado FROM mig_id_map WHERE tabla_legado='${tl}' AND id_nuevo > 0 GROUP BY id_nuevo`)).map((r) => [r.id_nuevo, r.id_legado]));
    const [idLegEmpresa, idLegCentro, idLegSubarea, idLegObjetivo, idLegServicio] = await Promise.all([legMap('mae_empresa'), legMap('mae_centro'), legMap('mae_subarea'), legMap('mae_objetivomuestreo_ma'), legMap('mae_empresaservicios')]);
    const idNuevoEmpresaDeLegado = new Map([...idLegEmpresa].map(([nuevo, legado]) => [legado, nuevo]));   // inversa: id legado de mae_empresa → id nuevo de cli_empresa
    const nombresEmpresa = new Map((await consulta(`SELECT id, razon_social FROM cli_empresa`)).map((r) => [r.id, r.razon_social]));
    return filas.map((r) => {
      // El legado busca, por error, "el nombre de la EMPRESA cuyo id coincide con el id del SERVICIO de esta ficha" (columnas
      // homónimas mal cruzadas). Se conserva igual: id de servicio legado → tratado como id de empresa legado → su nombre.
      const legSrv = idLegServicio.get(r.id_empresa_servicio); const idEmpBug = legSrv != null ? idNuevoEmpresaDeLegado.get(legSrv) : null;
      return { id_agendamam: r.agenda_leg, caso_adlab: r.codigo_caso_adlab ?? '', frecuencia_correlativo: r.correlativo_legacy, fecha_muestreo: r.fecha_programada ?? null, fecha_retiro: r.fecha_programada ?? null,
        fecha_completado: r.completada_en, id_estadomuestreo: 3, estado_muestreo: 'Ejecutado', id_fichaingresoservicio: r.ficha_leg, correlativo_ficha: String(r.ficha_leg), fecha_fichacomercial: r.fecha_ficha_comercial,
        id_empresa: idLegEmpresa.get(r.id_empresa) ?? null, cliente: r.snap_nombre_empresa, id_empresaservicio: legSrv ?? null, empresa_servicio: idEmpBug != null ? nombresEmpresa.get(idEmpBug) ?? null : null,
        id_centro: idLegCentro.get(r.id_centro) ?? null, centro: r.snap_nombre_centro, id_subarea: idLegSubarea.get(r.id_subarea) ?? null, nombre_subarea: r.nombre_subarea,
        id_objetivomuestreo_ma: idLegObjetivo.get(r.id_objetivo_muestreo) ?? null, objetivo: r.nombre_objetivo, muestreador: r.muestreador, muestreador_retiro: r.muestreador_retiro,
        estado_ficha: r.estado_ficha_nombre, realizado_por_gem: r.snap_nombre_confirma_caso, fecha_realizado_gem: r.caso_confirmado_en };
    });
  },

  // Historial de una ficha (más reciente primero). El legado devuelve [] si algo falla; aquí el error se propaga y el envoltorio cae al legado.
  async getHistorial(id) {
    const filas = await consulta(`SELECT h.*, mh.id_leg AS id_hist_leg, u.nombre_usuario, u.nombre AS nombre_real
      FROM fic_ficha_historial h JOIN ${leg('mae_ficha_historial')} mh ON mh.id_nuevo = h.id JOIN ${leg('App_Ma_FichaIngresoServicio_ENC')} mf ON mf.id_nuevo = h.id_ficha
      LEFT JOIN usr_usuario u ON u.id = h.id_usuario WHERE mf.id_leg = @id ORDER BY h.fecha DESC`, { id: [sql.Numeric(10, 0), Number(id)] });
    return filas.map((r) => ({ id_historial: r.id_hist_leg, fecha: r.fecha, accion: r.accion, observacion: r.observacion ?? '', nombre_usuario: r.nombre_usuario ?? null, nombre_real: r.nombre_real ?? null, estado_anterior: r.estado_anterior ?? '', estado_nuevo: r.estado_nuevo ?? '' }));
  },

  // Equipos usados en una visita (por ficha y correlativo "ficha-visita-estado-id"). Lo de tienefc/errores/versión es la foto del equipo al usarlo.
  async getSamplingEquipos(idFicha, correlativo) {
    const filas = await consulta(`SELECT u.*, v.correlativo_legacy, mf.id_leg AS ficha_leg, me.id_leg AS equipo_leg, mp.id_leg AS persona_leg, h.version AS version_uso,
        e.nombre AS nombre_equipo, e.codigo AS codigo_equipo, c.tipo_equipo
      FROM eqp_uso u JOIN fic_visita v ON v.id = u.id_visita JOIN ${leg('App_Ma_FichaIngresoServicio_ENC')} mf ON mf.id_nuevo = v.id_ficha
      JOIN eqp_equipo e ON e.id = u.id_equipo JOIN ${leg('mae_equipo')} me ON me.id_nuevo = e.id JOIN eqp_catalogo c ON c.id = e.id_equipo_catalogo JOIN eqp_historial h ON h.id = u.id_equipo_historial
      LEFT JOIN ${leg('mae_muestreador')} mp ON mp.id_nuevo = u.id_persona
      WHERE mf.id_leg = @f AND v.correlativo_legacy = @c AND u.estado = 'ACTIVO'`, { f: [sql.Numeric(10, 0), Number(idFicha)], c: [sql.VarChar(50), correlativo] });
    return filas.map((r) => ({ id_fichaingresoservicio: r.ficha_leg, frecuencia_correlativo: r.correlativo_legacy, id_equipo: r.equipo_leg, tienefc: SN(r.snap_tiene_factor_correccion), error0: r.snap_error_0, error15: r.snap_error_15, error30: r.snap_error_30,
      id_muestreador: r.persona_leg ?? 0, seleccionado: SN(r.seleccionado), usado_instalacion: SN(r.usado_instalacion), usado_retiro: SN(r.usado_retiro), version: r.version_uso, estado: r.estado,
      nombre_equipo: r.nombre_equipo, codigo_equipo: r.codigo_equipo, tipo_equipo: r.tipo_equipo }));
  },

  // Detalle de una visita para la pantalla de ejecución (legado: getExecutionDetail). Reintenta con "Ejecutado" si el correlativo
  // "Pendiente" no tiene fila, igual que el servicio. La parte de archivos en disco se copia tal cual (no depende de la base).
  // NOTA (diferencia conocida, documentada): el legado marca "supervisado" con cualquier id_supervisor > 0, INCLUIDO el marcador de
  // "sin supervisión" (1002) — un error del legado. El esquema nuevo no conserva ese marcador (se resuelve a NULL al migrar), así que
  // aquí "supervisado" refleja si hubo un supervisor de verdad. Ver task.md.
  async getExecutionDetail(id, correlativo) {
    const buscar = async (frec) => {
      const filas = await consulta(`SELECT v.*, v.id_agendamam_legacy AS agenda_leg, f.tipo AS tipo_ficha, e.razon_social AS nombre_empresa, ce.nombre AS nombre_centro, o.nombre AS nombre_objetivo, s.nombre AS nombre_subarea,
          f.observaciones_coordinacion, f.referencia_googlemaps, mf.id_leg AS ficha_leg, f.medicion_caudal, dh.nombre AS nombre_dispositivohidraulico, f.coordenadas_utm AS ma_coordenadas,
          ct.nombre AS nombre_contacto, ct.email AS email_contacto, ins.nombre AS instrumento_nombre, f.numero_instrumento, f.anio_instrumento, ev.codigo AS estado_visita_codigo,
          p1.fecha_programada AS fecha_i, p1.observador_nombre AS obs_nombre_i, p1.observador_cargo AS obs_cargo_i, p1.observaciones AS obs_i, p1.completado AS completado_i, p1.id_persona_supervisor AS sup_i,
          p2.completado AS completado_t,
          -- "retiro" propiamente tal (no la ficha Puntual, que guarda todo en un solo proceso UNICO): el legado deja estas columnas en NULL
          -- para Puntual (nunca tuvo un segundo proceso), así que aquí solo se llenan si existe un proceso RETIRO de verdad.
          p2r.observador_nombre AS obs_nombre_t, p2r.observador_cargo AS obs_cargo_t, p2r.observaciones AS obs_t, p2r.id_persona_supervisor AS sup_t,
          mmi.nombre AS muestreador_inicio, mmt.nombre AS muestreador_retiro,
          medI.medido_en AS medido_i, medI.ph AS ph_i, medI.temperatura AS temp_i, medI.temperatura_corregida AS tempcorr_i, medI.totalizador AS tot_i, medI.id_equipo_temperatura AS eqfc_i,
          medT.medido_en AS medido_t, medT.ph AS ph_t, medT.temperatura AS temp_t, medT.temperatura_corregida AS tempcorr_t, medT.totalizador AS tot_t, medT.id_equipo_temperatura AS eqfc_t,
          medC.medido_en AS medido_c, medC.ph AS ph_c, medC.temperatura AS temp_c, medC.temperatura_corregida AS tempcorr_c
        FROM fic_visita v
        JOIN fic_ficha f ON f.id = v.id_ficha JOIN ${leg('App_Ma_FichaIngresoServicio_ENC')} mf ON mf.id_nuevo = f.id
        LEFT JOIN cli_empresa e ON e.id = f.id_empresa LEFT JOIN cli_centro ce ON ce.id = f.id_centro
        LEFT JOIN fic_objetivo_muestreo o ON o.id = f.id_objetivo_muestreo LEFT JOIN fic_subarea s ON s.id = f.id_subarea LEFT JOIN fic_dispositivo_hidraulico dh ON dh.id = f.id_dispositivo_hidraulico
        LEFT JOIN cli_contacto ct ON ct.id = f.id_contacto LEFT JOIN fic_instrumento_ambiental ins ON ins.id = f.id_instrumento_ambiental LEFT JOIN fic_estado_visita ev ON ev.id = v.id_estado_visita
        LEFT JOIN fic_visita_proceso p1 ON p1.id_visita = v.id AND p1.tipo IN ('UNICO', 'INSTALACION') LEFT JOIN per_persona mmi ON mmi.id = p1.id_persona_muestreador
        LEFT JOIN fic_visita_proceso p2 ON p2.id_visita = v.id AND p2.tipo IN ('UNICO', 'RETIRO') LEFT JOIN per_persona mmt ON mmt.id = p2.id_persona_muestreador
        LEFT JOIN fic_visita_proceso p2r ON p2r.id_visita = v.id AND p2r.tipo = 'RETIRO'
        LEFT JOIN fic_visita_medicion medI ON medI.id_proceso = p1.id AND medI.momento = 'INICIO'
        LEFT JOIN fic_visita_medicion medT ON medT.id_proceso = p2.id AND medT.momento = 'TERMINO'
        LEFT JOIN fic_visita_medicion medC ON medC.id_proceso = p2.id AND medC.momento = 'COMPUESTA'
        WHERE mf.id_leg = @id AND v.correlativo_legacy = @c`, { id: [sql.Int, Number(id)], c: [sql.VarChar(50), frec] });
      return filas[0];
    };
    let f = await buscar(String(correlativo).trim());
    if (!f && String(correlativo).includes('Pendiente')) f = await buscar(String(correlativo).trim().replace('Pendiente', 'Ejecutado'));
    if (!f) throw new Error('No se encontró la ficha con la frecuencia proporcionada');
    const frecuenciaReal = f.correlativo_legacy;

    // Termómetro de corrección (mismo id para toda la visita en el legado): se toma de cualquier medición que lo tenga.
    const eqFcNuevo = f.eqfc_i ?? f.eqfc_t ?? null;
    const eqFc = eqFcNuevo ? (await consulta(`SELECT id_legado FROM mig_id_map WHERE tabla_legado='mae_equipo' AND id_nuevo=@i`, { i: [sql.Int, eqFcNuevo] }))[0]?.id_legado ?? null : null;
    const supervisorLegado = async (idNuevo) => (idNuevo ? (await consulta(`SELECT id_legado FROM mig_id_map WHERE tabla_legado='mae_muestreador' AND id_nuevo=@i`, { i: [sql.Int, idNuevo] }))[0]?.id_legado ?? null : null);
    const [supI, supT] = await Promise.all([supervisorLegado(f.sup_i), supervisorLegado(f.sup_t)]);
    // Al combinar fecha+hora en una sola columna (fic_visita_medicion.medido_en) se perdió si la hora venía realmente vacía en el legado:
    // "00:00" resultante de esa combinación se trata como "sin hora" (heurística: un muestreo real a la medianoche exacta es improbable).
    const hora = (d) => { if (!d) return null; const h = new Date(d).toISOString().slice(11, 16); return h === '00:00' ? null : h; };
    const dmy = (d) => (d ? `${String(new Date(d).getUTCDate()).padStart(2, '0')}/${String(new Date(d).getUTCMonth() + 1).padStart(2, '0')}/${new Date(d).getUTCFullYear()}` : null);
    const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
    // Reconstrucción del texto libre del legado a partir de catálogo+número+año (ver instrumento() en migracion-fic.mjs): cuando el
    // catálogo resuelto es "Otro", el texto original completo quedó guardado tal cual en "numero" (con el año ya incluido); para
    // cualquier otro catálogo, el texto es "<nombre del catálogo> <número>[/<año>]".
    const instrumentoTexto = !f.instrumento_nombre ? null : /^otro$/i.test(f.instrumento_nombre.trim()) ? (f.numero_instrumento ?? f.instrumento_nombre)
      : [f.instrumento_nombre, f.numero_instrumento].filter(Boolean).join(' ') + (f.anio_instrumento ? `/${f.anio_instrumento}` : '');
    // La fecha/hora "compuesta" del legado empieza en el centinela 1900-01-01 y solo se ve como NULL genuino una vez la visita se
    // ejecuta (comportamiento observado en los datos; no hay una regla documentada distinta). Se replica esa condición.
    const ejecutada = f.estado_visita_codigo === 'EJECUTADO';
    const fechaCompuesta = isoDate(f.medido_c) ?? (ejecutada ? null : '1900-01-01');

    const ficha = {
      id_agendamam: f.agenda_leg, frecuencia_correlativo: f.correlativo_legacy, caso_adlab: f.codigo_caso_adlab ?? '', nombre_empresa: f.nombre_empresa, nombre_centro: f.nombre_centro,
      tipo_fichaingresoservicio: f.tipo_ficha, fecha_muestreo: dmy(f.fecha_i), nombre_objetivomuestreo_ma: f.nombre_objetivo, instrumento_ambiental: instrumentoTexto, nombre_subarea: f.nombre_subarea,
      observaciones_coordinador: f.observaciones_coordinacion, referencia_googlemaps: f.referencia_googlemaps, id_fichaingresoservicio: f.ficha_leg, muestreador_inicio: f.muestreador_inicio ?? '', muestreador_retiro: f.muestreador_retiro,
      ma_muestreo_horai: hora(f.medido_i), ma_muestreo_fechai: isoDate(f.medido_i) ?? '1900-01-01', ma_temperaturai: f.temp_i, ma_phi: f.ph_i, totalizador_inicio: f.tot_i,
      ma_muestreo_horat: hora(f.medido_t), ma_muestreo_fechat: isoDate(f.medido_t) ?? isoDate(f.fecha_i) ?? '1900-01-01', ma_temperaturat: f.temp_t, ma_pht: f.ph_t, totalizador_final: f.tot_t,
      ma_hora_compuesta: hora(f.medido_c), ma_fecha_compuesta: fechaCompuesta, ma_temperatura_compuesta: f.temp_c, ma_ph_compuesta: f.ph_c,
      vdd: f.vdd, id_archivo_terreno: f.codigo_archivo_terreno, medicion_caudal: f.medicion_caudal, nombre_dispositivohidraulico: f.nombre_dispositivohidraulico,
      instalacion_completado: SN(f.completado_i), retiro_completado: SN(f.completado_t),
      condicionmedicion_flujolaminar: SN(f.cond_flujo_laminar), condicionmedicion_velocidaduniforme: SN(f.cond_velocidad_uniforme), condicionmedicion_observacion: f.cond_observacion,
      nombre_observadorterreno: f.obs_nombre_i ?? null, cargo_observadorterreno: f.obs_cargo_i ?? null, nombre_observadorterreno_retiro: f.obs_nombre_t ?? null, cargo_observadorterreno_retiro: f.obs_cargo_t ?? null,
      observaciones_muestreador: f.obs_i, observaciones_muestreador2: f.obs_t, nombre_contacto: f.nombre_contacto, email_contacto: f.email_contacto,
      temperatura_corregidai: f.tempcorr_i, temperatura_corregidat: f.tempcorr_t, temperatura_corregidacompuesta: f.tempcorr_c, temperatura_fc: eqFc,
      id_supervisor: supI ?? 0, id_supervisor_retiro: supT, ma_coordenadas: f.ma_coordenadas, fechaderivado: '01/01/1900', horaderivado: null,
      // El legado la saca de CUALQUIER resultado de Laboratorio de esta visita (sin ORDER BY: "el primero que encuentre" — se
      // replica igual, con el laboratorio EFECTIVO si el resultado lo cambió, o si no el planificado en el análisis).
      laboratorio_derivacion_nombre: (await consulta(`SELECT TOP 1 COALESCE(le.nombre, lp.nombre) nombre FROM fic_resultado r JOIN fic_ficha_analisis a ON a.id = r.id_ficha_analisis
          LEFT JOIN fic_laboratorio_ensayo le ON le.id = r.id_laboratorio_ensayo_efectivo LEFT JOIN fic_laboratorio_ensayo lp ON lp.id = a.id_laboratorio_ensayo
        WHERE r.id_visita = @v AND a.tipo_analisis = 'LABORATORIO'`, { v: [sql.Int, f.id] }))[0]?.nombre ?? null,
      realizado_por_gem: f.snap_nombre_confirma_caso, fecha_realizado_gem: f.caso_confirmado_en,
    };
    // El legado calcula latitud/longitud desde referencia_googlemaps pero nunca las agrega a la respuesta (usa la fila sin
    // aumentar, "ficha: f", no la variable "fichaData" que arma con esos campos) — un bug del legado; se replica tal cual.
    const fichaData = ficha;

    const labFilas = await consulta(`SELECT l1.nombre AS lab1, l2.nombre AS lab2
      FROM fic_ficha_analisis a JOIN fic_visita v ON v.id_ficha = a.id_ficha LEFT JOIN fic_laboratorio_ensayo l1 ON l1.id = a.id_laboratorio_ensayo LEFT JOIN fic_laboratorio_ensayo l2 ON l2.id = a.id_laboratorio_ensayo_suplente
      WHERE v.id = @v AND a.tipo_analisis = 'LABORATORIO' ORDER BY CASE WHEN a.id_laboratorio_ensayo_suplente IS NOT NULL THEN 0 ELSE 1 END`, { v: [sql.Int, f.id] });
    const laboratorios = labFilas[0] ? { lab_principal: labFilas[0].lab1 ?? null, lab_suplente: labFilas[0].lab2 ?? null } : { lab_principal: null, lab_suplente: null };

    const analisisFilas = await consulta(`SELECT t.nombre AS parametro, a.snap_precio_uf, r.snap_limite_max_d, r.snap_limite_max_h, r.valor_texto, a.tipo_analisis,
        a.id_laboratorio_ensayo, l1.nombre AS lab1, ml1.id_legado AS leg1, a.id_laboratorio_ensayo_suplente, l2.nombre AS lab2, ml2.id_legado AS leg2
      FROM fic_resultado r JOIN fic_ficha_analisis a ON a.id = r.id_ficha_analisis JOIN cat_tecnica t ON t.id = a.id_tecnica
      LEFT JOIN fic_laboratorio_ensayo l1 ON l1.id = a.id_laboratorio_ensayo LEFT JOIN fic_laboratorio_ensayo l2 ON l2.id = a.id_laboratorio_ensayo_suplente
      LEFT JOIN mig_id_map ml1 ON ml1.tabla_legado='mae_laboratorioensayo' AND ml1.id_nuevo=a.id_laboratorio_ensayo LEFT JOIN mig_id_map ml2 ON ml2.tabla_legado='mae_laboratorioensayo' AND ml2.id_nuevo=a.id_laboratorio_ensayo_suplente
      WHERE r.id_visita = @v ORDER BY t.nombre`, { v: [sql.Int, f.id] });
    const cualquierSuplente = analisisFilas.find((r) => r.leg2 != null);
    const analisis = analisisFilas.map((r) => ({ parametro: r.parametro, uf_individual: r.snap_precio_uf, limitemax_d: r.snap_limite_max_d, limitemax_h: r.snap_limite_max_h,
      valor: r.tipo_analisis === 'LABORATORIO' ? 'Lab' : (r.valor_texto ?? ''), tipo_analisis: r.tipo_analisis === 'LABORATORIO' ? 'Laboratorio' : 'Terreno',
      id_laboratorioensayo: r.leg1 ?? 0, nombre_laboratorioensayo: r.lab1 ?? '', id_laboratorioensayo_2: cualquierSuplente?.leg2 ?? 0, nombre_laboratorioensayo_2: cualquierSuplente?.lab2 ?? null }));

    const equipos = (await consulta(`SELECT e.nombre, e.codigo, u.usado_instalacion, u.usado_retiro FROM eqp_uso u JOIN eqp_equipo e ON e.id = u.id_equipo
      WHERE u.id_visita = @v AND u.seleccionado = 1 AND u.estado = 'ACTIVO'`, { v: [sql.Int, f.id] })).map((r) => ({ nombre: r.nombre, codigo: r.codigo, usado_instalacion: SN(r.usado_instalacion), usado_retiro: SN(r.usado_retiro) }));

    // Archivos en disco (idéntico al servicio: no depende de la base).
    const media = { ma_fotografia: '' }; const signaturesRaw = [];
    const rootFotosPath = process.env.RUTA_FOTOS || 'C:\\Users\\vremolcoy\\Documents\\FOTOS APP';
    const carpeta = path.join(rootFotosPath, frecuenciaReal.trim());
    if (fs.existsSync(carpeta)) {
      try {
        const fsPhotos = [], fsDocs = [];
        for (const file of fs.readdirSync(carpeta)) {
          const publicUrl = `/fotos/${frecuenciaReal.trim()}/${file}`; const lower = file.toLowerCase();
          if (lower.includes('firma') && lower.endsWith('.png')) signaturesRaw.push({ nombre: file, ruta: publicUrl, tipo: lower.includes('instalacion') ? 'instalacion' : lower.includes('retiro') ? 'retiro' : 'desconocido',
            rol: lower.includes('muestreador') ? 'muestreador' : lower.includes('observador') ? 'observador' : lower.includes('supervisor') ? 'supervisor' : 'otro' });
          else if (lower.includes('foto') && /\.(jpg|jpeg|png)$/i.test(file)) fsPhotos.push(publicUrl);
          else if (lower.endsWith('.pdf')) {
            if (lower.startsWith('foma_')) fsDocs.push({ nombre: file, tipo: 'FoMa', ruta: publicUrl, label: 'Documento FoMa' });
            else if (lower.startsWith('cadenacustodia_')) {
              let labName = 'General'; const prefixRegex = new RegExp(`^cadenacustodia_${frecuenciaReal.trim()}_`, 'i');
              if (prefixRegex.test(file)) labName = file.replace(prefixRegex, '').replace(/\.pdf$/i, '').replace(/_/g, ' ');
              else { const parts = file.split('_'); if (parts.length > 2) labName = parts.slice(2).join(' ').replace(/\.pdf$/i, ''); }
              fsDocs.push({ nombre: file, tipo: 'Cadena de Custodia', ruta: publicUrl, label: labName });
            }
          }
        }
        media.ma_fotografia = fsPhotos.join(';'); media.documentos = fsDocs;
      } catch { /* carpeta ilegible: se deja vacío, como el servicio */ }
    }

    return {
      ficha: fichaData, equipos, analisis, laboratorios, media,
      // OJO (bug del legado, se replica): la condición "|| f.ma_muestreo_fechai" nunca es falsa (CONVERT nunca da NULL: usa el
      // centinela 1900-01-01), así que instalación y retiro quedan poblados siempre, complete o no la visita.
      procesos: {
        instalacion: { nombreMuestreador: ficha.muestreador_inicio || 'S/D', fecha: ficha.ma_muestreo_fechai, hora: ficha.ma_muestreo_horai,
          nombreObservador: ficha.nombre_observadorterreno || 'S/D', cargoObservador: ficha.cargo_observadorterreno || 'S/D', observaciones: ficha.observaciones_muestreador || 'Sin observaciones.',
          supervisado: ficha.id_supervisor ? 'S' : 'N', firmas: signaturesRaw.filter((x) => x.tipo === 'instalacion'),
          condiciones: { flujoLaminar: ficha.condicionmedicion_flujolaminar, velUniforme: ficha.condicionmedicion_velocidaduniforme, observaciones: ficha.condicionmedicion_observacion } },
        retiro: { nombreMuestreador: ficha.muestreador_retiro || 'S/D', fecha: ficha.ma_muestreo_fechat, hora: ficha.ma_muestreo_horat,
          nombreObservador: ficha.nombre_observadorterreno_retiro || 'S/D', cargoObservador: ficha.cargo_observadorterreno_retiro || 'S/D', observaciones: ficha.observaciones_muestreador2 || 'Sin observaciones.',
          supervisado: ficha.id_supervisor_retiro ? 'S' : 'N', derivacion: { laboratorio: ficha.laboratorio_derivacion_nombre || 'Interno', fecha: ficha.fechaderivado, hora: ficha.horaderivado },
          firmas: signaturesRaw.filter((x) => x.tipo === 'retiro'), condiciones: { flujoLaminar: ficha.condicionmedicion_flujolaminar, velUniforme: ficha.condicionmedicion_velocidaduniforme, observaciones: ficha.condicionmedicion_observacion } },
      },
    };
  },

  // Detalle completo de una ficha para la pantalla de edición (legado: getFichaById). El SP "ENC_unaficha" del legado siempre
  // devuelve 0 filas (verificado con datos reales), así que el servicio SIEMPRE cae a su consulta de respaldo — es ESA consulta,
  // más sus dos enriquecimientos posteriores (uno de nombres, otro de "parityCheck"), la que se replica aquí en una sola consulta.
  // Columnas del ENC del legado que NO están en el esquema nuevo pero son siempre el mismo valor constante en los datos reales
  // (verificado en las 12 fichas): ficha_habilitado='S', sincronizado='N', condicionmedicion_*='', coordenadas_ruta='',
  // ciclo_notificado='N', id_tipoagua=NULL. Se devuelven fijas.
  // Textos de estado propios de esta pantalla (un switch hardcodeado en el legado, con mayúsculas y redacción DISTINTAS a las de
  // getAllFichas): el estado 1 (aprobada técnica) se muestra como "Pendiente Área Coordinación" porque es transitorio (el propio
  // trigger avanza la ficha); el estado 0 se oculta (null); el estado 8 no está en ese switch y cae al texto de mae_validaciontecnica.
  async getFichaById(id) {
    const ESTADO_DETALLE = { PENDIENTE_TECNICA: 'Pendiente Área Técnica', RECHAZADA_TECNICA: 'Rechazada Área Técnica', APROBADA_TECNICA: 'Pendiente Área Coordinación',
      RECHAZADA_COORDINACION: 'Rechazada Área Coordinación', EN_PROCESO: 'En Proceso', PENDIENTE_PROGRAMACION: 'Pendiente Programación', CANCELADO: 'Cancelado' };
    const filas = await consulta(`SELECT f.*, mf.id_leg, u.nombre_usuario, ef.codigo AS estado_codigo, ef.nombre AS estado_nombre,
        e.nombre AS nombre_empresaservicios, e.contacto_nombre AS srv_contacto_nombre, e.contacto_email AS srv_contacto_email,
        em.razon_social AS nombre_empresa, ce.nombre AS nombre_centro, ce.codigo AS codigo_centro,
        mcom.id_leg AS leg_comuna, com.nombre AS nombre_comuna, mreg.id_leg AS leg_region, reg.nombre AS nombre_region,
        mla.id_leg AS leg_lugar, la.nombre AS nombre_lugaranalisis, mob.id_leg AS leg_objetivo, ob.nombre AS nombre_objetivomuestreo_ma,
        mca.id_leg AS leg_cargo, ca.nombre AS nombre_cargo, mtm.id_leg AS leg_tipomuestreo, tm.nombre AS nombre_tipomuestreo,
        mtma.id_leg AS leg_tipomuestra_ma, tma.nombre AS nombre_tipomuestra_ma, mcomp.id_leg AS leg_componente, comp.nombre AS nombre_tipomuestra,
        msa.id_leg AS leg_subarea, sa.nombre AS nombre_subarea, mact.id_leg AS leg_actividad, act.nombre AS nombre_actividadmuestreo,
        mtd.id_leg AS leg_tipodescarga, td.nombre AS nombre_tipodescarga, mmod.id_leg AS leg_modalidad, mo.nombre AS nombre_modalidad,
        mfc.id_leg AS leg_formacanal, fc.nombre AS nombre_formacanal, mdh.id_leg AS leg_dispositivo, dh.nombre AS nombre_dispositivohidraulico,
        mum1.id_leg AS leg_um1, um1.nombre AS nombre_um_formacanal, mum2.id_leg AS leg_um2, um2.nombre AS nombre_um_dispositivohidraulico,
        mct.id_leg AS leg_contacto, ct.nombre AS nombre_contacto, ct.email AS email_contacto,
        mjt.id_leg AS leg_jefatura, minsp.id_leg AS leg_inspector, pinsp.nombre AS nombre_inspector,
        mfr.id_leg AS leg_frecuencia, fr.nombre AS nombre_frecuencia,
        mus.id_leg AS leg_usuario_creador
      FROM fic_ficha f JOIN ${leg('App_Ma_FichaIngresoServicio_ENC')} mf ON mf.id_nuevo = f.id
      LEFT JOIN usr_usuario u ON u.id = f.id_usuario_creador LEFT JOIN fic_estado_ficha ef ON ef.id = f.id_estado_ficha
      LEFT JOIN cli_empresa_servicio e ON e.id = f.id_empresa_servicio LEFT JOIN cli_empresa em ON em.id = f.id_empresa LEFT JOIN cli_centro ce ON ce.id = f.id_centro
      LEFT JOIN ${leg('mae_comuna')} mcom ON mcom.id_nuevo = ce.id_comuna LEFT JOIN geo_comuna com ON com.id = ce.id_comuna
      LEFT JOIN ${leg('mae_region')} mreg ON mreg.id_nuevo = ce.id_region LEFT JOIN geo_region reg ON reg.id = ce.id_region
      LEFT JOIN ${leg('mae_lugaranalisis')} mla ON mla.id_nuevo = f.id_lugar_analisis LEFT JOIN fic_lugar_analisis la ON la.id = f.id_lugar_analisis
      LEFT JOIN ${leg('mae_objetivomuestreo_ma')} mob ON mob.id_nuevo = f.id_objetivo_muestreo LEFT JOIN fic_objetivo_muestreo ob ON ob.id = f.id_objetivo_muestreo
      LEFT JOIN ${leg('mae_cargo')} mca ON mca.id_nuevo = f.id_cargo_responsable LEFT JOIN per_cargo ca ON ca.id = f.id_cargo_responsable
      LEFT JOIN ${leg('mae_tipomuestreo')} mtm ON mtm.id_nuevo = f.id_tipo_muestreo LEFT JOIN fic_tipo_muestreo tm ON tm.id = f.id_tipo_muestreo
      LEFT JOIN ${leg('mae_tipomuestra_ma')} mtma ON mtma.id_nuevo = f.id_tipo_muestra LEFT JOIN fic_tipo_muestra tma ON tma.id = f.id_tipo_muestra
      LEFT JOIN ${leg('mae_tipomuestra')} mcomp ON mcomp.id_nuevo = f.id_componente LEFT JOIN fic_componente comp ON comp.id = f.id_componente
      LEFT JOIN ${leg('mae_subarea')} msa ON msa.id_nuevo = f.id_subarea LEFT JOIN fic_subarea sa ON sa.id = f.id_subarea
      LEFT JOIN ${leg('mae_actividadmuestreo')} mact ON mact.id_nuevo = f.id_actividad_muestreo LEFT JOIN fic_actividad_muestreo act ON act.id = f.id_actividad_muestreo
      LEFT JOIN ${leg('mae_tipodescarga')} mtd ON mtd.id_nuevo = f.id_tipo_descarga LEFT JOIN fic_tipo_descarga td ON td.id = f.id_tipo_descarga
      LEFT JOIN ${leg('mae_modalidad')} mmod ON mmod.id_nuevo = f.id_modalidad_caudal LEFT JOIN fic_modalidad_caudal mo ON mo.id = f.id_modalidad_caudal
      LEFT JOIN ${leg('mae_formacanal')} mfc ON mfc.id_nuevo = f.id_forma_canal LEFT JOIN fic_forma_canal fc ON fc.id = f.id_forma_canal
      LEFT JOIN ${leg('mae_dispositivohidraulico')} mdh ON mdh.id_nuevo = f.id_dispositivo_hidraulico LEFT JOIN fic_dispositivo_hidraulico dh ON dh.id = f.id_dispositivo_hidraulico
      LEFT JOIN ${leg('mae_umedida')} mum1 ON mum1.id_nuevo = f.id_um_formacanal LEFT JOIN geo_unidad_medida um1 ON um1.id = f.id_um_formacanal
      LEFT JOIN ${leg('mae_umedida')} mum2 ON mum2.id_nuevo = f.id_um_dispositivo LEFT JOIN geo_unidad_medida um2 ON um2.id = f.id_um_dispositivo
      LEFT JOIN ${leg('mae_contacto')} mct ON mct.id_nuevo = f.id_contacto LEFT JOIN cli_contacto ct ON ct.id = f.id_contacto
      LEFT JOIN ${leg('mae_jefaturatecnica')} mjt ON mjt.id_nuevo = f.id_persona_jefatura_tecnica
      LEFT JOIN ${leg('mae_inspectorambiental')} minsp ON minsp.id_nuevo = f.id_persona_inspector LEFT JOIN per_persona pinsp ON pinsp.id = f.id_persona_inspector
      LEFT JOIN ${leg('mae_frecuencia')} mfr ON mfr.id_nuevo = f.id_frecuencia LEFT JOIN fic_frecuencia fr ON fr.id = f.id_frecuencia
      LEFT JOIN ${leg('mae_usuario#usr')} mus ON mus.id_nuevo = f.id_usuario_creador
      WHERE mf.id_leg = @id`, { id: [sql.Int, Number(id)] });
    const f = filas[0]; if (!f) return null;

    const dmy = (d) => (d ? `${String(new Date(d).getUTCDate()).padStart(2, '0')}/${String(new Date(d).getUTCMonth() + 1).padStart(2, '0')}/${new Date(d).getUTCFullYear()}` : '1900-01-01');
    const hora = (d) => { if (!d) return ''; const h = new Date(d).toISOString().slice(11, 16); return h === '00:00' ? '' : h; };
    const legadoDe = async (tabla, idNuevo) => (idNuevo ? (await consulta(`SELECT id_legado FROM mig_id_map WHERE tabla_legado=@t AND id_nuevo=@i`, { t: [sql.VarChar(80), tabla], i: [sql.Int, idNuevo] }))[0]?.id_legado ?? null : null);
    const fechaSola = (d) => (d ? new Date(Date.UTC(new Date(d).getUTCFullYear(), new Date(d).getUTCMonth(), new Date(d).getUTCDate())) : new Date(Date.UTC(1900, 0, 1)));
    const horaCompleta = (d) => (d ? new Date(d).toISOString().slice(11, 19) : '');
    const [legOriginal, legEmpresaservicio, legEmpresa, legCentro] = await Promise.all([legadoDe('App_Ma_FichaIngresoServicio_ENC', f.id_ficha_original), legadoDe('mae_empresaservicios', f.id_empresa_servicio), legadoDe('mae_empresa', f.id_empresa), legadoDe('mae_centro', f.id_centro)]);
    // "Otro" catalog: mismo criterio que getExecutionDetail
    const insFilas = f.id_instrumento_ambiental ? await consulta(`SELECT ins.nombre, mins.id_leg FROM fic_instrumento_ambiental ins JOIN ${leg('mae_instrumentoambiental')} mins ON mins.id_nuevo = ins.id WHERE ins.id = @i`, { i: [sql.Int, f.id_instrumento_ambiental] }) : [];
    const insNombre = insFilas[0]?.nombre ?? null;
    const instrumentoTexto = !insNombre ? null : /^otro$/i.test(insNombre.trim()) ? (f.numero_instrumento ?? insNombre) : [insNombre, f.numero_instrumento].filter(Boolean).join(' ') + (f.anio_instrumento ? `/${f.anio_instrumento}` : '');
    const codigo = f.estado_codigo;
    const validacion = ESTADO_A_VALIDACION[codigo] ?? null;
    const estadoTexto = codigo === 'CICLO_FINALIZADO' ? f.estado_nombre : (ESTADO_DETALLE[codigo] ?? f.estado_nombre ?? 'VIGENTE');
    // id_contacto ausente: el legado usa el contacto por defecto del SERVICIO (no de la ficha)
    const sinContacto = !f.id_contacto;
    const ficha = {
      id_fichaingresoservicio: f.id_leg, tipo_fichaingresoservicio: f.tipo, fichaingresoservicio: String(f.id_leg), id_lugaranalisis: f.leg_lugar ?? 0,
      id_empresaservicio: legEmpresaservicio, id_empresa: legEmpresa, id_centro: legCentro, id_tipoagua: null, instrumento_ambiental: instrumentoTexto,
      id_objetivomuestreo_ma: f.leg_objetivo ?? 0, nombre_tabla_largo: f.nombre_tabla, etfa: f.es_etfa ? 'S' : 'N', ma_punto_muestreo: f.punto_muestreo, ma_coordenadas: f.coordenadas_utm,
      id_tipomuestra: f.leg_componente ?? 0, id_subarea: f.leg_subarea ?? 0, id_tipodescarga: f.leg_tipodescarga ?? 0, id_contacto: f.leg_contacto ?? 0, cliente_entrega: f.snap_nombre_contacto,
      id_tipomuestreo: f.leg_tipomuestreo ?? 0, id_tipomuestra_ma: f.leg_tipomuestra_ma ?? 0, id_actividadmuestreo: f.leg_actividad ?? 0, ma_duracion_muestreo: f.duracion_muestreo_hrs != null ? String(f.duracion_muestreo_hrs) : null,
      ficha_habilitado: 'S', estado_ficha: estadoTexto, sincronizado: 'N', referencia_googlemaps: f.referencia_googlemaps, medicion_caudal: f.medicion_caudal,
      id_modalidad: f.leg_modalidad ?? null, id_formacanal: f.leg_formacanal ?? null, formacanal_medida: f.formacanal_medida, id_dispositivohidraulico: f.leg_dispositivo ?? null, dispositivohidraulico_medida: f.dispositivo_medida,
      condicionmedicion_flujolaminar: '', condicionmedicion_velocidaduniforme: '', condicionmedicion_observacion: '', condicionmedicion_cumple: '',
      // El legado guarda fecha y hora en columnas SEPARADAS (fecha_jefaturatecnica es solo fecha, la hora es otra columna de texto);
      // el esquema nuevo las combinó en una — se reparten de vuelta.
      id_jefaturatecnica: f.leg_jefatura ?? 0, fecha_jefaturatecnica: fechaSola(f.fecha_jefatura_tecnica), hora_jefaturatecnica: hora(f.fecha_jefatura_tecnica),
      id_usuario: f.leg_usuario_creador ?? 0, fecha_fichacomercial: fechaSola(f.fecha_ficha_comercial), hora_fichacomercial: horaCompleta(f.fecha_ficha_comercial), coordenadas_ruta: '',
      id_cargo: f.leg_cargo ?? 0, responsablemuestreo: f.snap_nombre_persona_responsable, id_validaciontecnica: validacion,
      observaciones_comercial: f.observaciones_comercial, observaciones_jefaturatecnica: f.observaciones_tecnica, observaciones_coordinador: f.observaciones_coordinacion, ubicacion: f.ubicacion,
      id_um_formacanal: f.leg_um1 ?? null, id_um_dispositivohidraulico: f.leg_um2 ?? null, es_remuestreo: f.es_remuestreo ? 'S' : 'N', id_ficha_original: legOriginal,
      ubicacion_lat: f.ubicacion_lat, ubicacion_lon: f.ubicacion_lon, ciclo_notificado: 'N', id_cotizacion: f.id_cotizacion,
      nombre_empresaservicios: f.nombre_empresaservicios, nombre_empresa: f.nombre_empresa, nombre_centro: f.nombre_centro, nombre_tipoagua: null,
      // nombre_validaciontecnica NO pasa por el "FINAL FIX" del legado (ese switch solo reescribe estado_ficha/nombre_estadomuestreo):
      // conserva el texto crudo de mae_validaciontecnica, en mayúsculas.
      nombre_usuario: f.nombre_usuario, nombre_estadomuestreo: estadoTexto, nombre_validaciontecnica: f.estado_nombre,
      id_empresaservicios: legEmpresaservicio, codigo_centro: f.codigo_centro, nombre_lugaranalisis: f.nombre_lugaranalisis,
      email_empresa: null, nombre_contacto: sinContacto ? f.srv_contacto_nombre : f.nombre_contacto, email_contacto: sinContacto ? f.srv_contacto_email : f.email_contacto,
      nombre_comuna: f.nombre_comuna, nombre_region: f.nombre_region, nombre_objetivomuestreo_ma: f.nombre_objetivomuestreo_ma, nombre_cargo: f.nombre_cargo,
      nombre_tipomuestreo: f.nombre_tipomuestreo, nombre_tipomuestra_ma: f.nombre_tipomuestra_ma, nombre_tipomuestra: f.nombre_tipomuestra, nombre_subarea: f.nombre_subarea,
      nombre_actividadmuestreo: f.nombre_actividadmuestreo, nombre_tipodescarga: f.nombre_tipodescarga, nombre_modalidad: f.nombre_modalidad, nombre_formacanal: f.nombre_formacanal,
      nombre_dispositivohidraulico: f.nombre_dispositivohidraulico, nombre_um_formacanal: f.nombre_um_formacanal, nombre_um_dispositivohidraulico: f.nombre_um_dispositivohidraulico,
      agenda: { id_fichaingresoservicio: f.id_leg, id_frecuencia: f.leg_frecuencia ?? 0, nombre_frecuencia: f.nombre_frecuencia, frecuencia: f.cantidad_frecuencia, id_inspectorambiental: f.leg_inspector ?? 0,
        nombre_inspector: f.nombre_inspector, frecuencia_factor: f.factor_frecuencia, total_servicios: f.total_servicios },
    };

    const detFilas = await consulta(`SELECT a.*, mt.id_leg AS leg_tecnica, t.nombre AS nombre_tecnica, cra.id_normativa AS cat_normativa, cra.id_normativa_referencia AS cat_normativaref,
        mnor.id_leg AS leg_normativa, nor.nombre AS nombre_normativa, mnorref.id_leg AS leg_normativaref, norref.nombre AS nombre_normativareferencia,
        mra.id_leg AS leg_referencia, mlab.id_leg AS leg_lab1, l1.nombre AS nombre_laboratorioensayo, mlab2.id_leg AS leg_lab2, l2.nombre AS nombre_laboratorioensayo_2, mte.id_leg AS leg_tipoentrega, te.nombre AS nombre_tipoentrega
      FROM fic_ficha_analisis a JOIN cat_tecnica t ON t.id = a.id_tecnica LEFT JOIN ${leg('mae_tecnica')} mt ON mt.id_nuevo = a.id_tecnica
      LEFT JOIN cat_referencia_analisis cra ON cra.id = a.id_referencia_analisis
      LEFT JOIN cat_normativa nor ON nor.id = cra.id_normativa LEFT JOIN ${leg('mae_Normativa')} mnor ON mnor.id_nuevo = cra.id_normativa
      LEFT JOIN cat_normativa_referencia norref ON norref.id = cra.id_normativa_referencia LEFT JOIN ${leg('mae_NormativaReferencia')} mnorref ON mnorref.id_nuevo = cra.id_normativa_referencia
      LEFT JOIN ${leg('App_Ma_ReferenciaAnalisis')} mra ON mra.id_nuevo = a.id_referencia_analisis
      LEFT JOIN fic_laboratorio_ensayo l1 ON l1.id = a.id_laboratorio_ensayo LEFT JOIN ${leg('mae_laboratorioensayo')} mlab ON mlab.id_nuevo = a.id_laboratorio_ensayo
      LEFT JOIN fic_laboratorio_ensayo l2 ON l2.id = a.id_laboratorio_ensayo_suplente LEFT JOIN ${leg('mae_laboratorioensayo')} mlab2 ON mlab2.id_nuevo = a.id_laboratorio_ensayo_suplente
      LEFT JOIN fic_tipo_entrega te ON te.id = a.id_tipo_entrega LEFT JOIN ${leg('mae_tipoentrega')} mte ON mte.id_nuevo = a.id_tipo_entrega
      WHERE a.id_ficha = @f ORDER BY a.item`, { f: [sql.Int, f.id] });
    ficha.detalles = detFilas.map((d) => ({
      id_fichaingresoservicio: f.id_leg, id_normativa: d.leg_normativa ?? 0, id_normativareferencia: d.leg_normativaref ?? 0, id_tecnica: d.leg_tecnica ?? 0,
      id_referenciaanalisis: d.leg_referencia ?? 0, id_laboratorioensayo: d.leg_lab1 ?? 0, id_laboratorioensayo_2: d.leg_lab2 ?? 0, id_tipoentrega: d.leg_tipoentrega ?? 0, id_transporte: null,
      tipo_analisis: d.tipo_analisis === 'LABORATORIO' ? 'Laboratorio' : 'Terreno', limitemax_d: d.snap_limite_max_d, limitemax_h: d.snap_limite_max_h, llevaerror: SN(d.snap_lleva_error),
      error_min: d.snap_error_min, error_max: d.snap_error_max, uf_individual: d.snap_precio_uf, estado: '', cumplimiento: '', cumplimiento_app: '', item: d.item, activo: d.activo,
      transporte_orden: '', resultado_fecha: '1900-01-01T00:00:00', resultado_hora: '', llevatraduccion: SN(d.lleva_traduccion), traduccion_0: d.traduccion_0 ?? '', traduccion_1: d.traduccion_1 ?? '',
      nombre_tecnica: d.nombre_tecnica, nombre_normativa: d.nombre_normativa, nombre_normativareferencia: d.nombre_normativareferencia, nombre_tipoentrega: d.nombre_tipoentrega,
      nombre_laboratorioensayo: d.nombre_laboratorioensayo ?? '', nombre_laboratorioensayo_2: d.nombre_laboratorioensayo_2 ?? '', nombre_transporte: null,
    }));
    return ficha;
  },

  // Visitas de una ficha para la pantalla de asignación/reprogramación (legado: SP MAM_FichaComercial_ConsultaCoordinadorDetalle +
  // un enriquecimiento que SIEMPRE se aplica encima y termina dominando casi todos los campos — se arma directo el resultado final.
  // Fichas listas para asignar/coordinar (legado: SP MAM_FichaComercial_ConsultaCoordinador + un enriquecimiento posterior que
  // agrega coordenadas, resume la agenda por correlativo y marca cuáles ya están en una ruta planificada pendiente).
  // NOTA: "nombre_estadomuestreo"/"sincronizado" son campos del SP que no se pudieron verificar con certeza (valores internos,
  // sin uso aparente en el resto del código); se devuelven con un valor razonable, no una réplica exacta byte a byte.
  async getForAssignment() {
    const filas = await consulta(`SELECT f.id, mf.id_leg, f.tipo, f.snap_nombre_empresa, f.snap_nombre_empresa_servicio, ce.nombre AS centro, ob.nombre AS nombre_objetivomuestreo_ma, mob.id_leg AS leg_objetivo, sa.nombre AS nombre_subarea,
        ef.codigo AS estado_codigo, f.referencia_googlemaps, f.coordenadas_utm, fr.nombre AS nombre_frecuencia
      FROM fic_ficha f JOIN ${leg('App_Ma_FichaIngresoServicio_ENC')} mf ON mf.id_nuevo = f.id
      LEFT JOIN cli_centro ce ON ce.id = f.id_centro LEFT JOIN fic_objetivo_muestreo ob ON ob.id = f.id_objetivo_muestreo LEFT JOIN ${leg('mae_objetivomuestreo_ma')} mob ON mob.id_nuevo = f.id_objetivo_muestreo
      LEFT JOIN fic_subarea sa ON sa.id = f.id_subarea LEFT JOIN fic_estado_ficha ef ON ef.id = f.id_estado_ficha LEFT JOIN fic_frecuencia fr ON fr.id = f.id_frecuencia
      WHERE ef.codigo IN ('EN_PROCESO', 'PENDIENTE_PROGRAMACION') ORDER BY mf.id_leg DESC`);
    if (!filas.length) return [];
    const ids = filas.map((f) => f.id);
    const placeholders = ids.map((_, i) => `@f${i}`).join(',');
    const params = Object.fromEntries(ids.map((v, i) => [`f${i}`, [sql.Int, v]]));
    // El legado excluye del todo las visitas con estado_caso='CANCELADO' de este cálculo (no las muestra ni como "cancelado" ni
    // como nada); eso quedó plegado en id_estado_visita al migrar (ver sync/handlers/fic.js), así que se excluyen igual aquí.
    const visitas = await consulta(`SELECT v.id_ficha, v.correlativo_legacy, p.fecha_programada FROM fic_visita v LEFT JOIN fic_visita_proceso p ON p.id_visita = v.id AND p.tipo IN ('UNICO', 'INSTALACION')
      LEFT JOIN fic_estado_visita ev ON ev.id = v.id_estado_visita WHERE v.id_ficha IN (${placeholders}) AND ev.codigo NOT IN ('CANCELADO_ADL', 'CANCELADO_TERRENO')`, params);
    const porFicha = new Map(); for (const v of visitas) { if (!porFicha.has(v.id_ficha)) porFicha.set(v.id_ficha, []); porFicha.get(v.id_ficha).push(v); }
    // en ruta: la visita aparece en el detalle de una ruta planificada que no está cerrada
    const enRutaFilas = await consulta(`SELECT d.id_ficha, d.correlativo_legacy FROM rut_planificada_detalle d JOIN rut_planificada p ON p.id = d.id_planificada WHERE p.estado NOT IN ('COMPLETADA','CANCELADA','ANULADA') AND d.id_ficha IN (${placeholders})`, params);
    const enRutaSet = new Set(enRutaFilas.map((r) => `${r.id_ficha}|${(r.correlativo_legacy || '').trim()}`));
    const eqFilas = await consulta(`SELECT v.id_ficha, v.correlativo_legacy FROM eqp_uso u JOIN fic_visita v ON v.id = u.id_visita WHERE v.id_ficha IN (${placeholders}) AND u.estado = 'ACTIVO' GROUP BY v.id_ficha, v.correlativo_legacy`, params);
    const resFilas = await consulta(`SELECT v.id_ficha, v.correlativo_legacy FROM fic_resultado r JOIN fic_visita v ON v.id = r.id_visita WHERE v.id_ficha IN (${placeholders}) GROUP BY v.id_ficha, v.correlativo_legacy`, params);
    const eqSet = new Set(eqFilas.map((r) => `${r.id_ficha}|${(r.correlativo_legacy || '').trim()}`)), resSet = new Set(resFilas.map((r) => `${r.id_ficha}|${(r.correlativo_legacy || '').trim()}`));
    const out = filas.map((f) => {
      const propias = (porFicha.get(f.id) || []);
      // Mismo criterio que el legado en ESTA pantalla (no distingue ejecutado de agendado, solo "¿tiene fecha real?"): con fecha
      // válida → AGENDADO; si no, pero está en una ruta pendiente → EN_RUTA; si no → DISPONIBLE.
      const correlativos = propias.map((v) => {
        const key = `${f.id}|${(v.correlativo_legacy || '').trim()}`; const tieneFecha = v.fecha_programada && new Date(v.fecha_programada).getUTCFullYear() > 1900;
        const status = tieneFecha ? 'AGENDADO' : enRutaSet.has(key) ? 'EN_RUTA' : 'DISPONIBLE';
        const parteServicio = parseInt(String(v.correlativo_legacy || '').split('-')[1], 10);
        return { frecuencia_correlativo: v.correlativo_legacy, numero_servicio: Number.isFinite(parteServicio) ? parteServicio : null, status, en_ruta: enRutaSet.has(key), tiene_equipos: eqSet.has(key), tiene_resultados: resSet.has(key) };
      });
      const disponibles = correlativos.filter((c) => c.status === 'DISPONIBLE').length, agendados = correlativos.filter((c) => c.status === 'AGENDADO').length, enRutaCount = correlativos.filter((c) => c.status === 'EN_RUTA').length;
      return { fichaingresoservicio: String(f.id_leg), id: f.id_leg, nombre_estadomuestreo: null, tipo_fichaingresoservicio: f.tipo, empresa_facturar: f.snap_nombre_empresa, empresa_servicio: f.snap_nombre_empresa_servicio,
        centro: f.centro, nombre_objetivomuestreo_ma: f.nombre_objetivomuestreo_ma, nombre_subarea: f.nombre_subarea, sincronizado: 'N', nombre_frecuencia: f.nombre_frecuencia, id_estadomuestreo: null, id_fichaingresoservicio: f.id_leg,
        estado_ficha: ESTADO_TEXTO[f.estado_codigo] ?? null, id_objetivomuestreo_ma: f.leg_objetivo ?? null, ref_google: f.referencia_googlemaps, ma_coordenadas: f.coordenadas_utm, id_validaciontecnica: ESTADO_A_VALIDACION[f.estado_codigo] ?? null,
        total_servicios: propias.length, servicios_disponibles: disponibles, servicios_agendados: agendados, servicios_en_ruta: enRutaCount, correlativos };
    });
    // A-01: las fichas EN PROCESO sin servicios disponibles no se muestran (ya están todas agendadas o en ruta)
    return out.filter((r) => r.id_validaciontecnica !== ESTADO_A_VALIDACION.EN_PROCESO || r.servicios_disponibles > 0);
  },

  // Visitas de fichas EN PROCESO, para el calendario/ejecución (legado: getEnProcesoFichas). Solo filtra por mes/año de la
  // fecha de instalación; incluye la posición en una ruta ya ejecutada (rut_ejecucion_detalle), si la hay.
  async getEnProcesoFichas(month, year) {
    let where = ''; const params = {};
    if (month && year) { where = 'AND MONTH(p1.fecha_programada) = @month AND YEAR(p1.fecha_programada) = @year'; params.month = [sql.Int, parseInt(month, 10)]; params.year = [sql.Int, parseInt(year, 10)]; }
    else if (year) { where = 'AND YEAR(p1.fecha_programada) = @year'; params.year = [sql.Int, parseInt(year, 10)]; }
    const filas = await consulta(`SELECT v.*, mf.id_leg AS ficha_leg, f.tipo, f.snap_nombre_empresa_servicio, f.snap_nombre_empresa, f.es_remuestreo, f.id_ficha_original AS id_ficha_original_nuevo, ce.nombre AS centro, ob.nombre AS nombre_objetivomuestreo, sa.nombre AS nombre_subarea, f.nombre_tabla,
        e.email AS correo_empresa_servicio, em.email AS email_cliente, ct.nombre AS contacto, ct.email AS correo_contacto,
        p1.fecha_programada AS fecha_i, p1.id_persona_muestreador AS pm_i, p2.id_persona_muestreador AS pm_t, p2.fecha_programada AS fecha_retiro_p2,
        mmi.nombre AS muestreador, mmt.nombre AS muestreador_retiro, mmiL.id_leg AS leg_muestreador, mmtL.id_leg AS leg_muestreador2,
        ef.codigo AS estado_visita_codigo, ff.codigo AS estado_ficha_codigo, redEjec.id_leg AS leg_ejecucion_ruta, red.orden AS orden_ruta, mfo.id_leg AS leg_ficha_original
      FROM fic_visita v JOIN fic_ficha f ON f.id = v.id_ficha JOIN ${leg('App_Ma_FichaIngresoServicio_ENC')} mf ON mf.id_nuevo = f.id
      JOIN fic_visita_proceso p1 ON p1.id_visita = v.id AND p1.tipo IN ('UNICO', 'INSTALACION')
      LEFT JOIN fic_visita_proceso p2 ON p2.id_visita = v.id AND p2.tipo IN ('UNICO', 'RETIRO')
      LEFT JOIN per_persona mmi ON mmi.id = p1.id_persona_muestreador LEFT JOIN ${leg('mae_muestreador')} mmiL ON mmiL.id_nuevo = p1.id_persona_muestreador
      LEFT JOIN per_persona mmt ON mmt.id = p2.id_persona_muestreador LEFT JOIN ${leg('mae_muestreador')} mmtL ON mmtL.id_nuevo = p2.id_persona_muestreador
      LEFT JOIN cli_empresa_servicio e ON e.id = f.id_empresa_servicio LEFT JOIN cli_empresa em ON em.id = f.id_empresa LEFT JOIN cli_centro ce ON ce.id = f.id_centro LEFT JOIN cli_contacto ct ON ct.id = f.id_contacto
      LEFT JOIN fic_objetivo_muestreo ob ON ob.id = f.id_objetivo_muestreo LEFT JOIN fic_subarea sa ON sa.id = f.id_subarea
      LEFT JOIN fic_estado_visita ef ON ef.id = v.id_estado_visita LEFT JOIN fic_estado_ficha ff ON ff.id = f.id_estado_ficha
      LEFT JOIN rut_ejecucion_detalle red ON red.id_visita = v.id LEFT JOIN ${leg('mae_rutas_ejecuciones')} redEjec ON redEjec.id_nuevo = red.id_ejecucion
      LEFT JOIN ${leg('App_Ma_FichaIngresoServicio_ENC')} mfo ON mfo.id_nuevo = f.id_ficha_original
      WHERE ff.codigo = 'EN_PROCESO' ${where}
      ORDER BY CASE WHEN p1.fecha_programada IS NULL OR YEAR(p1.fecha_programada) <= 1900 THEN 1 ELSE 0 END ASC, p1.fecha_programada ASC,
        CASE WHEN red.id IS NULL THEN 1 ELSE 0 END ASC, red.id_ejecucion ASC, red.orden ASC, mf.id_leg DESC`, params);
    return filas.map((r) => ({
      id_agenda: r.id_agendamam_legacy, id: r.ficha_leg, ficha_correlativo: String(r.ficha_leg), correlativo: r.correlativo_legacy, fecha: r.fecha_i, id_muestreador: r.leg_muestreador ?? 0, id_muestreador2: r.leg_muestreador2 ?? null,
      muestreador: r.muestreador ?? null, muestreador_retiro: r.muestreador_retiro, tipo_ficha: r.tipo, empresa_servicio: r.snap_nombre_empresa_servicio, correo_empresa_servicio: r.correo_empresa_servicio,
      cliente: r.snap_nombre_empresa, email_cliente: r.email_cliente, contacto: r.contacto, correo_contacto: r.correo_contacto, objetivo: r.nombre_objetivomuestreo, subarea: r.nombre_subarea,
      dia: r.fecha_i ? new Date(r.fecha_i).getUTCDate() : null, mes: r.fecha_i ? new Date(r.fecha_i).getUTCMonth() + 1 : null, ano: r.fecha_i ? new Date(r.fecha_i).getUTCFullYear() : null,
      centro: r.centro, fecha_retiro: r.fecha_retiro_p2 ?? r.fecha_i, glosa: r.nombre_tabla, estado_caso: null, motivo_cancelacion: null, id_estadomuestreo: ESTADO_VISITA_ID_MOD[r.estado_visita_codigo] ?? 0,
      realizado_por_gem: r.snap_nombre_confirma_caso, id_validaciontecnica: ESTADO_A_VALIDACION[r.estado_ficha_codigo] ?? null, es_remuestreo: r.es_remuestreo ? 'S' : 'N', id_ficha_original: r.leg_ficha_original ?? null,
      id_ejecucion_ruta: r.leg_ejecucion_ruta ?? null, orden_ruta: r.orden_ruta ?? null,
    }));
  },

  async getForAssignmentDetail(id) {
    const ESTADO_VISITA_ID = { POR_ASIGNAR: 0, PENDIENTE: 1, EJECUTADO: 3, SUSPENDIDO_ADL: 4, SUSPENDIDO_TERRENO: 5, CANCELADO_ADL: 6, CANCELADO_TERRENO: 7 };
    const filas = await consulta(`SELECT v.*, mf.id_leg AS ficha_leg, f.tipo, f.duracion_muestreo_hrs, f.es_remuestreo, f.id_ficha_original, ef.codigo AS estado_visita_codigo, ef.nombre AS estado_visita_nombre,
        f.snap_nombre_empresa AS empresa_servicio, ce.nombre AS centro, ob.nombre AS nombre_objetivomuestreo, sa.nombre AS nombre_subarea,
        mcoord.id_leg AS leg_coordinador, ucoord.nombre AS nombre_coordinador,
        p1.fecha_programada AS fecha_i, p1.id_persona_muestreador AS pm_i, p2.id_persona_muestreador AS pm_t, p2.fecha_programada AS fecha_retiro_p2,
        mmi.nombre AS nombre_muestreador, mmt.nombre AS nombre_muestreador2, mmiL.id_leg AS leg_muestreador, mmtL.id_leg AS leg_muestreador2,
        mfr.id_leg AS leg_frecuencia, fr.nombre AS nombre_frecuencia, fr.dias
      FROM fic_visita v JOIN fic_ficha f ON f.id = v.id_ficha JOIN ${leg('App_Ma_FichaIngresoServicio_ENC')} mf ON mf.id_nuevo = f.id
      LEFT JOIN fic_estado_visita ef ON ef.id = v.id_estado_visita
      LEFT JOIN cli_empresa_servicio e ON e.id = f.id_empresa_servicio LEFT JOIN cli_centro ce ON ce.id = f.id_centro
      LEFT JOIN fic_objetivo_muestreo ob ON ob.id = f.id_objetivo_muestreo LEFT JOIN fic_subarea sa ON sa.id = f.id_subarea
      LEFT JOIN ${leg('mae_usuario#usr')} mcoord ON mcoord.id_nuevo = v.id_usuario_programo LEFT JOIN usr_usuario ucoord ON ucoord.id = v.id_usuario_programo
      LEFT JOIN fic_visita_proceso p1 ON p1.id_visita = v.id AND p1.tipo IN ('UNICO', 'INSTALACION') LEFT JOIN per_persona mmi ON mmi.id = p1.id_persona_muestreador LEFT JOIN ${leg('mae_muestreador')} mmiL ON mmiL.id_nuevo = p1.id_persona_muestreador
      LEFT JOIN fic_visita_proceso p2 ON p2.id_visita = v.id AND p2.tipo IN ('UNICO', 'RETIRO') LEFT JOIN per_persona mmt ON mmt.id = p2.id_persona_muestreador LEFT JOIN ${leg('mae_muestreador')} mmtL ON mmtL.id_nuevo = p2.id_persona_muestreador
      LEFT JOIN ${leg('mae_frecuencia')} mfr ON mfr.id_nuevo = f.id_frecuencia LEFT JOIN fic_frecuencia fr ON fr.id = f.id_frecuencia
      WHERE mf.id_leg = @id ORDER BY v.id_agendamam_legacy`, { id: [sql.Int, Number(id)] });
    // Muestreador "original" (el de la primera visita de la ficha original), para reprogramaciones de remuestreo.
    let origInfo = { nombre: null, id: null };
    if (filas[0]?.id_ficha_original) {
      const orig = await consulta(`SELECT TOP 1 p.id_persona_muestreador, pm.nombre, ml.id_leg FROM fic_visita v JOIN fic_visita_proceso p ON p.id_visita = v.id AND p.tipo IN ('UNICO', 'INSTALACION')
        LEFT JOIN per_persona pm ON pm.id = p.id_persona_muestreador LEFT JOIN ${leg('mae_muestreador')} ml ON ml.id_nuevo = p.id_persona_muestreador
        WHERE v.id_ficha = @f ORDER BY v.id_agendamam_legacy`, { f: [sql.Int, filas[0].id_ficha_original] });
      if (orig[0]) origInfo = { nombre: orig[0].nombre, id: orig[0].id_leg ?? 0 };
    }
    return filas.map((r) => ({
      fichaingresoservicio: String(r.ficha_leg), id_agendamam: r.id_agendamam_legacy, frecuencia_correlativo: r.correlativo_legacy, nombre_estadomuestreo: r.estado_visita_nombre, fecha_muestreo: r.fecha_i, fecha_retiro: r.fecha_retiro_p2 ?? r.fecha_i,
      tipo_fichaingresoservicio: r.tipo, empresa_servicio: r.empresa_servicio, centro: r.centro, nombre_objetivomuestreo_ma: r.nombre_objetivomuestreo, nombre_objetivomuestreo: r.nombre_objetivomuestreo, nombre_subarea: r.nombre_subarea,
      nombre_coordinador: r.nombre_coordinador, nombre_muestreador: r.nombre_muestreador, sincronizado: 'N', marca: null, dia: r.fecha_i ? new Date(r.fecha_i).getUTCDate() : 0,
      mes: r.fecha_i ? new Date(r.fecha_i).getUTCMonth() + 1 : 0, ano: r.fecha_i ? new Date(r.fecha_i).getUTCFullYear() : 0, id_fichaingresoservicio: r.ficha_leg, id_coordinador: r.leg_coordinador ?? 0,
      id_muestreador: r.leg_muestreador ?? 0, id_muestreador2: r.leg_muestreador2 ?? 0, nombre_muestreador2: r.nombre_muestreador2, frecuencia: r.cantidad_frecuencia ?? 1, id_frecuencia: r.leg_frecuencia ?? 0,
      id_estadomuestreo: ESTADO_VISITA_ID[r.estado_visita_codigo] ?? 0, num_ficha: r.ficha_leg, ma_duracion_muestreo: r.duracion_muestreo_hrs, es_remuestreo: r.es_remuestreo ? 'S' : 'N',
      id_ficha_original: r.id_ficha_original ?? null, nombre_muestreador_original: origInfo.nombre, id_muestreador_original: origInfo.id, estado_caso: null, nombre_frecuencia: r.nombre_frecuencia, dias: r.dias,
      total_servicios: r.total_servicios ?? 1, frecuencia_factor: r.factor_frecuencia ?? 1,
    }));
  },
};
