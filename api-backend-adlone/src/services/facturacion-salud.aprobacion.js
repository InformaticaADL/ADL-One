import sqlFact, { getConnectionFacturacion } from '../config/databaseFacturacion.js';
import sqlSalud, { getConnectionSalud } from '../config/databaseSalud.js';
import auditService from './audit.service.js';

const txt = (v) => String(v ?? '').trim();
const num = (v) => Number(v) || 0;

/**
 * Gestión de solicitudes, aprobaciones y auditoría de cambios de Empresa a Facturar.
 * Tanto las solicitudes (dbo.fac_aprobacion_cambio_empresa) como las facturas
 * (dbo.facturacion_enc / dbo.facturacion_det / dbo.auditoria) viven en ADLFacturacion.
 * Los datos maestros de empresas (mae_empresaservicios) se leen desde LaboratorioADL.
 */
export async function obtenerSolicitudPendienteFactura(id_facturacion) {
  const id = num(id_facturacion);
  if (!id) return null;
  try {
    const poolFact = await getConnectionFacturacion();
    const r = await poolFact.request()
      .input('id_facturacion', sqlFact.Numeric(10, 0), id)
      .query(`
        SELECT TOP 1 *
        FROM dbo.fac_aprobacion_cambio_empresa
        WHERE id_facturacion = @id_facturacion
          AND estado = 'PENDIENTE'
        ORDER BY id_aprobacion DESC;
      `);
    return r.recordset?.[0] || null;
  } catch (err) {
    if (/Invalid object name/i.test(String(err?.message || ''))) return null;
    throw err;
  }
}

export async function solicitarCambioEmpresa({ id_facturacion, id_empresaservicio_nueva, motivo, usuario = {} }) {
  const idFac = num(id_facturacion);
  const idNueva = num(id_empresaservicio_nueva);
  const motivoTxt = txt(motivo);

  if (!idFac) throw new Error('Debe indicar el ID de facturación.');
  if (!idNueva) throw new Error('Debe elegir la nueva empresa a facturar.');
  if (!motivoTxt) throw new Error('Debe ingresar el motivo de la solicitud.');

  const poolFact = await getConnectionFacturacion();
  const pendiente = await obtenerSolicitudPendienteFactura(idFac);
  if (pendiente) {
    throw new Error(`La factura #${idFac} ya tiene una solicitud pendiente de aprobación (#${pendiente.id_aprobacion}).`);
  }

  // Leer factura y casos desde ADLFacturacion
  const factRes = await poolFact.request()
    .input('id_fac', sqlFact.Int, idFac)
    .query(`
      SELECT
        id_facturacion,
        ISNULL(factura, 0) AS factura,
        id_empresaservicio AS id_empresaservicio_anterior,
        rut_empresaservicios AS rut_empresa_anterior,
        nombre_empresaservicios AS nombre_empresa_anterior,
        ISNULL(uf_totalfac, 0) AS uf_totalfac
      FROM dbo.facturacion_enc
      WHERE id_facturacion = @id_fac AND ISNULL(eliminado, 'N') <> 'S';

      SELECT DISTINCT
        id_caso,
        CASE WHEN LTRIM(RTRIM(ISNULL(caso_adlab, ''))) <> '' THEN LTRIM(RTRIM(caso_adlab)) ELSE CAST(id_caso AS VARCHAR(20)) END AS caso_adlab
      FROM dbo.facturacion_det
      WHERE id_facturacion = @id_fac
      ORDER BY caso_adlab;
    `);

  const enc = factRes.recordsets?.[0]?.[0];
  if (!enc) throw new Error(`No existe la factura #${idFac}.`);
  if (num(enc.id_empresaservicio_anterior) === idNueva) {
    throw new Error('La empresa seleccionada es la misma que ya tiene la factura.');
  }

  // Leer datos de la empresa nueva desde LaboratorioADL
  const poolSalud = await getConnectionSalud();
  const empRes = await poolSalud.request()
    .input('id_nueva', sqlSalud.Numeric(10, 0), idNueva)
    .query(`
      SELECT
        id_empresaservicio,
        LTRIM(RTRIM(ISNULL(rut_empresaservicios, ''))) AS rut_empresaservicios,
        LTRIM(RTRIM(ISNULL(nombre_empresaservicios, ''))) AS nombre_empresaservicios
      FROM dbo.mae_empresaservicios
      WHERE id_empresaservicio = @id_nueva;
    `);

  const empNueva = empRes.recordset?.[0];
  if (!empNueva) throw new Error(`No existe la empresa de servicio #${idNueva}.`);

  const casosRows = factRes.recordsets?.[1] || [];
  const casosDetalle = casosRows.map((c) => c.caso_adlab).filter(Boolean).join(', ').slice(0, 1000);

  const idUsuarioSolicita = num(usuario.id || usuario.id_usuario || 0);
  const nombreUsuarioSolicita = txt(usuario.nombre || usuario.username || usuario.nombre_usuario || `Usuario ${idUsuarioSolicita}`).slice(0, 100);

  const insertRes = await poolFact.request()
    .input('id_facturacion', sqlFact.Numeric(10, 0), idFac)
    .input('factura', sqlFact.Numeric(10, 0), num(enc.factura))
    .input('id_ant', sqlFact.Numeric(10, 0), num(enc.id_empresaservicio_anterior))
    .input('rut_ant', sqlFact.VarChar(30), txt(enc.rut_empresa_anterior).slice(0, 30))
    .input('nom_ant', sqlFact.VarChar(250), txt(enc.nombre_empresa_anterior).slice(0, 250))
    .input('id_nueva', sqlFact.Numeric(10, 0), idNueva)
    .input('rut_nueva', sqlFact.VarChar(30), txt(empNueva.rut_empresaservicios).slice(0, 30))
    .input('nom_nueva', sqlFact.VarChar(250), txt(empNueva.nombre_empresaservicios).slice(0, 250))
    .input('cant_casos', sqlFact.Int, casosRows.length)
    .input('casos_det', sqlFact.VarChar(1000), casosDetalle)
    .input('uf_total', sqlFact.Numeric(12, 3), Number(enc.uf_totalfac) || 0)
    .input('motivo', sqlFact.VarChar(500), motivoTxt.slice(0, 500))
    .input('id_usr', sqlFact.Numeric(10, 0), idUsuarioSolicita)
    .input('nom_usr', sqlFact.VarChar(100), nombreUsuarioSolicita)
    .query(`
      INSERT INTO dbo.fac_aprobacion_cambio_empresa (
        origen_modulo, id_facturacion, factura,
        id_empresaservicio_anterior, rut_empresa_anterior, nombre_empresa_anterior,
        id_empresaservicio_nueva, rut_empresa_nueva, nombre_empresa_nueva,
        cantidad_casos, casos_detalle, uf_totalfac,
        motivo_solicitud, id_usuario_solicita, usuario_solicita, estado
      )
      OUTPUT INSERTED.*
      VALUES (
        'SALUD', @id_facturacion, @factura,
        @id_ant, @rut_ant, @nom_ant,
        @id_nueva, @rut_nueva, @nom_nueva,
        @cant_casos, @casos_det, @uf_total,
        @motivo, @id_usr, @nom_usr, 'PENDIENTE'
      );
    `);

  const creada = insertRes.recordset?.[0];

  await auditService.log({
    usuario_id: idUsuarioSolicita,
    area_key: 'administracion',
    modulo_nombre: 'Facturación Salud',
    evento_tipo: 'SOLICITUD_CAMBIO_EMPRESA',
    entidad_nombre: 'fac_aprobacion_cambio_empresa',
    entidad_id: creada?.id_aprobacion || idFac,
    descripcion_humana: `Solicitud cambio empresa factura #${idFac}: ${enc.nombre_empresa_anterior} → ${empNueva.nombre_empresaservicios}`,
    datos_anteriores: { id_empresaservicio: enc.id_empresaservicio_anterior, nombre: enc.nombre_empresa_anterior },
    datos_nuevos: { id_empresaservicio: idNueva, nombre: empNueva.nombre_empresaservicios, motivo: motivoTxt }
  });

  return creada;
}

export async function listarSolicitudesCambioEmpresa({ estado = 'ALL', busqueda = '' } = {}) {
  const poolFact = await getConnectionFacturacion();
  const est = txt(estado).toUpperCase();
  const q = txt(busqueda);

  const conds = ['1=1'];
  const req = poolFact.request();
  if (est && est !== 'ALL' && est !== 'TODAS') {
    req.input('estado', sqlFact.VarChar(20), est);
    conds.push('estado = @estado');
  }
  if (q) {
    req.input('q', sqlFact.VarChar(120), `%${q}%`);
    conds.push(`(
      CAST(id_facturacion AS VARCHAR(20)) LIKE @q
      OR CAST(ISNULL(factura, 0) AS VARCHAR(20)) LIKE @q
      OR nombre_empresa_anterior LIKE @q
      OR nombre_empresa_nueva LIKE @q
      OR rut_empresa_anterior LIKE @q
      OR rut_empresa_nueva LIKE @q
      OR usuario_solicita LIKE @q
      OR motivo_solicitud LIKE @q
      OR ISNULL(casos_detalle, '') LIKE @q
    )`);
  }

  const res = await req.query(`
    SELECT *
    FROM dbo.fac_aprobacion_cambio_empresa
    WHERE ${conds.join(' AND ')}
    ORDER BY CASE WHEN estado = 'PENDIENTE' THEN 0 ELSE 1 END, fecha_solicitud DESC, id_aprobacion DESC;

    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN estado = 'APROBADA' THEN 1 ELSE 0 END) AS aprobadas,
      SUM(CASE WHEN estado = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas
    FROM dbo.fac_aprobacion_cambio_empresa;
  `);

  const resumen = res.recordsets?.[1]?.[0] || {};
  return {
    solicitudes: res.recordsets?.[0] || [],
    resumen: {
      total: Number(resumen.total || 0),
      pendientes: Number(resumen.pendientes || 0),
      aprobadas: Number(resumen.aprobadas || 0),
      rechazadas: Number(resumen.rechazadas || 0)
    }
  };
}

export async function aprobarSolicitudCambioEmpresa({ id_aprobacion, comentario = '', usuario = {} }) {
  const idApr = num(id_aprobacion);
  if (!idApr) throw new Error('Debe indicar el ID de la solicitud.');

  const poolFact = await getConnectionFacturacion();
  const solRes = await poolFact.request()
    .input('id', sqlFact.Int, idApr)
    .query('SELECT TOP 1 * FROM dbo.fac_aprobacion_cambio_empresa WHERE id_aprobacion = @id;');
  const sol = solRes.recordset?.[0];
  if (!sol) throw new Error(`No existe la solicitud #${idApr}.`);
  if (sol.estado !== 'PENDIENTE') {
    throw new Error(`La solicitud #${idApr} ya fue resuelta (${sol.estado}).`);
  }

  // Obtener sigla actualizada de la empresa nueva desde LaboratorioADL
  const poolSalud = await getConnectionSalud();
  const empRes = await poolSalud.request()
    .input('id_nueva', sqlSalud.Numeric(10, 0), num(sol.id_empresaservicio_nueva))
    .query(`
      SELECT
        LTRIM(RTRIM(ISNULL(sigla, ''))) AS sigla,
        LTRIM(RTRIM(ISNULL(rut_empresaservicios, ''))) AS rut_empresaservicios,
        LTRIM(RTRIM(ISNULL(nombre_empresaservicios, ''))) AS nombre_empresaservicios
      FROM dbo.mae_empresaservicios
      WHERE id_empresaservicio = @id_nueva;
    `);
  const empNueva = empRes.recordset?.[0] || {};

  const idUsuarioRes = num(usuario.id || usuario.id_usuario || 0);
  const nombreUsuarioRes = txt(usuario.nombre || usuario.username || usuario.nombre_usuario || `Usuario ${idUsuarioRes}`).slice(0, 100);
  const comentarioTxt = txt(comentario).slice(0, 500);

  // Transacción única en ADLFacturacion: actualiza factura, detalle, auditoría y estado de aprobación
  const tx = new sqlFact.Transaction(poolFact);
  await tx.begin();
  let updSol;
  let casosActualizados = 0;
  try {
    await new sqlFact.Request(tx)
      .input('id_fac', sqlFact.Int, num(sol.id_facturacion))
      .input('id_emp', sqlFact.Numeric(10, 0), num(sol.id_empresaservicio_nueva))
      .input('nom_emp', sqlFact.VarChar(250), txt(empNueva.nombre_empresaservicios || sol.nombre_empresa_nueva))
      .input('rut_emp', sqlFact.VarChar(30), txt(empNueva.rut_empresaservicios || sol.rut_empresa_nueva))
      .input('sigla', sqlFact.VarChar(50), txt(empNueva.sigla))
      .query(`
        UPDATE dbo.facturacion_enc
        SET id_empresaservicio = @id_emp,
            nombre_empresaservicios = @nom_emp,
            rut_empresaservicios = @rut_emp,
            sigla = @sigla
        WHERE id_facturacion = @id_fac;
      `);

    const detUpd = await new sqlFact.Request(tx)
      .input('id_fac', sqlFact.Int, num(sol.id_facturacion))
      .input('id_emp', sqlFact.Numeric(10, 0), num(sol.id_empresaservicio_nueva))
      .query(`
        UPDATE dbo.facturacion_det
        SET id_empresaservicio = @id_emp
        WHERE id_facturacion = @id_fac;
      `);
    casosActualizados = detUpd.rowsAffected?.[0] ?? 0;

    await new sqlFact.Request(tx)
      .input('id_ref', sqlFact.Numeric(10, 0), num(sol.id_facturacion))
      .input('orig', sqlFact.VarChar(500), String(sol.id_empresaservicio_anterior))
      .input('nuevo', sqlFact.VarChar(500), String(sol.id_empresaservicio_nueva))
      .input('motivo', sqlFact.VarChar(500), txt(sol.motivo_solicitud))
      .input('id_usr', sqlFact.Numeric(10, 0), idUsuarioRes)
      .query(`
        INSERT INTO dbo.auditoria (id_referencia, referencia, campo, original, tipo, nuevo, motivo, id_usuario)
        VALUES (@id_ref, 'Facturación - Cambia empresa a facturar', 'Empresa a facturar', @orig, 'CAMBIA', @nuevo, @motivo, @id_usr);
      `);

    const updRes = await new sqlFact.Request(tx)
      .input('id', sqlFact.Int, idApr)
      .input('id_usr', sqlFact.Numeric(10, 0), idUsuarioRes)
      .input('nom_usr', sqlFact.VarChar(100), nombreUsuarioRes)
      .input('com', sqlFact.VarChar(500), comentarioTxt)
      .query(`
        UPDATE dbo.fac_aprobacion_cambio_empresa
        SET estado = 'APROBADA',
            id_usuario_resuelve = @id_usr,
            usuario_resuelve = @nom_usr,
            fecha_resolucion = GETDATE(),
            comentario_resolucion = @com
        OUTPUT INSERTED.*
        WHERE id_aprobacion = @id;
      `);
    updSol = updRes.recordset?.[0];

    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch { /* ignore */ }
    throw err;
  }

  await auditService.log({
    usuario_id: idUsuarioRes,
    area_key: 'administracion',
    modulo_nombre: 'Administración y Finanzas',
    evento_tipo: 'APROBACION_CAMBIO_EMPRESA',
    entidad_nombre: 'fac_aprobacion_cambio_empresa',
    entidad_id: idApr,
    descripcion_humana: `Aprobado cambio empresa factura #${sol.id_facturacion}: ${sol.nombre_empresa_anterior} → ${sol.nombre_empresa_nueva}`,
    datos_anteriores: { id_empresaservicio: sol.id_empresaservicio_anterior, nombre: sol.nombre_empresa_anterior },
    datos_nuevos: { id_empresaservicio: sol.id_empresaservicio_nueva, nombre: sol.nombre_empresa_nueva, comentario: comentarioTxt }
  });

  return {
    solicitud: updSol,
    resultadoCambio: {
      id_facturacion: num(sol.id_facturacion),
      id_empresaservicio_anterior: num(sol.id_empresaservicio_anterior),
      id_empresaservicio_nueva: num(sol.id_empresaservicio_nueva),
      casosActualizados
    }
  };
}

export async function rechazarSolicitudCambioEmpresa({ id_aprobacion, comentario, usuario = {} }) {
  const idApr = num(id_aprobacion);
  const comentarioTxt = txt(comentario);
  if (!idApr) throw new Error('Debe indicar el ID de la solicitud.');
  if (!comentarioTxt) throw new Error('Debe ingresar el motivo del rechazo.');

  const poolFact = await getConnectionFacturacion();
  const solRes = await poolFact.request()
    .input('id', sqlFact.Int, idApr)
    .query('SELECT TOP 1 * FROM dbo.fac_aprobacion_cambio_empresa WHERE id_aprobacion = @id;');
  const sol = solRes.recordset?.[0];
  if (!sol) throw new Error(`No existe la solicitud #${idApr}.`);
  if (sol.estado !== 'PENDIENTE') {
    throw new Error(`La solicitud #${idApr} ya fue resuelta (${sol.estado}).`);
  }

  const idUsuarioRes = num(usuario.id || usuario.id_usuario || 0);
  const nombreUsuarioRes = txt(usuario.nombre || usuario.username || usuario.nombre_usuario || `Usuario ${idUsuarioRes}`).slice(0, 100);

  const updRes = await poolFact.request()
    .input('id', sqlFact.Int, idApr)
    .input('id_usr', sqlFact.Numeric(10, 0), idUsuarioRes)
    .input('nom_usr', sqlFact.VarChar(100), nombreUsuarioRes)
    .input('com', sqlFact.VarChar(500), comentarioTxt.slice(0, 500))
    .query(`
      UPDATE dbo.fac_aprobacion_cambio_empresa
      SET estado = 'RECHAZADA',
          id_usuario_resuelve = @id_usr,
          usuario_resuelve = @nom_usr,
          fecha_resolucion = GETDATE(),
          comentario_resolucion = @com
      OUTPUT INSERTED.*
      WHERE id_aprobacion = @id;
    `);

  await auditService.log({
    usuario_id: idUsuarioRes,
    area_key: 'administracion',
    modulo_nombre: 'Administración y Finanzas',
    evento_tipo: 'RECHAZO_CAMBIO_EMPRESA',
    entidad_nombre: 'fac_aprobacion_cambio_empresa',
    entidad_id: idApr,
    descripcion_humana: `Rechazado cambio empresa factura #${sol.id_facturacion}: ${comentarioTxt}`,
    datos_anteriores: { id_empresaservicio: sol.id_empresaservicio_anterior, nombre: sol.nombre_empresa_anterior },
    datos_nuevos: { id_empresaservicio_solicitada: sol.id_empresaservicio_nueva, comentario_rechazo: comentarioTxt }
  });

  return { solicitud: updRes.recordset?.[0] };
}
