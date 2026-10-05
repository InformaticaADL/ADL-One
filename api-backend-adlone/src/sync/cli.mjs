/* Motor de sincronización legado → esquema nuevo (proceso aparte; NO corre dentro del servidor de la API).
 *
 *   node src/sync/cli.mjs --simular            → solo muestra qué copiaría (no escribe nada)
 *   node src/sync/cli.mjs                      → una pasada
 *   node src/sync/cli.mjs --cada 30            → modo servicio: repite cada 30 segundos hasta detenerlo (Ctrl+C / SIGTERM)
 *   Filtros: --modulo sol   --tabla mae_solicitud
 *
 * Modo servicio: una sola instancia a la vez (archivo .sync.lock con el PID; si el proceso anterior murió, se recupera solo);
 * si una pasada falla (red, base caída) reintenta con espera creciente (hasta 5 min) y sigue; latido en consola cada 10 min;
 * al recibir Ctrl+C/SIGTERM termina la pasada en curso y sale limpio. Para dejarlo como servicio de Windows: pm2 / nssm / tarea programada
 * apuntando a `node src/sync/cli.mjs --cada 30`.
 * Interruptor de emergencia: UPDATE mig_sync_estado SET habilitado = 0 WHERE tabla_legado = '<tabla>' (o detener el proceso).
 * Nunca modifica el legado. Requiere el parche 15_patch_sync.sql en la base nueva.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutarPasada } from './motor.js';

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
const simular = process.argv.includes('--simular');
const cada = Number(arg('--cada')) || 0;
const modulo = arg('--modulo'), tabla = arg('--tabla');
const hora = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const LOCK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.sync.lock');

async function una() {
  const r = await ejecutarPasada({ modulo, tabla, simular, log: (m) => console.log(m) });
  const hayCambios = r.resumen.some((x) => x.por_copiar || x.por_borrar);
  if (simular || hayCambios || !cada) { console.log(`\n[${hora()}] ${simular ? 'SIMULACIÓN' : 'Pasada'}:`); console.table(r.resumen.filter((x) => simular || !cada || x.por_copiar || x.por_borrar)); }
  if (!simular) console.log(`[${hora()}] copiados ${r.aplicados}, borrados ${r.borrados}, con error ${r.errores}`);
  return r;
}

function tomarLock() {
  try { const pid = Number(fs.readFileSync(LOCK, 'utf8')); if (pid && pid !== process.pid) { try { process.kill(pid, 0); throw new Error(`ya hay un motor corriendo (PID ${pid}). Si no es así, borra ${LOCK}.`); } catch (e) { if (e.code !== 'ESRCH') throw e; } } } catch (e) { if (e.code !== 'ENOENT') throw e; }
  fs.writeFileSync(LOCK, String(process.pid));
}
const soltarLock = () => { try { if (Number(fs.readFileSync(LOCK, 'utf8')) === process.pid) fs.unlinkSync(LOCK); } catch { /* ya no está */ } };

try {
  if (!cada) { await una(); process.exit(0); }
  tomarLock(); let parar = false; const salir = () => { parar = true; console.log(`[${hora()}] señal de parada: termino la pasada en curso y salgo`); };
  process.on('SIGINT', salir); process.on('SIGTERM', salir); process.on('exit', soltarLock);
  console.log(`[${hora()}] motor en modo servicio: una pasada cada ${cada} s (PID ${process.pid})`);
  let fallos = 0, ultimoLatido = Date.now();
  const dormir = (s) => new Promise((res) => { const t = setInterval(() => { if (parar) { clearInterval(t); res(); } }, 500); setTimeout(() => { clearInterval(t); res(); }, s * 1000); });
  while (!parar) {
    try { const r = await una(); fallos = 0; if (Date.now() - ultimoLatido > 600000) { console.log(`[${hora()}] latido: al día (errores abiertos en esta pasada: ${r.errores})`); ultimoLatido = Date.now(); } }
    catch (e) { fallos++; console.error(`[${hora()}] pasada fallida (${fallos} seguidas): ${e.message}`); }
    await dormir(fallos ? Math.min(300, cada * 2 ** Math.min(fallos, 6)) : cada);
  }
  process.exit(0);
} catch (e) { console.error('ERROR:', e.message); process.exit(1); }
