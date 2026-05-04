import 'dotenv/config';
import { getConnection } from './src/config/database.js';

getConnection().then(async pool => {
  const result = await pool.request().execute('MAM_FichaComercial_ConsultaCoordinador');
  const ids = result.recordset.map(r => r.id_fichaingresoservicio || r.fichaingresoservicio);
  
  const encQuery = `
    SELECT id_fichaingresoservicio, referencia_googlemaps, ma_coordenadas 
    FROM App_Ma_FichaIngresoServicio_ENC 
    WHERE id_fichaingresoservicio IN (${ids.join(',')})
  `;
  const encResult = await pool.request().query(encQuery);
  const encMap = new Map(encResult.recordset.map(row => [row.id_fichaingresoservicio, row]));
  
  const mapped = result.recordset.map(row => {
    const id = row.id_fichaingresoservicio || row.fichaingresoservicio;
    const encData = encMap.get(id);
    return {
      id,
      ref_google: encData?.referencia_googlemaps || null,
      ma_coordenadas: encData?.ma_coordenadas || null
    };
  });
  
  console.log('Total Fichas:', mapped.length);
  const withGoogle = mapped.filter(m => m.ref_google);
  console.log('Con ref_google:', withGoogle.length);
  console.log(withGoogle.slice(0, 5));
  process.exit(0);
}).catch(console.error);
