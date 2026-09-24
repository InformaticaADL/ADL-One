import sql from 'mssql';
import { getConnectionNueva } from '../config/databaseNueva.js';

// Cola de revisión de duplicados del esquema nuevo (tabla revision_duplicado).
// Entidades: CLI_EMPRESA, CLI_SERVICIO, CLI_CENTRO (y las que se agreguen: PER_PERSONA, EQP_EQUIPO).
// Nada se fusiona solo: una persona resuelve cada par (o un lote) desde la pantalla.

const TABLA = { FAC_CONVENIO: 'fac_convenio', CLI_EMPRESA: 'cli_empresa', CLI_SERVICIO: 'cli_empresa_servicio', CLI_CENTRO: 'cli_centro', PER_PERSONA: 'per_persona', EQP_EQUIPO: 'eqp_equipo' };
const ACCIONES = ['FUSIONAR', 'MANTENER_SEPARADO', 'DESCARTAR'];
// Fusión implementada: solo las entidades de clientes (las de personas/equipos se resuelven a mano por ahora).
const FUSIONABLES = ['CLI_EMPRESA', 'CLI_SERVICIO', 'CLI_CENTRO', 'FAC_CONVENIO'];

const req = (tx) => new sql.Request(tx);

export const revisionDuplicadosService = {
  async resumen() {
    const pool = await getConnectionNueva();
    const r = await pool.request().query(`
      SELECT entidad, criterio, estado, COUNT(*) AS n
      FROM revision_duplicado GROUP BY entidad, criterio, estado ORDER BY entidad, criterio, estado`);
    return r.recordset;
  },

  async listar({ entidad, criterio, estado = 'PENDIENTE', q, soloConFichas, page = 1, limit = 25 }) {
    const pool = await getConnectionNueva();
    page = Math.max(1, parseInt(page) || 1); limit = Math.min(100, Math.max(1, parseInt(limit) || 25));
    const rq = pool.request();
    const where = ['1=1'];
    if (entidad) { where.push('entidad = @entidad'); rq.input('entidad', sql.VarChar(30), entidad); }
    if (criterio) { where.push('criterio = @criterio'); rq.input('criterio', sql.VarChar(50), criterio); }
    if (estado && estado !== 'TODOS') { where.push('estado = @estado'); rq.input('estado', sql.VarChar(20), estado); }
    if (q && String(q).trim()) { where.push('detalle_json LIKE @q'); rq.input('q', sql.NVarChar(200), `%${String(q).trim().replace(/[%_[]/g, '[$&]')}%`); }
    if (soloConFichas === 'true' || soloConFichas === true) {
      where.push(`(ISNULL(TRY_CAST(JSON_VALUE(detalle_json,'$.a.fichas') AS INT),0) > 0 OR ISNULL(TRY_CAST(JSON_VALUE(detalle_json,'$.b.fichas') AS INT),0) > 0)`);
    }
    rq.input('off', sql.Int, (page - 1) * limit); rq.input('lim', sql.Int, limit);
    const w = where.join(' AND ');
    const total = (await rq.query(`SELECT COUNT(*) AS n FROM revision_duplicado WHERE ${w}`)).recordset[0].n;
    // Más seguros primero: RUT igual y menor distancia; luego id (estable).
    const rows = (await rq.query(`
      SELECT id, entidad, id_registro_a, id_registro_b, criterio, distancia_metros, detalle_json, estado, revisado_por_id, revisado_en, observacion, creado_en
      FROM revision_duplicado WHERE ${w}
      ORDER BY CASE criterio WHEN 'MISMO_RUT' THEN 0 WHEN 'MISMO_NOMBRE_MISMA_EMPRESA' THEN 1 WHEN 'COORDENADAS_CERCANAS' THEN 2 ELSE 3 END,
               ISNULL(distancia_metros, 0), id
      OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`)).recordset;
    return { items: rows.map((x) => ({ ...x, detalle: x.detalle_json ? JSON.parse(x.detalle_json) : null, detalle_json: undefined })), total, page, limit };
  },

  // Cambia el estado de un par sin tocar datos (MANTENER_SEPARADO / DESCARTAR).
  async _marcar(tx, id, estado, userId, observacion) {
    await req(tx).input('id', sql.Int, id).input('estado', sql.VarChar(20), estado).input('u', sql.Int, userId ?? null).input('obs', sql.NVarChar(500), observacion ?? null)
      .query(`UPDATE revision_duplicado SET estado=@estado, revisado_por_id=@u, revisado_en=SYSDATETIME(), observacion=COALESCE(@obs, observacion) WHERE id=@id`);
  },

  // Repunta TODA referencia (FK) de la fila "pierde" hacia "queda" y elimina "pierde".
  async _fusionar(tx, entidad, queda, pierde) {
    const tabla = TABLA[entidad];
    // Convenios: "fusionar" = quedarse con uno y DESHABILITAR el otro. No se borra: conserva sus precios y las
    // cotizaciones que lo citan (id_convenio_resuelto). Los otros pares pendientes del descartado pasan al que queda.
    if (entidad === 'FAC_CONVENIO') {
      await req(tx).input('p', sql.Int, pierde).query(`UPDATE fac_convenio SET habilitado=0 WHERE id=@p`);
      await req(tx).input('k', sql.Int, queda).input('p', sql.Int, pierde).query(`
        UPDATE revision_duplicado SET id_registro_a=@k WHERE entidad='FAC_CONVENIO' AND id_registro_a=@p AND estado='PENDIENTE';
        UPDATE revision_duplicado SET id_registro_b=@k WHERE entidad='FAC_CONVENIO' AND id_registro_b=@p AND estado='PENDIENTE';
        UPDATE revision_duplicado SET estado='DESCARTAR', revisado_en=SYSDATETIME(), observacion=N'Descartado automáticamente: ambos convenios ya quedaron resueltos'
          WHERE entidad='FAC_CONVENIO' AND estado='PENDIENTE' AND id_registro_a=id_registro_b;`);
      return;
    }
    // filas hijas de cli_empresa_centro que chocarían con la restricción única: se borran las de "pierde"
    if (entidad === 'CLI_CENTRO') await req(tx).input('k', sql.Int, queda).input('p', sql.Int, pierde).query(`
      DELETE l FROM cli_empresa_centro l WHERE l.id_centro=@p AND EXISTS (SELECT 1 FROM cli_empresa_centro k WHERE k.id_centro=@k AND k.id_empresa_servicio=l.id_empresa_servicio AND k.fecha_inicio=l.fecha_inicio)`);
    if (entidad === 'CLI_SERVICIO') await req(tx).input('k', sql.Int, queda).input('p', sql.Int, pierde).query(`
      DELETE l FROM cli_empresa_centro l WHERE l.id_empresa_servicio=@p AND EXISTS (SELECT 1 FROM cli_empresa_centro k WHERE k.id_empresa_servicio=@k AND k.id_centro=l.id_centro AND k.fecha_inicio=l.fecha_inicio)`);
    const fks = (await req(tx).input('t', sql.NVarChar(128), tabla).query(`
      SELECT OBJECT_NAME(fk.parent_object_id) AS tabla, COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS columna
      FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      WHERE fk.referenced_object_id = OBJECT_ID(@t)`)).recordset;
    for (const f of fks) {
      if (!/^[A-Za-z0-9_]+$/.test(f.tabla) || !/^[A-Za-z0-9_]+$/.test(f.columna)) throw new Error('Nombre de tabla/columna inesperado');
      await req(tx).input('k', sql.Int, queda).input('p', sql.Int, pierde).query(`UPDATE [${f.tabla}] SET [${f.columna}]=@k WHERE [${f.columna}]=@p`);
    }
    // RUT: si la fila que queda tenía el RUT sufijado (#id) y la que se va tenía el RUT real, el RUT real pasa a quedar
    let rutReal = null;
    if (entidad === 'CLI_EMPRESA') {
      const r = (await req(tx).input('k', sql.Int, queda).input('p', sql.Int, pierde).query(`SELECT (SELECT rut FROM cli_empresa WHERE id=@k) AS rk, (SELECT rut FROM cli_empresa WHERE id=@p) AS rp`)).recordset[0];
      if (r.rk?.includes('#') && r.rp && !r.rp.includes('#') && !r.rp.startsWith('SIN-RUT')) rutReal = r.rp;
    }
    // el mapa temporal de ids: los ids legados de ambas filas ahora apuntan a la que queda
    await req(tx).input('k', sql.Int, queda).input('p', sql.Int, pierde).input('t', sql.VarChar(60), tabla)
      .query(`UPDATE mig_id_map SET id_nuevo=@k WHERE tabla_nueva=@t AND id_nuevo=@p`);
    // otros pares pendientes que citaban a la fila eliminada
    await req(tx).input('k', sql.Int, queda).input('p', sql.Int, pierde).input('e', sql.VarChar(30), entidad).query(`
      UPDATE revision_duplicado SET id_registro_a=@k WHERE entidad=@e AND id_registro_a=@p AND estado='PENDIENTE';
      UPDATE revision_duplicado SET id_registro_b=@k WHERE entidad=@e AND id_registro_b=@p AND estado='PENDIENTE';
      UPDATE revision_duplicado SET estado='DESCARTAR', revisado_en=SYSDATETIME(), observacion=N'Descartado automáticamente: ambos registros ya quedaron fusionados'
        WHERE entidad=@e AND estado='PENDIENTE' AND id_registro_a=id_registro_b;`);
    await req(tx).input('p', sql.Int, pierde).query(`DELETE FROM [${tabla}] WHERE id=@p`);
    if (rutReal) await req(tx).input('k', sql.Int, queda).input('r', sql.VarChar(20), rutReal).query(`UPDATE cli_empresa SET rut=@r WHERE id=@k`);
  },

  async resolver(id, { accion, mantener, observacion }, userId) {
    if (!ACCIONES.includes(accion)) { const e = new Error('Acción no válida'); e.status = 400; throw e; }
    const pool = await getConnectionNueva();
    const tx = new sql.Transaction(pool); await tx.begin();
    try {
      const par = (await req(tx).input('id', sql.Int, id).query(`SELECT * FROM revision_duplicado WITH (UPDLOCK, ROWLOCK) WHERE id=@id`)).recordset[0];
      if (!par) { const e = new Error('Par no encontrado'); e.status = 404; throw e; }
      if (par.estado !== 'PENDIENTE') { const e = new Error('Este par ya fue resuelto'); e.status = 409; throw e; }
      if (accion === 'FUSIONAR') {
        if (!FUSIONABLES.includes(par.entidad)) { const e = new Error(`La fusión de ${par.entidad} aún no está disponible desde esta pantalla`); e.status = 400; throw e; }
        if (!['A', 'B'].includes(mantener)) { const e = new Error('Indica cuál registro se mantiene (A o B)'); e.status = 400; throw e; }
        const queda = mantener === 'A' ? par.id_registro_a : par.id_registro_b, pierde = mantener === 'A' ? par.id_registro_b : par.id_registro_a;
        await this._fusionar(tx, par.entidad, queda, pierde);
        await this._marcar(tx, id, 'FUSIONAR', userId, observacion || `Se mantiene ${mantener}`);
      } else {
        await this._marcar(tx, id, accion, userId, observacion);
      }
      await tx.commit();
      return { id, estado: accion };
    } catch (e) { try { await tx.rollback(); } catch { /* ya cerrada */ } throw e; }
  },

  // Lote: un par por transacción (uno que falle no arrastra a los demás). Fusionar en lote conserva siempre "A" (el mejor registro según el cargador).
  async resolverLote(ids, { accion, observacion }, userId) {
    const resultado = { ok: 0, errores: [] };
    for (const id of ids.slice(0, 500)) {
      try { await this.resolver(Number(id), { accion, mantener: accion === 'FUSIONAR' ? 'A' : undefined, observacion }, userId); resultado.ok++; }
      catch (e) { resultado.errores.push({ id, mensaje: e.message }); }
    }
    return resultado;
  },
};
