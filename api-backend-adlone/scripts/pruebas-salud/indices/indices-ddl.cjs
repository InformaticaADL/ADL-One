// Crea indices en la copia LOCAL (NTDMora\ADLLOCAL). Uso: node indices-ddl.cjs <contraseña sa local> <C1|C2|quitar>
//   C1 = los mismos indices que tiene produccion hoy en las tablas de facturacion (para que la copia se comporte como el servidor real)
//   C2 = C1 + indices candidatos para facturacion (los que produccion NO tiene)
//   quitar = elimina todos los indices no clustered y las claves primarias que crea este script (deja la copia como la dejo crear-copia-local)
const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');
const C1 = {
  LaboratorioADL: [
    'ALTER TABLE dbo.muestras ADD CONSTRAINT PK_muestras PRIMARY KEY CLUSTERED (id_caso)',
    'CREATE NONCLUSTERED INDEX IX_muestras_estado_lugar ON dbo.muestras (estado_caso, id_lugaranalisis)',
    'CREATE NONCLUSTERED INDEX IX_muestras_n_recepcion ON dbo.muestras (n_recepcion)',
    'CREATE NONCLUSTERED INDEX IX_muestras_detalle_caso_tecnica_item ON dbo.muestras_detalle (id_caso, id_tecnica, item, id_organo) INCLUDE (estado)',
    'CREATE NONCLUSTERED INDEX IX_muestras_detalle_por_facturar ON dbo.muestras_detalle (id_seccion, sederiva, id_facturacion) INCLUDE (id_caso, id_tecnica, id_organo, estado, clasifica, n_analisis, vtaunitario, vtatotal)',
    'CREATE NONCLUSTERED INDEX IX_muestras_detalle_seccion_estado ON dbo.muestras_detalle (id_seccion, estado, sederiva) INCLUDE (id_caso)',
    'ALTER TABLE dbo.facturacion_enc ADD CONSTRAINT PK_facturacion_enc PRIMARY KEY CLUSTERED (id_facturacion)',
    'ALTER TABLE dbo.mae_empresaservicios ADD CONSTRAINT PK_mae_empresaservicios PRIMARY KEY CLUSTERED (id_empresaservicio)'
  ],
  Abastecimiento: ['ALTER TABLE dbo.gd_enc ADD CONSTRAINT PK_gd_enc PRIMARY KEY CLUSTERED (id_gd)']
};
const C2 = {
  LaboratorioADL: [
    // detalle de facturas: hoy sin ningun indice (1,7 millones de filas)
    'CREATE NONCLUSTERED INDEX IX_fdet_id_facturacion ON dbo.facturacion_det (id_facturacion) INCLUDE (id_caso, item, vtatotal)',
    'CREATE NONCLUSTERED INDEX IX_fdet_caso_item ON dbo.facturacion_det (id_caso, item) INCLUDE (id_facturacion)',
    // buscar lineas por factura (eliminar, grabar folio, nota de credito): hoy recorre toda la tabla
    'CREATE NONCLUSTERED INDEX IX_md_id_facturacion ON dbo.muestras_detalle (id_facturacion) INCLUDE (id_caso, item, id_tecnica, estado, mf, uf)',
    // (el indice de elegibilidad en muestras por empresa+programa+estado se probo y se RETIRO: cambia el plan de los procedimientos de ADLSOFT y expone fechas mal digitadas)
    // listados y busquedas de facturas
    'CREATE NONCLUSTERED INDEX IX_fenc_factura ON dbo.facturacion_enc (factura)',
    'CREATE NONCLUSTERED INDEX IX_fenc_empresa_emitido ON dbo.facturacion_enc (id_empresaservicio, emitido) INCLUDE (factura, fecha_facturacion, uf_totalfac)',
    'CREATE NONCLUSTERED INDEX IX_fotro_id_facturacion ON dbo.facturacion_otro (id_facturacion)',
    'CREATE NONCLUSTERED INDEX IX_fotro_factura ON dbo.facturacion_otro (factura)',
    'CREATE NONCLUSTERED INDEX IX_fing_id_facturacion ON dbo.facturacion_ing (id_facturacion)',
    'CREATE NONCLUSTERED INDEX IX_fdes_id_facturacion ON dbo.facturacion_des (id_facturacion)',
    'CREATE NONCLUSTERED INDEX IX_foc_id_facturacion ON dbo.facturacion_oc (id_facturacion)',
    'CREATE NONCLUSTERED INDEX IX_focompra_id_facturacion ON dbo.facturacion_ocompra (id_facturacion)'
  ],
  Abastecimiento: [
    'CREATE NONCLUSTERED INDEX IX_gdenc_emp_estado ON dbo.gd_enc (id_empresaservicio, estado, marca) INCLUDE (id_facturacion, factura)',
    'CREATE NONCLUSTERED INDEX IX_gdenc_id_facturacion ON dbo.gd_enc (id_facturacion)',
    'CREATE NONCLUSTERED INDEX IX_gddet_id_gd ON dbo.gd_det (id_gd)'
  ]
};
(async () => {
  const modo = process.argv[3];
  const cfg = (database) => ({ user: 'sa', password: process.argv[2], server: 'localhost', port: 14330, database, options: { encrypt: true, trustServerCertificate: true }, requestTimeout: 600000 });
  const master = await new sql.ConnectionPool(cfg('master')).connect();
  const id = (await master.request().query(`SELECT @@SERVERNAME s, CAST(SERVERPROPERTY('MachineName') AS nvarchar(100)) m`)).recordset[0];
  if (!/ADLLOCAL/i.test(id.s)) throw new Error('NO ES LA INSTANCIA LOCAL: ' + id.s);
  await master.close();
  console.log('servidor:', id.s);
  const plan = modo === 'C1' ? C1 : modo === 'C2' ? { LaboratorioADL: [...C1.LaboratorioADL, ...C2.LaboratorioADL], Abastecimiento: [...C1.Abastecimiento, ...C2.Abastecimiento] } : null;
  for (const bd of ['LaboratorioADL', 'Abastecimiento']) {
    const p = await new sql.ConnectionPool(cfg(bd)).connect();
    if (modo === 'quitar') {
      const xs = (await p.request().query(`SELECT 'DROP INDEX ' + QUOTENAME(i.name) + ' ON ' + QUOTENAME(OBJECT_NAME(i.object_id)) q FROM sys.indexes i JOIN sys.objects o ON o.object_id=i.object_id AND o.type='U' WHERE i.type = 2 AND i.is_primary_key = 0 AND i.is_unique_constraint = 0`)).recordset;
      for (const x of xs) await p.request().batch(x.q);
      const pks = (await p.request().query(`SELECT 'ALTER TABLE ' + QUOTENAME(OBJECT_NAME(parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(name) q FROM sys.key_constraints WHERE type = 'PK'`)).recordset;
      for (const x of pks) await p.request().batch(x.q);
      console.log(bd + ': indices quitados', xs.length, '| claves primarias quitadas', pks.length);
    } else {
      let n = 0; const t0 = Date.now();
      for (const d of plan[bd]) { const nombre = /(?:INDEX|CONSTRAINT) (\w+)/.exec(d)[1]; if ((await p.request().query(`SELECT 1 x FROM sys.indexes WHERE name = '${nombre}'`)).recordset.length) continue; await p.request().batch(d); n++; }
      console.log(bd + ': ' + n + ' indices creados en ' + Math.round((Date.now() - t0) / 1000) + ' s');
    }
    await p.close();
  }
})().catch((e) => console.log('ERR', e.message));
