import 'dotenv/config';
import { getConnection } from './src/config/database.js';

getConnection().then(async pool => {
  const result = await pool.request().query('SELECT TOP 1 * FROM App_Ma_Agenda_MUESTREOS');
  console.log(result.recordset[0]);
  process.exit(0);
}).catch(console.error);
