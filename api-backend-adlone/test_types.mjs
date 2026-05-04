import 'dotenv/config';
import { getConnection } from './src/config/database.js';

getConnection().then(async pool => {
  const result = await pool.request().execute('MAM_FichaComercial_ConsultaCoordinador');
  const encResult = await pool.request().query('SELECT TOP 1 id_fichaingresoservicio FROM App_Ma_FichaIngresoServicio_ENC');
  console.log('SP typeof:', typeof result.recordset[0].fichaingresoservicio, result.recordset[0].fichaingresoservicio);
  console.log('ENC typeof:', typeof encResult.recordset[0].id_fichaingresoservicio, encResult.recordset[0].id_fichaingresoservicio);
  process.exit(0);
}).catch(console.error);
