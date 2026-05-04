import 'dotenv/config';
import { getConnection } from './src/config/database.js';
getConnection()
  .then(pool => pool.request().query("SELECT TOP 10 id_fichaingresoservicio, referencia_googlemaps, ma_coordenadas FROM App_Ma_FichaIngresoServicio_ENC WHERE referencia_googlemaps IS NOT NULL AND referencia_googlemaps != ''"))
  .then(r => console.log(r.recordset))
  .then(() => process.exit(0))
  .catch(console.error);
