import 'dotenv/config';
import { getConnection } from './src/config/database.js';
getConnection()
  .then(pool => pool.request().execute('MAM_FichaComercial_ConsultaCoordinador'))
  .then(r => console.log(Object.keys(r.recordset[0] || {})))
  .then(() => process.exit(0))
  .catch(console.error);
