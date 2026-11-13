// SOLO LECTURA sobre produccion (192.168.10.5): cuenta filas; no ejecuta ninguna sentencia que escriba.
const path = 'C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend/';
require(path + 'node_modules/dotenv').config({ path: path + '.env' });
const sql = require(path + 'node_modules/mssql');
const fs = require('fs');
(async () => {
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PWD, database: process.env.DB_LIMS, options: { encrypt: false, trustServerCertificate: true, readOnlyIntent: true }, requestTimeout: 180000 }).connect();
  const ids = [67830, 67834, 68632, 68017, 68571, 68539, 67901];
  const r = await p.request().query(`SELECT @@SERVERNAME servidor, DB_NAME() base,
    (SELECT COUNT(*) FROM facturacion_enc) enc, (SELECT MAX(id_facturacion) FROM facturacion_enc) max_enc,
    (SELECT COUNT(*) FROM facturacion_det) det, (SELECT COUNT(*) FROM facturacion_otro) otro,
    (SELECT TOP 1 id_facturacion FROM Mae_id) mae_id,
    (SELECT COUNT(*) FROM muestras_detalle WHERE estado='ENVIADO' AND ISNULL(id_facturacion,0)=0) pendientes,
    (SELECT COUNT(*) FROM muestras_detalle WHERE id_facturacion IN (${ids.join(',')})) lineas_de_las_7,
    (SELECT COUNT(*) FROM facturacion_enc WHERE id_facturacion IN (${ids.join(',')})) enc_de_las_7,
    (SELECT SUM(CAST(ISNULL(vtatotal,0) AS float)) FROM muestras_detalle WHERE id_facturacion IN (${ids.join(',')})) suma_vtatotal_7`);
  const foto = { tomada: new Date().toISOString(), ...r.recordset[0] };
  fs.writeFileSync(process.argv[2], JSON.stringify(foto, null, 1));
  console.log(JSON.stringify(foto, null, 1));
  await p.close();
})().catch(e => console.log('ERR', e.message));
